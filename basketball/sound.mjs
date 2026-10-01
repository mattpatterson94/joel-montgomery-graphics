import {IOSAudioChannel} from './ios-audio.mjs?v=19';
// Recorded office-machine contacts, with procedural net/board sounds and loading fallback.
const RECORDINGS={rim:['rim-1','rim-2'],sensor:['sensor-1','sensor-2'],return:['return-1','return-2'],bounce:['fabric-impact']};
const LEVELS={rim:.65,sensor:.7,return:.08,bounce:.13};
export class CourtAudio {
 constructor(context=null){this.channel=new IOSAudioChannel();this.context=context;this.enabled=true;this.last=new Map();this.voices=0;this.samples={};this.variants={};}
 unlock(fromGesture=false){
  if(!this.enabled)return;
  try{
   if(fromGesture&&typeof this.context?.startRendering!=='function'){try{this.channel.start();}catch{}}
   // Request media playback on supporting phones, instead of the default
   // ambient session that can be silenced by the iPhone's silent switch.
   if(fromGesture&&globalThis.navigator?.audioSession){
    try{navigator.audioSession.type='playback';}catch{}
   }
   this.context??=new (window.AudioContext||window.webkitAudioContext)();
   const ctx=this.context;
   if(typeof ctx.startRendering!=='function'){
    // Safari can report "interrupted" after an app switch or phone call.
    if(ctx.state==='suspended'||ctx.state==='interrupted')ctx.resume().catch(()=>{});
    if(fromGesture&&!this.unlocked){
     // Start a silent source synchronously within the real touch event. Merely
     // creating/resuming a context on pointerdown is not sufficient on all iOS versions.
     const source=ctx.createBufferSource();
     source.buffer=ctx.createBuffer(1,1,ctx.sampleRate);source.connect(ctx.destination);
     source.onended=()=>{this.unlocked=true;source.disconnect();};source.start(0);
    }
   }
   this.loadSamples();
  }catch{}
 }
 setEnabled(enabled){
  this.enabled=enabled;
  if(enabled)this.unlock(true);else this.channel.stop();
 }
 pause(){this.channel.stop();}
 async test(){
  this.setEnabled(true);
  if(!this.context)throw new Error('Audio is unavailable in this browser.');
  let timer;
  try{
   await Promise.race([Promise.all([this.context.resume(),this.channel.ready]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Sound is blocked. Try tapping Start round, then Test sound.')),1800);})]);
   if(this.channel.error)throw new Error('Audio playback was blocked. Tap Test sound again.');
   if(this.context.state!=='running')throw new Error('Sound is blocked. Try tapping Test sound again.');
   this.play('rim',1);
  }finally{clearTimeout(timer);}
 }
 async loadSamples(){
  if(!this.context)return;
  if(this.loading)return this.loading;
  this.loading=Promise.all(Object.entries(RECORDINGS).map(async([type,names])=>{
   const buffers=await Promise.all(names.map(async name=>{
    try{
     const response=await fetch(new URL(`./audio/${name}.wav`,import.meta.url));
     if(!response.ok)throw new Error('Audio unavailable');
     return await this.context.decodeAudioData(await response.arrayBuffer());
    }catch{return null;}
   }));
   this.samples[type]=buffers.filter(Boolean);
  }));
  return this.loading;
 }
 setup(){
  const ctx=this.context;
  if(!ctx||this.bus)return;
  this.bus=ctx.createDynamicsCompressor();this.bus.threshold.value=-17;this.bus.ratio.value=5;this.bus.connect(ctx.destination);
  this.noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
  const data=this.noise.getChannelData(0);let previous=0;
  for(let i=0;i<data.length;i++){const white=Math.random()*2-1;data[i]=white*.7+previous*.3;previous=white;}
 }
 play(type,strength=.7,pan=0){
  if(!this.enabled||(globalThis.document?.hidden&&typeof this.context?.startRendering!=='function'))return;
  this.unlock();if(!this.context)return;
  // Don't accumulate delayed effects while a phone has blocked audio.
  if(this.context.state!=='running'&&typeof this.context.startRendering!=='function')return;
  this.setup();
  const ctx=this.context,now=ctx.currentTime;
  if(this.voices>22||now-(this.last.get(type)??-1)<.025)return;
  this.last.set(type,now);this.voices++;
  const output=ctx.createGain(),panner=ctx.createStereoPanner();
  output.gain.value=.12*Math.max(.1,Math.min(1,strength));panner.pan.value=Math.max(-.8,Math.min(.8,pan));output.connect(panner);panner.connect(this.bus);
  const nodes=[output,panner],sources=[];
  const noise=(delay,duration,frequency,volume,filterType='bandpass',attack=.002)=>{
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=this.noise;filter.type=filterType;filter.frequency.value=frequency;filter.Q.value=.65;
    const t=now+delay;gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(volume,t+attack);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    source.connect(filter);filter.connect(gain);gain.connect(output);source.start(t,Math.random()*.4,duration);source.stop(t+duration);
    nodes.push(source,filter,gain);sources.push(source);
  };
  const mode=(frequency,decay,volume,slide=1,delay=0)=>{
    const oscillator=ctx.createOscillator(),gain=ctx.createGain(),t=now+delay;
    oscillator.frequency.setValueAtTime(frequency*(.97+Math.random()*.06),t);oscillator.frequency.exponentialRampToValueAtTime(frequency*slide,t+decay);
    gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+decay);
    oscillator.connect(gain);gain.connect(output);oscillator.start(t);oscillator.stop(t+decay);nodes.push(oscillator,gain);sources.push(oscillator);
  };
  const rubberImpact=()=>{
    const duration=.24,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
    const pitch=.9+Math.random()*.2,rate=ctx.sampleRate;let low=0,mid=0,phase=0,previous=0;
    for(let i=0;i<data.length;i++){
      const t=i/rate,white=Math.random()*2-1;
      low+=.065*(white-low);mid+=.3*(white-mid);
      // A noisy, compressed membrane thump, a short contact slap, then a little
      // fabric/cage chatter. Each impact varies without becoming a pitched beep.
      phase+=2*Math.PI*(83+37*Math.exp(-t*100))*pitch/rate;
      const membrane=(Math.sin(phase)*.24+Math.sin(phase*1.73+mid*2)*.065)*Math.exp(-t*31);
      const thud=low*3.4*Math.exp(-t*29);
      const slap=(white-mid)*.65*Math.exp(-t*240);
      const rub=(mid-previous)*1.2*Math.exp(-t*24);
      const chatter=t>.025?white*.065*Math.exp(-(t-.025)*48)*(1+Math.sin(t*490))*.5:0;
      data[i]=Math.tanh((membrane+thud+slap+rub+chatter)*2.1)*.8;previous=mid;
    }
    const source=ctx.createBufferSource();source.buffer=buffer;source.connect(output);source.start(now);nodes.push(source);sources.push(source);
  };
  const clips=this.samples[type];
  if(clips?.length){
    const index=this.variants[type]??0;this.variants[type]=index+1;
    const source=ctx.createBufferSource();source.buffer=clips[index%clips.length];
    source.playbackRate.value=1+(Math.random()-.5)*(type==='sensor'?.02:.05);
    output.gain.value=.28*LEVELS[type]*Math.max(.1,Math.min(1,strength));
    source.connect(output);source.start(now);nodes.push(source);sources.push(source);
  }else if(type==='sensor'){
    noise(0,.08,480,.8,'lowpass');mode(310,.15,.3,.88);mode(890,.12,.2);
  }else if(type==='return'){
    noise(0,.32,780,.1,'bandpass',.025);
  }else if(type==='rim'){
    noise(0,.026,2600,.6,'highpass');mode(690,.12,.48);mode(1171,.085,.23);mode(2049,.06,.12);
  }else if(type==='board'){
    noise(0,.018,1700,.8,'highpass');noise(0,.09,520,1.1,'lowpass');mode(138,.085,.5,.82);mode(291,.045,.14);noise(.022,.09,950,.24,'bandpass');
  }else if(type==='bounce'||type==='floor'){
    rubberImpact();
  }else if(type==='swish'||type==='net'){
    const clean=type==='swish';noise(0,clean?.27:.16,clean?1550:1100,clean?.8:.55,'bandpass',.025);
    noise(.045,clean?.2:.12,3100,.25,'highpass',.018);
    if(clean)noise(.08,.1,640,.18,'lowpass',.008);
    for(let i=0;i<3;i++)noise(.035+i*.037+Math.random()*.01,.025,1800+Math.random()*1200,.09,'bandpass',.004);
  }else if(type==='release'){
    noise(0,.06,900,.2,'bandpass',.01);
  }else if(type==='end'){
    // A short machine-style end cue; basket sounds never use this oscillator.
    mode(92,.22,.5,.8);mode(92,.2,.4,.8,.19);
  }
  let left=sources.length;
  const cleanup=()=>{if(--left===0){nodes.forEach(node=>node.disconnect());this.voices--;}};
  if(!left){nodes.forEach(node=>node.disconnect());this.voices--;}
  else sources.forEach(source=>source.onended=cleanup);
 }
}

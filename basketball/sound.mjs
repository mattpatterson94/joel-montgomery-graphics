// Procedural material sounds, not musical score beeps. Noise supplies the attack
// and net friction; short inharmonic resonances supply rubber, metal and board body.
export class CourtAudio {
 constructor(context=null){this.context=context;this.enabled=false;this.last=new Map();this.voices=0;}
 unlock(){
  if(!this.enabled)return;
  try{this.context??=new (window.AudioContext||window.webkitAudioContext)();if(this.context.state==='suspended'&&typeof this.context.startRendering!=='function')this.context.resume().catch(()=>{});}catch{}
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
  if(!this.enabled)return;
  this.unlock();if(!this.context)return;this.setup();
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
  if(type==='rim'){
    noise(0,.026,2600,.6,'highpass');mode(690,.12,.48);mode(1171,.085,.23);mode(2049,.06,.12);
  }else if(type==='board'){
    noise(0,.018,1700,.8,'highpass');noise(0,.09,520,1.1,'lowpass');mode(138,.085,.5,.82);mode(291,.045,.14);noise(.022,.09,950,.24,'bandpass');
  }else if(type==='bounce'){
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

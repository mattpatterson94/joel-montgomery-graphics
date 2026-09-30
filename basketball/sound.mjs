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
  if(type==='rim'){
    noise(0,.026,2600,.6,'highpass');mode(690,.12,.48);mode(1171,.085,.23);mode(2049,.06,.12);
  }else if(type==='board'){
    noise(0,.07,520,1,'lowpass');mode(138,.11,.85,.82);mode(291,.055,.23);
  }else if(type==='bounce'){
    noise(0,.04,800,.45,'lowpass');mode(105,.15,.85,.58);mode(218,.048,.1);
  }else if(type==='swish'||type==='net'){
    const clean=type==='swish';noise(0,clean?.27:.16,clean?1550:1100,clean?.8:.55,'bandpass',.025);
    noise(.045,clean?.2:.12,3100,.25,'highpass',.018);
    if(clean)noise(.08,.1,640,.18,'lowpass',.008);
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

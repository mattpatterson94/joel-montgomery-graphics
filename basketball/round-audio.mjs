// Follow the displayed countdown, without replaying skipped seconds after a
// background tab or a stalled frame. Restarting invalidates a pending start cue.
export class RoundAudio {
 constructor(audio,now=()=>performance.now()){
  this.audio=audio;this.now=now;this.generation=0;this.previous=30;
 }
 start(deadline){
  const generation=++this.generation;
  this.previous=30;this.audio.stopRoundCues();
  // Keep iPhone activation synchronous inside the Start Round click handler.
  this.audio.unlock(true,'start button');
  this.ready=Promise.all([this.audio.resumePromise,this.audio.loadSamples()]).then(()=>{
   if(generation===this.generation&&this.now()<deadline-27000)this.audio.play('start',1);
  }).catch(error=>this.audio.error('round start',error));
 }
 update(seconds){
  const current=Math.ceil(seconds);
  if(current<this.previous){
   if(current===10)this.audio.play('three',1);
   else if(current>=1&&current<=3)this.audio.play('countdown',1);
  }
  this.previous=current;
 }
}

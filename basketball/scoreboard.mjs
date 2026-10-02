export class ScoreboardDisplay {
 constructor(element,reducedMotion=false){
  this.element=element;this.reducedMotion=reducedMotion;this.state='off';this.finishedAt=0;this.render(false);
 }
 start(){this.state='live';this.render(true);}
 finish(now){this.state='final';this.finishedAt=now;this.render(true);}
 update(now){
  if(this.state!=='final')return;
  const elapsed=now-this.finishedAt;
  if(elapsed>=8000){this.state='off';this.render(false);}
  else this.render(this.reducedMotion||Math.floor(elapsed/500)%2===0);
 }
 render(lit){this.element.dataset.state=this.state;this.element.dataset.lit=String(lit);}
}

// Perspective fabric return sling with a soft bounce when balls land.
let impact=0;
export function fabricImpact(strength=.5){ impact=Math.max(impact,Math.min(1,strength)); }
export function drawFabricReturn(ctx){
 const bounce=impact;
 impact*=.88;
 const point=(u,v)=>{
  const left=47-45*v,width=706+90*v;
  const sag=Math.sin(Math.PI*u)*(18+42*Math.sin(Math.PI*v)+18*v) + bounce*Math.sin(Math.PI*u)*18;
  return [left+width*u,456+500*v+sag];
 };
 const line=(points)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));};
 const edge=[];
 for(let i=0;i<=40;i++)edge.push(point(i/40,0));
 for(let i=0;i<=40;i++)edge.push(point(1,i/40));
 for(let i=40;i>=0;i--)edge.push(point(i/40,1));
 for(let i=40;i>=0;i--)edge.push(point(0,i/40));
 ctx.save();line(edge);ctx.closePath();ctx.clip();
 const shade=ctx.createLinearGradient(0,450,0,1000);shade.addColorStop(0,'#0c0f12');shade.addColorStop(.45,'#25282b');shade.addColorStop(1,'#111416');ctx.fillStyle=shade;ctx.fillRect(0,450,800,560);
 for(let side of [0,1])for(let i=0;i<7;i++){
  const v=.12+i*.12,origin=point(side,v),end=point(side?.8:.2,Math.min(1,v+.2));
  ctx.beginPath();ctx.moveTo(...origin);ctx.bezierCurveTo(origin[0]+(side?-25:25),origin[1]+35,end[0],end[1],...end);
  ctx.strokeStyle='#00000035';ctx.lineWidth=10;ctx.stroke();
 }
 for(let i=0;i<900;i++){
  const u=((i*163)%899)/899,v=((i*431)%899)/899,p=point(u,v);
  ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(p[0]+2,p[1]+1);ctx.strokeStyle=i%3?'#b5bab80a':'#00000012';ctx.lineWidth=.7;ctx.stroke();
 }
 // Curved court print follows the fabric instead of sitting on a flat plane.
 ctx.strokeStyle='#e1e4df75';ctx.lineWidth=2.5;
 line([point(.5,.05),point(.5,.4)]);ctx.stroke();
 line(Array.from({length:31},(_,i)=>{const a=Math.PI-i/30*Math.PI;return point(.5+.18*Math.cos(a),.4+.1*Math.sin(a));}));ctx.stroke();
 ctx.strokeStyle='#89909655';ctx.lineWidth=2;
 line(Array.from({length:41},(_,i)=>point(0,i/40)));ctx.stroke();
 line(Array.from({length:41},(_,i)=>point(1,i/40)));ctx.stroke();
 line(Array.from({length:61},(_,i)=>point(i/60,.98)));ctx.stroke();
 ctx.restore();
}

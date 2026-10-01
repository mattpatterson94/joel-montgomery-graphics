import {returnPoint} from './machine-geometry.mjs?v=16';
let impactAt=-Infinity,impactStrength=0;
export function fabricImpact(now,strength=.5){impactAt=now;impactStrength=Math.min(1,strength);}
export function fabricMoving(now){return now-impactAt<850;}
export function drawFabricReturn(ctx,now=0){
 const age=Math.max(0,(now-impactAt)/1000);
 const bounce=age<.85?Math.sin(age*15)*Math.exp(-age*5)*18*impactStrength:0;
 const point=(u,v)=>returnPoint(u,v,bounce);
 const line=points=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));};
 const edge=[point(0,0),point(1,0),point(1,1)];
 for(let i=40;i>=0;i--)edge.push(point(i/40,1));
 ctx.save();line(edge);ctx.closePath();ctx.clip();
 const shade=ctx.createLinearGradient(0,456,0,960);shade.addColorStop(0,'#0e1113');shade.addColorStop(.6,'#25292b');shade.addColorStop(1,'#101516');ctx.fillStyle=shade;ctx.fillRect(-40,456,880,504);
 const trough=ctx.createLinearGradient(-12,0,812,0);trough.addColorStop(0,'#888e9026');trough.addColorStop(.15,'#00000038');trough.addColorStop(.5,'#00000018');trough.addColorStop(.85,'#00000038');trough.addColorStop(1,'#888e9026');ctx.fillStyle=trough;ctx.fillRect(-40,456,880,504);
 for(const side of [0,1])for(let i=0;i<4;i++){
  const v=.17+i*.18,origin=point(side,v),end=point(side?.86:.14,Math.min(1,v+.15));
  ctx.beginPath();ctx.moveTo(...origin);ctx.bezierCurveTo(origin[0]+(side?-16:16),origin[1]+25,end[0]+(side?10:-10),end[1]-5,...end);
  ctx.strokeStyle='#05080b30';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#a4a9b014';ctx.lineWidth=1;ctx.stroke();
 }
 ctx.lineWidth=.6;
 for(let i=0;i<900;i++){
  const p=point(((i*163)%899)/899,((i*431)%899)/899);
  line([p,[p[0]+2.5,p[1]+.8]]);ctx.strokeStyle=i%3?'#b4b9c009':'#00000010';ctx.stroke();
 }
 // One court marking, mapped onto the same sagging fabric as its seams.
 ctx.lineWidth=2.5;ctx.strokeStyle='#e1e4df80';
 const outer=[];
 for(let i=0;i<=25;i++)outer.push(point(.31-i/25*.025,.03+i/25*.38));
 for(let i=0;i<=30;i++){const a=Math.PI-i/30*Math.PI;outer.push(point(.5+.215*Math.cos(a),.41+.12*Math.sin(a)));}
 for(let i=25;i>=0;i--)outer.push(point(.69+i/25*.025,.03+i/25*.38));
 line(outer);ctx.stroke();line([point(.40,.04),point(.385,.38),point(.615,.38),point(.60,.04)]);ctx.stroke();
 const arc=(from,to)=>Array.from({length:31},(_,i)=>{const a=from+(to-from)*i/30;return point(.5+.115*Math.cos(a),.38+.075*Math.sin(a));});
 line(arc(Math.PI,0));ctx.stroke();ctx.setLineDash([3,5]);line(arc(Math.PI,2*Math.PI));ctx.stroke();ctx.setLineDash([]);
 for(const side of [-1,1])for(let i=0;i<4;i++){const v=.22+i*.04,u=.5+side*(.1+.015*(v-.04)/.34);line([point(u,v),point(u+side*.017,v)]);ctx.stroke();}
 ctx.strokeStyle='#89909655';ctx.lineWidth=1.5;
 for(const u of [.008,.992]){line(Array.from({length:41},(_,i)=>point(u,i/40)));ctx.stroke();}
 line(Array.from({length:61},(_,i)=>point(i/60,.985)));ctx.stroke();ctx.restore();
}

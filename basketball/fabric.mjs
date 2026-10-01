// Static woven return sling, rendered once with the backboard. Court markings
// share its curved surface so they bend into the trough instead of floating flat.
export function drawFabricReturn(ctx){
 const point=(u,v)=>{
  const left=47-21*v,width=706+42*v;
  const sag=Math.sin(Math.PI*u)*(8+30*Math.sin(Math.PI*v)+22*v);
  return [left+width*u,456+439*v+sag];
 };
 const line=(points)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));};
 const edge=[];
 for(let i=0;i<=40;i++)edge.push(point(i/40,0));
 for(let i=0;i<=40;i++)edge.push(point(1,i/40));
 for(let i=40;i>=0;i--)edge.push(point(i/40,1));
 for(let i=40;i>=0;i--)edge.push(point(0,i/40));
 ctx.save();line(edge);ctx.closePath();ctx.clip();
 const shade=ctx.createLinearGradient(0,456,0,960);shade.addColorStop(0,'#0e1013');shade.addColorStop(.36,'#15181c');shade.addColorStop(.7,'#282b30');shade.addColorStop(1,'#15181c');ctx.fillStyle=shade;ctx.fillRect(0,450,800,510);
 const trough=ctx.createLinearGradient(20,0,780,0);trough.addColorStop(0,'#777c8322');trough.addColorStop(.1,'#00000044');trough.addColorStop(.5,'#00000035');trough.addColorStop(.9,'#00000044');trough.addColorStop(1,'#777c8322');ctx.fillStyle=trough;ctx.fillRect(0,450,800,510);
 // Broad tension folds running from the stitched sides into the loose centre.
 for(const side of [0,1])for(let i=0;i<7;i++){
  const v=.15+i*.115,origin=point(side,v),end=point(side===0?.18:.82,Math.min(.99,v+.17));
  ctx.beginPath();ctx.moveTo(...origin);ctx.bezierCurveTo(origin[0]+(side?-17:17),origin[1]+37,end[0]+(side?22:-22),end[1]-8,...end);
  ctx.strokeStyle='#07090c35';ctx.lineWidth=9-i*.6;ctx.stroke();
  ctx.strokeStyle='#a4a9b014';ctx.lineWidth=1.4;ctx.stroke();
 }
 // Subtle fibre grain; fixed coordinates avoid frame-to-frame shimmer.
 ctx.lineWidth=.6;
 for(let i=0;i<1500;i++){
  const u=((i*163)%1499)/1499,v=((i*431)%1499)/1499,p=point(u,v);
  ctx.strokeStyle=i%3?'#b4b9c009':'#00000010';line([p,[p[0]+2.5,p[1]+.8]]);ctx.stroke();
 }
 // Printed white lane lines follow the cloth's sag and perspective.
 ctx.lineWidth=2.5;ctx.strokeStyle='#e1e4df80';
 // One court print across the return, as on the office machine.
 const centre=.5;
 const points=[];
 for(let i=0;i<=25;i++)points.push(point(.31-i/25*.025,.03+i/25*.38));
 for(let i=0;i<=30;i++){const angle=Math.PI-i/30*Math.PI;points.push(point(centre+.215*Math.cos(angle),.41+.12*Math.sin(angle)));}
 for(let i=25;i>=0;i--)points.push(point(.69+i/25*.025,.03+i/25*.38));
 line(points);ctx.stroke();
 const lane=[point(.40,.04),point(.385,.38),point(.615,.38),point(.60,.04)];line(lane);ctx.stroke();
 line(Array.from({length:31},(_,i)=>{const a=Math.PI-i/30*Math.PI;return point(.5+.115*Math.cos(a),.38+.075*Math.sin(a));}));ctx.stroke();
 ctx.setLineDash([3,5]);line(Array.from({length:31},(_,i)=>{const a=Math.PI+i/30*Math.PI;return point(.5+.115*Math.cos(a),.38+.075*Math.sin(a));}));ctx.stroke();ctx.setLineDash([]);
 for(const side of [-1,1])for(let i=0;i<4;i++){const v=.22+i*.04,u=.5+side*(.1+.015*(v-.04)/.34);line([point(u,v),point(u+side*.017,v)]);ctx.stroke();}
 // Double-stitched hems, with an unmistakably drooping front lip.
 ctx.strokeStyle='#89909644';ctx.lineWidth=1.8;
 for(const u of [.012,.988]){line(Array.from({length:41},(_,i)=>point(u,i/40)));ctx.stroke();}
 line(Array.from({length:61},(_,i)=>point(i/60,.985)));ctx.strokeStyle='#71777e';ctx.lineWidth=2;ctx.stroke();
 ctx.restore();
}

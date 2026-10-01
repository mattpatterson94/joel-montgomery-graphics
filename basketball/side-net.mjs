// The mesh follows the side panel's perspective, rather than a screen-space grid.
export function drawSideNet(ctx){
 const corners=[[28,160],[-30,880],[26,933],[28,456]];
 const point=(u,v)=>{
  const top=[28+(-30-28)*u,160+(880-160)*u],bottom=[28+(26-28)*u,456+(933-456)*u];
  return [top[0]+(bottom[0]-top[0])*v,top[1]+(bottom[1]-top[1])*v];
 };
 const outline=()=>{ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();};
 ctx.save();outline();ctx.fillStyle='#d3dcdf05';ctx.fill();ctx.clip();
 // Crossed cords in panel coordinates: narrow diamonds at the back, longer
 // diamonds towards the lower player end, with a little cord sag.
 for(const direction of [-1,1])for(let offset=-6;offset<28;offset++){
  ctx.beginPath();let started=false;
  for(let i=0;i<=110;i++){
   const u=i/110,v=(offset-u*20)*direction/5;
   if(v<0||v>1){started=false;continue;}
   const p=point(u,v);p[1]+=Math.sin(v*Math.PI)*2;
   if(!started){ctx.moveTo(...p);started=true;}else ctx.lineTo(...p);
  }
  ctx.strokeStyle=direction===1?'#dddcd4b0':'#b9c2c5a0';ctx.lineWidth=1.4;ctx.stroke();
 }
 ctx.restore();
 ctx.save();ctx.lineJoin='round';outline();ctx.strokeStyle='#0b0c0e';ctx.lineWidth=8;ctx.stroke();
 ctx.beginPath();ctx.moveTo(28,160);ctx.lineTo(28,456);ctx.lineTo(26,933);ctx.strokeStyle='#8e9293';ctx.lineWidth=4;ctx.stroke();
 // Small ties wrap the exterior upright; none crosses the printed backboard.
 ctx.strokeStyle='#161b1d';ctx.lineWidth=5;
 for(const y of [170,260,350,445]){ctx.beginPath();ctx.moveTo(24,y);ctx.lineTo(32,y);ctx.stroke();}
 ctx.restore();
}

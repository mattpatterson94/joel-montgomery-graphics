// The mesh follows the side panel's perspective, rather than a screen-space grid.
export function drawSideNet(ctx){
 const corners=[[40,166],[7,880],[26,933],[80,456]];
 const point=(u,v)=>{
  const top=[40+(7-40)*u,166+(880-166)*u],bottom=[80+(26-80)*u,456+(933-456)*u];
  return [top[0]+(bottom[0]-top[0])*v,top[1]+(bottom[1]-top[1])*v];
 };
 const outline=()=>{ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();};
 ctx.save();outline();ctx.fillStyle='#d3dcdf05';ctx.fill();ctx.clip();
 // Crossed cords in panel coordinates: narrow diamonds at the back, longer
 // diamonds towards the lower player end, with a little cord sag.
 for(const direction of [-1,1])for(let offset=-10;offset<38;offset++){
  ctx.beginPath();let started=false;
  for(let i=0;i<=110;i++){
   const u=i/110,v=(offset-u*28)*direction/7;
   if(v<0||v>1){started=false;continue;}
   const p=point(u,v);p[1]+=Math.sin(v*Math.PI)*2;
   if(!started){ctx.moveTo(...p);started=true;}else ctx.lineTo(...p);
  }
  ctx.strokeStyle=direction===1?'#dddcd4b0':'#b9c2c5a0';ctx.lineWidth=1.4;ctx.stroke();
 }
 ctx.restore();
 ctx.save();ctx.lineJoin='round';outline();ctx.strokeStyle='#0b0c0e';ctx.lineWidth=8;ctx.stroke();
 ctx.beginPath();ctx.moveTo(40,166);ctx.lineTo(80,456);ctx.lineTo(26,933);ctx.strokeStyle='#8e9293';ctx.lineWidth=4;ctx.stroke();
 ctx.fillStyle='#25262a';ctx.beginPath();ctx.moveTo(37,165);ctx.lineTo(45,165);ctx.lineTo(55,210);ctx.lineTo(37,210);ctx.closePath();ctx.fill();
 ctx.restore();
}

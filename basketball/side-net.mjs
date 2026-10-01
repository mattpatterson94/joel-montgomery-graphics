// Side netting: straight upper rails first, then a diagonal drop into the return.
// This follows the real machine silhouette rather than a single tapered panel.
export function drawSideNet(ctx){
 const topOuter=[28,160], topInner=[125,160], dropInner=[238,430], dropOuter=[26,933];
 const point=(u,v)=>{
  // u moves from the outside frame towards the centre; v follows the depth.
  const straight = v<.32;
  if(straight){
   const t=v/.32;
   return [topOuter[0]+(topInner[0]-topOuter[0])*u, topOuter[1]+(topInner[1]-topOuter[1])*u + t*12];
  }
  const t=(v-.32)/.68;
  return [topInner[0]+(dropInner[0]-topInner[0])*u + (dropOuter[0]-topOuter[0])*(1-u)*t,
    topInner[1]+(dropInner[1]-topInner[1])*u + (dropOuter[1]-topOuter[1])*(1-u)*t];
 };
 const outline=()=>{ctx.beginPath();ctx.moveTo(28,160);ctx.lineTo(125,160);ctx.lineTo(238,430);ctx.lineTo(26,933);ctx.closePath();};
 ctx.save();outline();ctx.clip();
 for(const direction of [-1,1]){
  for(let offset=-8;offset<42;offset++){
   ctx.beginPath();let started=false;
   for(let i=0;i<=120;i++){
    const u=i/120,v=(offset+i*direction*.22)/35;
    if(v<0||v>1){started=false;continue;}
    const p=point(u,v);p[1]+=Math.sin(v*Math.PI)*2;
    if(!started){ctx.moveTo(...p);started=true}else ctx.lineTo(...p);
   }
   ctx.strokeStyle=direction===1?'#dedbd1b0':'#b8c1c2a0';ctx.lineWidth=1.35;ctx.stroke();
  }
 }
 ctx.restore();
 ctx.save();
 outline();ctx.strokeStyle='#080b0d';ctx.lineWidth=8;ctx.lineJoin='round';ctx.stroke();
 ctx.beginPath();ctx.moveTo(28,160);ctx.lineTo(125,160);ctx.lineTo(238,430);ctx.strokeStyle='#9aa19f';ctx.lineWidth=5;ctx.stroke();
 ctx.strokeStyle='#171c1d';ctx.lineWidth=5;
 for(const y of [170,220,275,340,405]){ctx.beginPath();ctx.moveTo(25,y);ctx.lineTo(31,y);ctx.stroke();}
 ctx.restore();
}

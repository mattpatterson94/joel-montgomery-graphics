import {sideNetPoint,sideNetTop,returnPoint,NET_KNEE} from './machine-geometry.mjs?v=16';
export function drawSideNet(ctx){
 const corners=[sideNetTop(0),sideNetTop(NET_KNEE),sideNetTop(1),returnPoint(0,1),returnPoint(0,0)];
 const outline=()=>{ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();};
 ctx.save();outline();ctx.clip();
 // Continuous diamond cords in panel coordinates. Both edges travel towards
 // the player; the short level top rail projects OUTWARD from the backboard.
 for(const direction of [-1,1])for(let offset=-20;offset<=24;offset++){
  ctx.beginPath();let started=false;
  for(let i=0;i<=160;i++){
   const u=i/160,v=(offset+direction*u*20)/5;
   if(v<0||v>1){started=false;continue;}
   const p=sideNetPoint(u,v);
   if(!started){ctx.moveTo(...p);started=true;}else ctx.lineTo(...p);
  }
  ctx.strokeStyle=direction===1?'#dddcd4b0':'#b9c2c5a0';ctx.lineWidth=1.3;ctx.stroke();
 }
 ctx.restore();ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 outline();ctx.strokeStyle='#121717';ctx.lineWidth=6;ctx.stroke();
 ctx.beginPath();for(const [i,p] of corners.slice(0,3).entries())i?ctx.lineTo(...p):ctx.moveTo(...p);
 ctx.strokeStyle='#868f8d';ctx.lineWidth=3;ctx.stroke();
 ctx.beginPath();ctx.moveTo(...corners[0]);ctx.lineTo(...corners[4]);ctx.lineTo(...corners[3]);ctx.strokeStyle='#747f7b';ctx.lineWidth=3;ctx.stroke();
 ctx.restore();
}

// A small software sphere renderer: surface normals are inverse-rotated into
// texture space, so panels roll around the sphere instead of rotating a flat disc.
const TW=512,TH=256;
const texture=new Uint8Array(TW*TH*3);
const colours=[[187,36,45],[235,230,215],[19,64,105],[235,230,215],[187,36,45],[235,230,215],[19,64,105],[235,230,215]];
let seed=41;
for(let y=0;y<TH;y++)for(let x=0;x<TW;x++){
  const latitude=(y/TH-.5)*Math.PI,u=x/TW*8,panel=Math.floor(u)%8;
  const longitudeEdge=Math.min(u%1,1-u%1)*Math.cos(latitude);
  const seam=longitudeEdge<.009||Math.abs(y-TH/2)<.8;
  seed=(seed*1664525+1013904223)>>>0;
  // Fine rubber pebbling is fixed to the surface and moves with its panels.
  const grain=.96+(seed/4294967296)*.065;
  const col=seam?[27,26,28]:colours[panel],index=(y*TW+x)*3;
  for(let c=0;c<3;c++)texture[index+c]=col[c]*grain;
}
function makeSurface(SIZE){
const surface=[];
for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
 const nx=(x+.5-SIZE/2)/(SIZE/2),ny=(SIZE/2-y-.5)/(SIZE/2),rr=nx*nx+ny*ny;
 if(rr>=1)continue;
 const nz=Math.sqrt(1-rr),light=Math.max(0,-.32*nx+.48*ny+.817*nz);
 surface.push({index:(y*SIZE+x)*4,x:nx,y:ny,z:nz,shade:(.5+.5*light)*(.84+.16*nz),shine:Math.pow(light,35)*19,alpha:Math.min(1,(1-Math.sqrt(rr))*SIZE)*255});
}
return surface;
}
const surfaces=new Map([[64,makeSurface(64)],[96,makeSurface(96)]]);
const rackSprites=new Map();
function sprite(size){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');return{canvas,ctx,size,pixels:ctx.createImageData(size,size),surface:surfaces.get(size),signature:''};}
function render(target,angles){
 const [pitch,yaw,roll]=angles,signature=angles.map(a=>Math.round(a*28)).join(',');
 if(signature===target.signature)return;
 target.signature=signature;
 const cx=Math.cos(pitch),sx=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw),cz=Math.cos(roll),sz=Math.sin(roll);
 const data=target.pixels.data;
 for(const p of target.surface){
  // Inverse Rz Ry Rx maps visible normals onto the spinning texture.
  const ax=cz*p.x+sz*p.y,ay=-sz*p.x+cz*p.y;
  const bx=cy*ax-sy*p.z,bz=sy*ax+cy*p.z;
  const tx=bx,ty=cx*ay+sx*bz,tz=-sx*ay+cx*bz;
  const u=((Math.atan2(tx,tz)/(2*Math.PI)+1)%1*TW)|0;
  const v=Math.min(TH-1,Math.max(0,((Math.asin(Math.max(-1,Math.min(1,ty)))/Math.PI+.5)*TH)|0));
  const offset=(v*TW+u)*3;
  for(let c=0;c<3;c++)data[p.index+c]=texture[offset+c]*p.shade+p.shine;
  data[p.index+3]=p.alpha;
 }
 target.ctx.putImageData(target.pixels,0,0);
}
export function drawBall(ctx,x,y,r,spin=[.45,.2,-.65],owner=null){
 if(r<.5)return;
 const size=r<30||innerWidth<600?64:96;
 let target;
 if(owner){if(!owner.sprite||owner.sprite.size!==size)owner.sprite=sprite(size);target=owner.sprite;}
 else{const key=size+spin.join(',');target=rackSprites.get(key);if(!target){target=sprite(size);rackSprites.set(key,target);}}
 render(target,spin);
 ctx.drawImage(target.canvas,x-r,y-r,r*2,r*2);
}

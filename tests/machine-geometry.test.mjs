import assert from 'node:assert/strict';
import {returnPoint,sideNetPoint,sideNetTop,NET_KNEE} from '../basketball/machine-geometry.mjs';
assert.deepEqual(returnPoint(0,0),[36,456]);
assert.deepEqual(returnPoint(1,0),[764,456]);
assert.ok(sideNetTop(NET_KNEE)[0]<sideNetTop(0)[0],'top rail extends outwards');
assert.equal(sideNetTop(NET_KNEE)[1],sideNetTop(0)[1],'top rail begins level');
for(let i=0;i<=100;i++){
 const u=i/100,left=returnPoint(0,u),right=returnPoint(1,u);
 assert.ok(right[0]-left[0]>=728,'fabric never narrows below the backboard width');
 const lower=sideNetPoint(u,1);
 assert.ok(Math.hypot(lower[0]-left[0],lower[1]-left[1])<1e-9,'net bottom follows the fabric edge');
 assert.deepEqual(returnPoint(0,u,18),left,'bounce keeps the side attachment fixed');
 for(let j=0;j<=100;j++){
  const point=sideNetPoint(u,j/100);
  if(point[1]<456)assert.ok(point[0]<=36,'no mesh over the backboard print');
 }
}
for(let v=0;v<=1;v+=.1){
 const a=sideNetPoint(NET_KNEE-1e-7,v),b=sideNetPoint(NET_KNEE+1e-7,v);
 assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<.001,'mesh stays continuous at the rail bend');
}
assert.ok(returnPoint(.5,.5,12)[1]>returnPoint(.5,.5)[1],'impact deforms the middle');
console.log('Full-width fabric, shared net edges, outward rails and continuous mesh passed.');

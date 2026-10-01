// The return starts at both bottom corners of the 36..764 backboard.
// Its front is wider; the net's lower edge uses this exact same surface edge.
export const RETURN_BACK_LEFT=36, RETURN_BACK_RIGHT=764;
export const RETURN_FRONT_LEFT=-12, RETURN_FRONT_RIGHT=812;
export const RETURN_BACK_Y=456, RETURN_FRONT_Y=895;
export function returnPoint(u,v,bounce=0){
 const left=RETURN_BACK_LEFT+(RETURN_FRONT_LEFT-RETURN_BACK_LEFT)*v;
 const right=RETURN_BACK_RIGHT+(RETURN_FRONT_RIGHT-RETURN_BACK_RIGHT)*v;
 const sag=Math.sin(Math.PI*u)*(32*Math.sin(Math.PI*v)+24*v+bounce*Math.sin(Math.PI*v));
 return [left+(right-left)*u,RETURN_BACK_Y+(RETURN_FRONT_Y-RETURN_BACK_Y)*v+sag];
}
export const NET_KNEE=.16;
export function sideNetTop(u){
 if(u<=NET_KNEE)return [28-36*u/NET_KNEE,160];
 const t=(u-NET_KNEE)/(1-NET_KNEE);
 return [-8-22*t,160+721*t];
}
export function sideNetPoint(u,v){
 const top=sideNetTop(u),bottom=returnPoint(0,u);
 return [top[0]+(bottom[0]-top[0])*v,top[1]+(bottom[1]-top[1])*v];
}

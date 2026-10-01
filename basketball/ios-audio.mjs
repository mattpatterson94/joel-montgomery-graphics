// iOS can report a running AudioContext while routing it through the muted
// ringer channel. A real, unmuted media element keeps the media channel active.
// The track itself is silence; never set the element's muted flag or volume=0.
export class IOSAudioChannel {
 constructor(){this.element=null;this.url=null;this.error=null;}
 get supported(){
  const nav=globalThis.navigator;
  return !!nav&&(/iP(hone|ad|od)/.test(nav.userAgent)||(/Mac/.test(nav.platform)&&nav.maxTouchPoints>1));
 }
 start(){
  if(!this.supported)return;
  if(!this.element){
   // One second of silent stereo PCM at 48 kHz, generated locally.
   const dataSize=48000*2*2,bytes=new ArrayBuffer(44+dataSize),view=new DataView(bytes);
   const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
   text(0,'RIFF');view.setUint32(4,36+dataSize,true);text(8,'WAVE');text(12,'fmt ');
   view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);
   view.setUint32(24,48000,true);view.setUint32(28,192000,true);view.setUint16(32,4,true);view.setUint16(34,16,true);
   text(36,'data');view.setUint32(40,dataSize,true);
   this.url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));
   const element=new Audio(this.url);element.loop=true;element.preload='auto';
   element.setAttribute('playsinline','');element.setAttribute('x-webkit-airplay','deny');
   this.element=element;
  }
  if(this.element.paused){
   const element=this.element;
   // Called synchronously from a tap/swipe, before any awaits or fetches.
   this.ready=element.play().then(()=>{if(this.element===element)this.error=null;},error=>{if(this.element===element)this.error=error.name;});
  }
 }
 stop(){
  // Release the media session on mute/backgrounding, including its lock-screen UI.
  const element=this.element;this.element=null;
  if(element){element.pause();element.removeAttribute('src');element.load();}
  if(this.url)URL.revokeObjectURL(this.url);
  this.url=null;this.error=null;
 }
}

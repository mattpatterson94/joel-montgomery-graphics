import assert from 'node:assert/strict';
import {CourtAudio} from '../basketball/sound.mjs';

// Exercise the mobile-only state and gesture branches without relying on a
// desktop browser to imitate an iPhone's hardware silent switch.
let requestedType,created=0,started=0,disconnected=0,resumed=0;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{audioSession:{set type(value){requestedType=value;}}}});
const context={state:'interrupted',sampleRate:48000,destination:{},
 resume(){resumed++;this.state='running';return Promise.resolve();},
 createBuffer(channels,frames,rate){assert.equal(channels,1);assert.equal(frames,1);assert.equal(rate,48000);return{};},
 createBufferSource(){created++;return{connect(){},start(){started++;this.onended();},disconnect(){disconnected++;}}}
};
const audio=new CourtAudio(context);audio.loadSamples=()=>{};
audio.unlock(true);
assert.equal(requestedType,'playback');assert.equal(resumed,1,'interrupted contexts resume on interaction');
assert.equal(started,1,'silent source starts within the gesture');assert.equal(disconnected,1);
audio.unlock(true);assert.equal(created,1,'successful priming is not repeated every touch');
context.state='suspended';audio.unlock(true);assert.equal(resumed,2,'suspended contexts also recover');
audio.enabled=false;context.state='suspended';audio.unlock(true);assert.equal(resumed,2,'mute is respected');

// If a phone still blocks activation, impacts must not queue up to play later.
audio.enabled=true;context.resume=()=>Promise.resolve();audio.play('rim');
assert.equal(audio.voices,0);assert.equal(audio.last.size,0);

// A missing/restricted Audio Session API must not block the ordinary unlock.
Object.defineProperty(navigator,'audioSession',{get(){return{set type(value){throw Error('Unsupported');}}}});
context.resume=()=>{resumed++;context.state='running';return Promise.resolve();};audio.unlock(true);assert.equal(resumed,3);
const offline=new CourtAudio({startRendering(){},state:'suspended'});offline.loadSamples=()=>{};
assert.doesNotThrow(()=>offline.unlock(),'offline sound rendering needs no activation');
console.log('Mobile audio priming, playback session, interruption recovery and mute checks passed.');

// The iPhone workaround uses a real media element and a valid silent WAV,
// releases it on mute, and retries on the next gesture after a rejected play().
const {IOSAudioChannel}=await import('../basketball/ios-audio.mjs');
navigator.userAgent='iPhone';navigator.platform='iPhone';navigator.maxTouchPoints=5;
let mediaPlays=0,mediaPauses=0,blocked=false;
globalThis.Audio=class{
 constructor(src){this.src=src;this.paused=true;this.attributes={};}
 setAttribute(name,value){this.attributes[name]=value;}
 removeAttribute(name){delete this[name];}
 play(){mediaPlays++;this.paused=blocked;if(blocked)return Promise.reject(Object.assign(Error('Blocked'),{name:'NotAllowedError'}));return Promise.resolve();}
 pause(){mediaPauses++;this.paused=true;}
 load(){}
};
const channel=new IOSAudioChannel();channel.start();
assert.equal(mediaPlays,1,'media playback starts synchronously in the gesture');
const element=channel.element,url=channel.url;
assert.equal(element.loop,true);assert.notEqual(element.muted,true);
const bytes=await(await fetch(url)).arrayBuffer(),wav=new DataView(bytes);
assert.equal(wav.getUint16(22,true),2,'stereo');assert.equal(wav.getUint32(24,true),48000,'48 kHz');
assert.equal(wav.getUint32(40,true),192000,'one second of PCM');
assert.ok(new Uint8Array(bytes,44).every(value=>value===0),'track itself is silent');
await channel.ready;channel.start();assert.equal(mediaPlays,1,'no redundant playback while running');
channel.stop();assert.equal(mediaPauses,1);assert.equal(channel.element,null);
await assert.rejects(fetch(url),'released object URL');
blocked=true;channel.start();await channel.ready;assert.equal(channel.error,'NotAllowedError');
blocked=false;channel.start();await channel.ready;assert.equal(channel.error,null,'next gesture can recover');
channel.stop();
audio.channel=channel;audio.setEnabled(true);assert.ok(channel.element);audio.setEnabled(false);assert.equal(channel.element,null,'mute releases iOS media channel');
console.log('iPhone media-channel activation, silent WAV, retry and cleanup checks passed.');

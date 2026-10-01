import assert from 'node:assert/strict';
import {CourtAudio} from '../basketball/sound.mjs';

let requestedType,created=0,started=0,disconnected=0,resumed=0;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{audioSession:{set type(value){requestedType=value;}}}});
const context={state:'suspended',currentTime:0,sampleRate:48000,destination:{},listeners:{},
 addEventListener(type,listener){this.listeners[type]=listener;},
 resume(){resumed++;this.state='running';return Promise.resolve();},
 suspend(){this.state='suspended';this.listeners.statechange?.();return Promise.resolve();},
 createBuffer(channels,frames,rate){assert.equal(channels,1);assert.equal(frames,1);assert.equal(rate,48000);return{};},
 createBufferSource(){created++;return{connect(){},start(){started++;this.onended();},disconnect(){disconnected++;}}}
};
const audio=new CourtAudio(context);audio.loadSamples=()=>{};
audio.unlock(true,'touchend');
assert.equal(requestedType,'playback');assert.equal(resumed,1);
assert.equal(started,1,'priming starts synchronously before the gesture handler returns');
assert.equal(disconnected,1);assert.match(audio.diagnostics(),/Audio: unlocked/);
assert.match(audio.diagnostics(),/Gesture: touchend/);
audio.unlock(true,'pointerdown');assert.equal(created,1,'no repeat priming once unlocked');
audio.pause();assert.match(audio.diagnostics(),/Context: suspended/);
audio.unlock(true,'touchend');assert.equal(resumed,2,'next contact resumes after backgrounding');
context.state='interrupted';context.listeners.statechange();audio.unlock(true);assert.equal(resumed,3);
audio.setEnabled(false);context.state='suspended';audio.unlock(true);assert.equal(resumed,3);
assert.match(audio.diagnostics(),/Audio: off/);

// A denied resume remains visibly locked, with the browser's error preserved.
audio.enabled=true;audio.unlocked=false;
context.resume=()=>Promise.reject(Object.assign(Error('User activation required'),{name:'NotAllowedError'}));
audio.unlock(true,'touchend');await audio.resumePromise;
assert.match(audio.diagnostics(),/resume: NotAllowedError.*User activation required/);
audio.play('rim');assert.equal(audio.voices,0);
assert.match(audio.diagnostics(),/Effects: 1 requested · 0 scheduled · 0 finished/);
assert.match(audio.diagnostics(),/blocked \(suspended\)/);

// Errors in the effect graph are visible and do not crash the game loop.
audio.playEffect=()=>{throw new TypeError('Example unsupported audio node');};
assert.doesNotThrow(()=>audio.play('board'));
assert.match(audio.diagnostics(),/effect board: TypeError.*unsupported audio node/);
assert.match(audio.diagnostics(),/Last effect: board · failed/);

// A tick cannot create audio before the user's first interaction.
const untouched=new CourtAudio();untouched.play('rim');assert.equal(untouched.context,null);
assert.match(untouched.diagnostics(),/Context: not created/);
assert.match(untouched.diagnostics(),/Last effect: rim · no context/);

// Distinguish fetch failures from decoder failures; keep successful samples.
let requests=0;
globalThis.fetch=async url=>{requests++;return{ok:!String(url).includes('rim-2'),status:404,arrayBuffer:async()=>String(url)}};
const loading=new CourtAudio({state:'suspended',startRendering(){},decodeAudioData:async value=>{
 if(value.includes('sensor-2'))throw Object.assign(Error('Invalid audio'),{name:'EncodingError'});
 return{};
}});
await loading.loadSamples();await loading.loadSamples();
assert.equal(requests,7);assert.equal(loading.samples.rim.length,1);assert.equal(loading.samples.sensor.length,1);
assert.match(loading.diagnostics(),/Files: 5\/7 decoded · 2 failed/);
assert.match(loading.diagnostics(),/sensor-2: EncodingError/);
console.log('Synchronous gesture activation, interruption recovery, visible errors, effect counters and sample loading checks passed.');

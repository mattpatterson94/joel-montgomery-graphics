import assert from 'node:assert/strict';
import {RoundAudio} from '../basketball/round-audio.mjs';

let now=0,resolveLoading;
const calls=[];
const audio={stopRoundCues(){calls.push('stop');},unlock(gesture){assert.equal(gesture,true);calls.push('unlock');},
 loadSamples(){return Promise.resolve();},play(type){calls.push(type);},error(stage,error){throw error;}};
const round=new RoundAudio(audio,()=>now);
round.start(30000);assert.deepEqual(calls,['stop','unlock']);await round.ready;
assert.deepEqual(calls,['stop','unlock','start']);
for(const seconds of [30,20,10.01,10,9.99,9,4,3,2.99,2,1,0])round.update(seconds);
assert.deepEqual(calls.slice(3),['three','countdown','countdown','countdown']);
// Returning from the background at eight seconds must not announce ten seconds.
round.start(30000);await round.ready;calls.length=0;round.update(8);assert.deepEqual(calls,[]);
round.update(1);assert.deepEqual(calls,['countdown'],'skipped beeps are not replayed');
// Only the latest restart can finish a pending startup sample load.
audio.loadSamples=()=>new Promise(resolve=>{resolveLoading=resolve;});
round.start(30000);const first=resolveLoading,firstReady=round.ready;
round.start(30000);const second=resolveLoading;
calls.length=0;first();await firstReady;assert.deepEqual(calls,[]);
second();await round.ready;assert.deepEqual(calls,['start']);
round.start(30000);now=5000;calls.length=0;resolveLoading();await round.ready;
assert.deepEqual(calls,[],'a slow request must not play the startup cue mid-round');
console.log('PASS: synchronous activation, startup, 10/3/2/1 boundaries, restart cancellation and skipped cues.');

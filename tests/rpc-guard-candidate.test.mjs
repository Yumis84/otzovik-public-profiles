import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRpcGuardCandidate} from '../runtime/rpc-guard-candidate.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
test('bounded concurrency rejects excess without starting backend or retaining input in metrics',async()=>{
 let finish,calls=0;const gate=new Promise(r=>finish=r);
 const guard=createRpcGuardCandidate({maxInFlight:1,operation:async()=>{calls++;await gate;return 'ok';}});
 const first=guard.call('secret slug');await tick();
 await assert.rejects(guard.call('another secret'),/unavailable/);assert.equal(calls,1);
 assert(!JSON.stringify(guard.metrics()).includes('secret'));
 finish();assert.equal(await first,'ok');await tick();assert.equal(guard.metrics().in_flight,0);
});
test('timeout aborts, but noncooperative backend keeps permit until it settles',async()=>{
 let finish;const gate=new Promise(r=>finish=r);let aborted=false;
 const guard=createRpcGuardCandidate({maxInFlight:1,timeoutMs:10,operation:async(_,signal)=>{signal.addEventListener('abort',()=>{aborted=true;});await gate;}});
 await assert.rejects(guard.call('x'),/unavailable/);assert(aborted);assert.equal(guard.metrics().in_flight,1);
 await assert.rejects(guard.call('x'),/unavailable/);finish();await tick();assert.equal(guard.metrics().in_flight,0);assert.equal(guard.metrics().timed_out,1);
});
test('breaker denies while open, permits one probe and recovers only after success',async()=>{
 let now=100,fail=true,calls=0,finish;
 const guard=createRpcGuardCandidate({clock:()=>now,failureThreshold:1,cooldownMs:10,operation:async()=>{calls++;if(fail)throw Error('private backend text');return await new Promise(r=>finish=r);}});
 await assert.rejects(guard.call('x'),e=>e.message==='unavailable');
 await assert.rejects(guard.call('x'),/unavailable/);assert.equal(calls,1);
 now=111;fail=false;const probe=guard.call('x');await tick();
 await assert.rejects(guard.call('x'),/unavailable/);assert.equal(calls,2);
 finish('ok');assert.equal(await probe,'ok');assert.equal(guard.metrics().succeeded,1);
});
test('a stale concurrent success cannot close a newly opened breaker',async()=>{
 let resolveSlow,now=100;
 const guard=createRpcGuardCandidate({clock:()=>now,failureThreshold:1,cooldownMs:10,operation:async(input)=>{if(input==='fail')throw Error('x');return new Promise(r=>resolveSlow=r);}});
 const slow=guard.call('slow');await tick();await assert.rejects(guard.call('fail'),/unavailable/);
 resolveSlow('ok');assert.equal(await slow,'ok');
 await assert.rejects(guard.call('third'),/unavailable/);assert.equal(guard.metrics().rejected_open,1);
});
test('timed-out half-open probe keeps exclusive probe slot while underlying work hangs',async()=>{
 let now=100,calls=0,finish;const gate=new Promise(r=>finish=r);
 const guard=createRpcGuardCandidate({clock:()=>now,failureThreshold:1,cooldownMs:10,timeoutMs:10,maxInFlight:3,operation:async()=>{calls++;if(calls===1)throw Error('failure');await gate;}});
 await assert.rejects(guard.call('first'),/unavailable/);now=111;
 await assert.rejects(guard.call('probe'),/unavailable/);now=122;
 await assert.rejects(guard.call('extra'),/unavailable/);assert.equal(calls,2);
 finish();await tick();assert.equal(guard.metrics().in_flight,0);
});
test('aborted and invalid requests fail closed',async()=>{
 const controller=new AbortController();controller.abort();
 const guard=createRpcGuardCandidate({operation:async()=>{throw Error('should not run');}});
 await assert.rejects(guard.call('x',controller.signal),/unavailable/);assert.equal(guard.metrics().accepted,0);
 assert.throws(()=>createRpcGuardCandidate({operation:()=>{},maxInFlight:0}));
});

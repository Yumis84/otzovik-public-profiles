// REVIEW CANDIDATE ONLY: not wired to routing or an authoritative backend.
// No cache, queue, caller identity, secrets, URL, slug, or logs.
export function createRpcGuardCandidate({operation,maxInFlight=8,timeoutMs=3000,failureThreshold=3,cooldownMs=10000,clock=()=>performance.now(),timer=setTimeout,cancelTimer=clearTimeout}){
 for(const [v,min,max] of [[maxInFlight,1,128],[timeoutMs,10,60000],[failureThreshold,1,100],[cooldownMs,10,300000]])if(!Number.isSafeInteger(v)||v<min||v>max)throw Error('invalid configuration');
 if(typeof operation!=='function'||typeof clock!=='function')throw Error('invalid configuration');
 let inFlight=0,failures=0,openUntil=0,probe=false,epoch=0;
 const counts={accepted:0,succeeded:0,failed:0,timed_out:0,rejected_capacity:0,rejected_open:0};
 const metrics=()=>Object.freeze({...counts,in_flight:inFlight});
 async function call(input,signal){
  if(signal?.aborted)throw Error('unavailable');
  const now=clock();if(!Number.isFinite(now))throw Error('unavailable');
  if(openUntil&&now<openUntil){counts.rejected_open++;throw Error('unavailable');}
  if(inFlight>=maxInFlight){counts.rejected_capacity++;throw Error('unavailable');}
  const halfOpen=openUntil!==0;
  if(halfOpen&&probe){counts.rejected_open++;throw Error('unavailable');}
  if(halfOpen)probe=true;
  inFlight++;counts.accepted++;const startedEpoch=epoch;
  let timeout;
  const controller=new AbortController();
  const onAbort=()=>controller.abort();signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted)controller.abort();
  const worker=Promise.resolve().then(()=>operation(input,controller.signal));
  // Keep the concurrency permit until the underlying operation actually ends,
  // including when a dependency ignores abort after timeout.
  const workerDone=()=>{inFlight--;if(halfOpen)probe=false;};
  worker.then(workerDone,workerDone);
  const deadline=new Promise((_,reject)=>{timeout=timer(()=>{controller.abort();reject(Error('timeout'));},timeoutMs);});
  try{
   const result=await Promise.race([worker,deadline]);
   if(controller.signal.aborted)throw Error('aborted');
   if(epoch===startedEpoch){failures=0;openUntil=0;}counts.succeeded++;return result;
  }catch(error){
   counts.failed++;if(error?.message==='timeout')counts.timed_out++;
   if(epoch===startedEpoch){failures++;if(halfOpen||failures>=failureThreshold){const at=clock();openUntil=Number.isFinite(at)?at+cooldownMs:Infinity;epoch++;}}
   throw Error('unavailable');
  }finally{
   cancelTimer(timeout);signal?.removeEventListener('abort',onAbort);controller.abort();
  }
 }
 return Object.freeze({call,metrics});
}

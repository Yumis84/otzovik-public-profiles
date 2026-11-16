// Review-only loopback resource bounds, not an admission/takedown guarantee.
import http from 'node:http';
function boundedInteger(value,min,max,name){
 if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('invalid '+name);
 return value;
}
export function createLimitedHandler(handler,{maxActive=32,idleTimeoutMs=15000}={}){
 if(typeof handler!=='function')throw Error('handler required');
 boundedInteger(maxActive,1,1024,'maxActive');boundedInteger(idleTimeoutMs,100,120000,'idleTimeoutMs');
 let active=0;
 return function limited(req,res){
  if(active>=maxActive){
   res.writeHead(503,{'cache-control':'no-store','content-type':'text/plain; charset=utf-8','connection':'close'});
   res.end('Unavailable');return;
  }
  active++;
  let settled=false,closed=false,released=false;
  const release=()=>{if(!released&&settled&&closed){released=true;active--;}};
  const finish=()=>{closed=true;release();};
  res.once('finish',finish);res.once('close',finish);
  // This is an inactivity limit during response writes, not a total delivery deadline.
  res.setTimeout(idleTimeoutMs,()=>res.destroy());
  Promise.resolve().then(()=>handler(req,res)).catch(()=>{
   if(!res.headersSent&&!res.destroyed){res.writeHead(503,{'cache-control':'no-store','content-type':'text/plain; charset=utf-8'});res.end('Unavailable');}
   else res.destroy();
  }).finally(()=>{settled=true;release();});
 };
}
export function createLimitedServer(handler,{maxConnections=64,...limits}={}){
 boundedInteger(maxConnections,1,4096,'maxConnections');
 const server=http.createServer(createLimitedHandler(handler,limits));
 server.maxConnections=maxConnections;
 server.headersTimeout=10000;server.requestTimeout=10000;
 return server;
}

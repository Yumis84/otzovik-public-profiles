import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createLimitedHandler,createLimitedServer} from '../runtime/http-limits.mjs';
class Response extends EventEmitter{
 constructor(){super();this.headersSent=false;this.destroyed=false;this.status=0;}
 setTimeout(ms,fn){this.timeout=ms;this.onTimeout=fn;}
 writeHead(code,headers){this.headersSent=true;this.status=code;this.headers=headers;}
 end(body){this.body=body;this.emit('finish');this.emit('close');}
 destroy(){if(!this.destroyed){this.destroyed=true;this.emit('close');}}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('concurrent work is bounded and overload response contains no private data',async()=>{
 let done;const gate=new Promise(resolve=>{done=resolve;});let calls=0;
 const limited=createLimitedHandler(async(req,res)=>{calls++;await gate;res.writeHead(200,{});res.end('public');},{maxActive:1,idleTimeoutMs:100});
 const first=new Response(),extra=new Response();limited({},first);await tick();limited({},extra);
 assert.equal(calls,1);assert.equal(extra.status,503);assert.equal(extra.body,'Unavailable');assert.equal(extra.headers['cache-control'],'no-store');
 done();await tick();assert.equal(first.status,200);
 const third=new Response();limited({},third);await tick();assert.equal(third.status,200);assert.equal(calls,2);
});
test('idle/closed connection is destroyed and slot held until handler terminates',async()=>{
 let done;const gate=new Promise(resolve=>{done=resolve;});
 const limited=createLimitedHandler(async()=>{await gate;},{maxActive:1,idleTimeoutMs:100});
 const first=new Response();limited({},first);await tick();assert.equal(first.timeout,100);first.onTimeout();assert(first.destroyed);
 const second=new Response();limited({},second);assert.equal(second.status,503);
 done();await tick();const third=new Response();limited({},third);await tick();third.destroy();
});
test('failure and client close release slots; limits reject invalid settings',async()=>{
 let calls=0;const limited=createLimitedHandler(async(req,res)=>{calls++;if(calls===1)throw Error('secret');res.writeHead(200,{});res.end('ok');},{maxActive:1,idleTimeoutMs:100});
 const a=new Response();limited({},a);await tick();assert.equal(a.status,503);assert(!a.body.includes('secret'));
 const b=new Response();limited({},b);await tick();assert.equal(b.status,200);
 assert.throws(()=>createLimitedHandler(()=>{},{maxActive:0}));
 assert.throws(()=>createLimitedServer(()=>{},{maxConnections:0}));
 const server=createLimitedServer(()=>{},{maxConnections:3});assert.equal(server.maxConnections,3);server.close();
});

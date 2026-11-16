import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import {once} from 'node:events';
import {createLimitedServer} from '../runtime/http-limits.mjs';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('real slow socket is closed on response inactivity',{timeout:5000},async()=>{
 const server=createLimitedServer((req,res)=>res.end(Buffer.alloc(8*1024*1024,97)),{maxActive:2,maxConnections:4,idleTimeoutMs:200});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const closed=new Promise(resolve=>server.once('connection',socket=>socket.once('close',resolve)));
 const client=net.connect(server.address().port,'127.0.0.1');await once(client,'connect');
 client.write('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');client.pause();
 try{
  const result=await Promise.race([closed.then(()=>true),wait(2500).then(()=>false)]);
  assert.equal(result,true,'stalled socket must close');
 }finally{client.destroy();await new Promise(resolve=>server.close(resolve));}
});
test('real concurrent requests receive 503 under saturation',{timeout:5000},async()=>{
 let entered,release;const started=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
 const server=createLimitedServer(async(req,res)=>{entered();await gate;res.end('ok');},{maxActive:1,maxConnections:4,idleTimeoutMs:1000});
 server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
 const fetchStatus=()=>new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port,path:'/',agent:false},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject);});
 try{const first=fetchStatus();await started;assert.equal(await fetchStatus(),503);release();assert.equal(await first,200);}
 finally{release();await new Promise(resolve=>server.close(resolve));}
});
test('real client disconnect eventually frees handler slot',{timeout:5000},async()=>{
 let received;const entered=new Promise(resolve=>received=resolve);
 let release;const gate=new Promise(resolve=>release=resolve);let calls=0;
 const server=createLimitedServer(async(req,res)=>{calls++;received();await gate;if(!res.destroyed)res.end('ok');},{maxActive:1,maxConnections:4,idleTimeoutMs:500});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const client=net.connect(server.address().port,'127.0.0.1');await once(client,'connect');
 client.write('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');await entered;client.destroy();release();
 try{
  await wait(80);assert.equal(calls,1);
  const next=net.connect(server.address().port,'127.0.0.1');await once(next,'connect');
  let response='';next.on('data',chunk=>{response+=chunk.toString();});
  next.write('GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');await once(next,'end');
  assert.match(response,/HTTP\/1\.1 200/);assert.equal(calls,2);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

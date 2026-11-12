// Review candidate: bind loopback only; not production routing or deployment.
import http from 'node:http';
import {createSpecialistHandler} from './specialist-public.mjs';
const port=Number(process.env.OTZOVIK_ADAPTER_PORT||'4174');
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid adapter port');
const handler=createSpecialistHandler({backendOrigin:process.env.OTZOVIK_BACKEND_ORIGIN,anonKey:process.env.OTZOVIK_PUBLIC_ANON_KEY});
const server=http.createServer(handler);server.headersTimeout=10000;server.requestTimeout=10000;
server.listen(port,'127.0.0.1',()=>console.log('Specialist adapter listening on loopback'));

// Isolated review candidate. The authoritative classifier and issuer are not implemented.
// Do not mount on production ingress.
import http from 'node:http';
import {createSpecialistHandler} from './specialist-public.mjs';
import {createSharedRouter} from './shared-router.mjs';
import {createRouteClassifier} from './route-classifier-rpc.mjs';
import {createCompanyArtifactStore} from './company-artifact-store.mjs';
const port=Number(process.env.OTZOVIK_ADAPTER_PORT||'4174');
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid adapter port');
const backendOrigin=process.env.OTZOVIK_BACKEND_ORIGIN,publicApiKey=process.env.OTZOVIK_PUBLIC_ANON_KEY;
const classify=createRouteClassifier({backendOrigin,publicApiKey,routeToken:process.env.OTZOVIK_ROUTE_READER_TOKEN});
const specialist=createSpecialistHandler({backendOrigin,anonKey:publicApiKey});
const store=await createCompanyArtifactStore({profilesRoot:process.env.OTZOVIK_PROFILES_ROOT,manifestsRoot:process.env.OTZOVIK_BINDINGS_ROOT});
const router=createSharedRouter({classify,specialist,...store});
const server=http.createServer(router);server.headersTimeout=10000;server.requestTimeout=10000;
server.listen(port,'127.0.0.1',()=>console.log('Shared adapter listening on loopback; classifier must exist'));

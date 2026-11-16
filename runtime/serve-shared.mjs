// Isolated review candidate. The authoritative classifier and issuer are not implemented.
// Do not mount on production ingress.
import {createLimitedServer} from './http-limits.mjs';
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
// Defaults bound loopback resource use for the current small isolated test;
// they do not establish a maximum takedown delay and must be tuned before use.
const server=createLimitedServer(router,{
 maxActive:Number(process.env.OTZOVIK_MAX_ACTIVE||'32'),
 maxConnections:Number(process.env.OTZOVIK_MAX_CONNECTIONS||'64'),
 idleTimeoutMs:Number(process.env.OTZOVIK_RESPONSE_IDLE_MS||'15000')
});
server.listen(port,'127.0.0.1',()=>console.log('Shared adapter listening on loopback; classifier must exist'));


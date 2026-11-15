import {test} from 'node:test';import assert from 'node:assert/strict';import {createRouteClassifier} from '../runtime/route-classifier-rpc.mjs';
const tok=role=>'x.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.x';
test('fixed route reader sends one request without client-controlled endpoint or redirects',async()=>{
 let calls=0;const c=createRouteClassifier({backendOrigin:'https://db.example',publicApiKey:'sb_publishable_test',routeToken:tok('specialist_route_reader'),fetcher:async(url,opts)=>{calls++;assert.equal(url,'https://db.example/rest/v1/rpc/resolve_public_profile_route_v1');assert.equal(opts.redirect,'manual');assert.deepEqual(JSON.parse(opts.body),{p_slug:'company-one'});return new Response(JSON.stringify({kind:'unknown',slug:'company-one'}),{status:200,headers:{'content-type':'application/json'}});}});
 assert.deepEqual(await c('company-one'),{kind:'unknown',slug:'company-one'});await assert.rejects(c('../etc'));assert.equal(calls,1);
});
test('elevated, anonymous, malformed token and unsafe backend fail closed',()=>{
 for(const role of ['anon','service_role','authenticated'])assert.throws(()=>createRouteClassifier({backendOrigin:'https://db.example',publicApiKey:'sb_publishable_test',routeToken:tok(role)}));
 assert.throws(()=>createRouteClassifier({backendOrigin:'http://db.example',publicApiKey:'sb_publishable_test',routeToken:tok('specialist_route_reader')}));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createSpecialistHandler} from '../runtime/specialist-public.mjs';
const root=process.env.OTZOVIK_CABINET_ROOT;
test('specialist page escapes hostile text and fits mobile and desktop',{skip:!root},async()=>{
 const require=createRequire(path.join(path.resolve(root),'package.json'));const {chromium}=require('playwright');
 const value={slug:'mobile-person',display_name:'<img src=x onerror=alert(1)>',profession:'Master',specialization:null,city:'Synthetic',description:'<script>window.bad=1</script> '+('оченьдлинноеслово'.repeat(30))};
 const handle=createSpecialistHandler({backendOrigin:'https://fixture.example',anonKey:'sb_publishable_synthetic',fetcher:async()=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}})});
 let body='';await handle({method:'GET',url:'/',rawHeaders:['Host','mobile-person.xn--b1ajuq0c.com']},{writeHead(){},end(x){body=x;}});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage();for(const width of [320,390,768,1280,1440]){await page.setViewportSize({width,height:900});await page.setContent(body);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow at '+width);assert.equal(await page.locator('img,script').count(),0);assert.equal(await page.evaluate(()=>window.bad),undefined);assert.match(await page.locator('h1').textContent(),/<img/);}}finally{await browser.close();}
});

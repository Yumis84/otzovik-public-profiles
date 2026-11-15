import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {createCompanyManifest} from '../runtime/company-manifest.mjs';import {createSharedRouter} from '../runtime/shared-router.mjs';
const root=process.env.OTZOVIK_CABINET_ROOT;
test('existing company artifact retains CSS, navigation and gallery under pinned CSP',{skip:!root},async()=>{
 const {chromium}=createRequire(path.join(path.resolve(root),'package.json'))('playwright');
 const profile=path.resolve('profiles/test2'),html=await fs.readFile(path.join(profile,'index.html')),css=await fs.readFile(path.join(profile,'profile.css'));
 const script=html.toString().match(/<script>([\s\S]*?)<\/script>/)?.[1];assert(script,'existing inline company behavior');const scriptHash=createHash('sha256').update(script).digest('base64');
 const files=new Map([['index.html',html],['profile.css',css]]);for(const n of await fs.readdir(path.join(profile,'media')))if(/\.(png|jpg|jpeg|webp)$/.test(n))files.set('media/'+n,await fs.readFile(path.join(profile,'media',n)));
 const id='11111111-1111-4111-8111-111111111111',slug='test2',manifest=createCompanyManifest({slug,companyId:id,version:1,files,approvedScriptHashes:[scriptHash]});
 const binding={kind:'company',slug,company_id:id,version:1,manifest_sha256:manifest.sha256};
 const router=createSharedRouter({classify:async()=>binding,readManifest:async()=>manifest.raw,readArtifact:async(_,n)=>files.get(n),specialist:async()=>{throw Error('unexpected specialist');}});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage();await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='test2.xn--b1ajuq0c.com')return route.abort();let out={};await router({method:route.request().method(),url:u.pathname+u.search,rawHeaders:['Host',u.hostname]},{writeHead:(status,headers)=>{out.status=status;out.headers=headers},end:body=>{out.body=body}});return route.fulfill({status:out.status,headers:out.headers,body:out.body});});
  for(const width of [320,390,768,1280,1440]){await page.setViewportSize({width,height:1000});await page.goto('https://test2.xn--b1ajuq0c.com/');assert.match(await page.locator('h1').first().textContent(),/Тест-2/);assert(await page.evaluate(()=>[...document.styleSheets].some(s=>s.href?.includes('profile.css'))));await page.locator('.media-open').first().click();assert(await page.locator('#media-lightbox').evaluate(e=>e.open),'gallery opens at '+width);await page.locator('.lightbox-close').click();assert(!(await page.locator('#media-lightbox').evaluate(e=>e.open)));}
 }finally{await browser.close();}
});

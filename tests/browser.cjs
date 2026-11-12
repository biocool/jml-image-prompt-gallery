// Real browser regression. Requires Playwright and a working Chromium installation.
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{const root=path.resolve(__dirname,'..'),reports=[];const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+root+'/index.html');await page.waitForTimeout(300);
if(!await page.locator('.tax-reference-card[data-origin=source]').count()||!await page.locator('.tax-reference-card[data-origin=archive]').count())throw Error('Collections not visibly merged');
await page.locator('[data-prompt-mode=available]').click();if(await page.locator('.tax-kpi strong').nth(3).textContent()!=='0')throw Error('Unknown prompts passed filter');
for(let level=1;level<=4;level++){await page.locator('[data-tax-depth="'+level+'"]').click();if(!await page.locator('.tax-branch-card').count())throw Error('Missing granularity cards')}
await page.locator('#taxonomy-reset').click();await page.locator('.tax-branch-card').first().click();if(await page.locator('.tax-breadcrumbs button').count()<2)throw Error('Drilldown');
await page.locator('#taxonomy-reset').click();await page.locator('#taxonomy-search').fill('zzzznotfound');if(await page.locator('.tax-branch-card').count())throw Error('Empty search');await page.locator('#taxonomy-reset').click();await page.locator('#taxonomy-origin').selectOption('archive');
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);if(overflow)throw Error('Horizontal overflow at '+viewport.width);
const ids=await page.evaluate(()=>window.JML_DATA.source_reviews.items.map(r=>r.id));for(const id of ids){await page.evaluate(id=>{location.hash='source/'+id},id);await page.waitForTimeout(30)}
const excludedVisible=await page.evaluate(()=>[...document.querySelectorAll('img')].some(im=>window.JML_DATA.display_policy.excluded_asset_paths.includes(im.getAttribute('src'))));
reports.push({viewport,errors,granularityLevels:4,drilldown:true,emptySearch:true,archiveFilter:true,sourceRoutes:ids.length,overflow,excludedVisible});await page.close();}
await browser.close();fs.writeFileSync(root+'/manifests/browser-tests.json',JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports,null,2));if(reports.some(r=>r.errors.length||r.overflow||r.excludedVisible))process.exit(1);})();

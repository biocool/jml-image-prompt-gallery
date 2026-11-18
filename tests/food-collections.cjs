const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs'),path=require('path');
(async()=>{const root=path.resolve(__dirname,'..'),errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=await JSDOM.fromFile(root+'/index.html',{resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};}});await new Promise(r=>dom.window.addEventListener('load',r));
const w=dom.window,doc=w.document,report={};
for(const id of ['jml-pizza-close-edited','jml-sandwich-realism-edited','2096582603633516675']){
 const s=w.JML_DATA.source_reviews.items.find(s=>s.id===id);w.location.hash='source/'+id;w.route();
 const images=[...doc.querySelectorAll('#detail .source-sample-grid img')];
 if(images.length!==s.sample_images.length)throw Error('Count mismatch '+id+': '+images.length+' vs '+s.sample_images.length);
 if(new Set(s.sample_images.map(i=>i.original)).size!==s.sample_images.length)throw Error('Duplicate original');
 for(const img of images)if(!fs.existsSync(path.join(root,img.getAttribute('src'))))throw Error('Missing '+img.src);
 report[id]={count:images.length,promptDetails:doc.querySelectorAll('#detail .image-prompt').length};
}
for(const s of w.JML_DATA.source_reviews.items){w.location.hash='source/'+s.id;w.route();if(!doc.querySelector('#detail').textContent.includes((w.JML_DATA.source_reviews.items.find(x=>x.id===s.merged_into)||s).title))throw Error('Source route '+s.id);}
if(errors.length)throw Error(errors.join('\n'));
fs.writeFileSync(root+'/manifests/food-collections-tests.json',JSON.stringify({status:'passed',collections:report,errors,limitations:'DOM checks; browser screenshot verification separate.'},null,2)+'\n');console.log(report);w.close();})();

#!/usr/bin/env python3
"""Validate local data, referenced assets, source coverage and baseline retention."""
from pathlib import Path
import json,re,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[1]
def read_content():
 data={}
 for p in sorted((ROOT/'content').glob('*.js')):
  value=p.read_text().split('] = ',1)[1].rstrip().removesuffix(';')
  data[p.stem]=json.loads(value)
 return data
def main():
 data=read_content()
 for p in list((ROOT/'content').glob('*.js'))+list((ROOT/'src').glob('*.js')):
  subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
 raw=json.dumps(data,ensure_ascii=False)
 refs=set(re.findall(r'assets/[a-zA-Z0-9_./%+-]+',raw+(ROOT/'index.html').read_text()+(ROOT/'src/gallery.css').read_text()))
 missing=sorted(x for x in refs if not (ROOT/x).is_file())
 assert not set(missing)-{'assets/social-photo.png'}-set(data.get('display_policy',{}).get('excluded_asset_paths',[])), missing
 assets=sorted(p for p in (ROOT/'assets').rglob('*') if p.is_file())
 try:
  from PIL import Image
  for p in assets:
   with Image.open(p) as image:image.verify()
  decode='passed'
 except ImportError:decode='not run (Pillow not installed)'
 integrity={str(p.relative_to(ROOT)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in assets}
 baseline=json.loads((ROOT/'manifests/baseline-assets.json').read_text())
 assert all(integrity.get(k)==v for k,v in baseline.items()),'A baseline asset was changed or removed'
 (ROOT/'manifests/asset-integrity.json').write_text(json.dumps(integrity,indent=2)+'\n')
 sources=[{'id':e['id'],'title':e['title'],'url':e.get('url'),'family':e.get('source_family'),'available_images':e.get('sample_images',[]),'missing_images':e.get('missing_images',[])} for e in data['source_reviews']['items']]
 (ROOT/'manifests/source-availability.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
 report={'asset_count':len(assets),'baseline_assets_preserved':len(baseline),'archive_images':len(data['images']),'groups':len(data['groups']),'categories':len(data['categories']),'source_entries':len(sources),'missing_source_images':sum(len(s['missing_images']) for s in sources),'missing_local_references':missing,'javascript_syntax':'passed','image_decode':decode}
 (ROOT/'manifests/validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()

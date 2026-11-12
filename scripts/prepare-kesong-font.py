"""Build local Unicode subsets from the author's Xiangcui Kesong TTF.
Usage: python scripts/prepare-kesong-font.py /path/to/font.ttf /path/to/OFL.txt
Requires fonttools and brotli. Source: https://github.com/Miiiller/Xiangcui-Kesong
"""
import sys
from fontTools.ttLib import TTFont
from fontTools import subset
from pathlib import Path
import hashlib,json,shutil
root=Path(__file__).resolve().parents[1];out=root/'public/fonts/watermark';font=TTFont(sys.argv[1]);codes=sorted(font.getBestCmap());css='/* 香萃刻宋 — Miiiller; SIL OFL 1.1. See kesong-OFL.txt. Source SHA256: '+hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest()+' */\n'
for start in range(0,len(codes),256):
 chars=codes[start:start+256];f=TTFont(sys.argv[1]);options=subset.Options();options.flavor='woff2';sub=subset.Subsetter(options=options);sub.populate(unicodes=chars);sub.subset(f);f.flavor='woff2';tmp=Path('/tmp/kesong-part.woff2');f.save(tmp);data=tmp.read_bytes();name=hashlib.sha256(data).hexdigest()[:16]+'.woff2';(out/name).write_bytes(data);css+='@font-face {font-family:"WM_kesong";src:url("/fonts/watermark/'+name+'");font-style:normal;font-weight:400;unicode-range:'+','.join('U+%X'%c for c in chars)+';}\n'
name='kesong-'+hashlib.sha256(css.encode()).hexdigest()[:12]+'.css';(out/name).write_text(css);shutil.copy(sys.argv[2],out/'kesong-OFL.txt');p=root/'src/pages/watermark/fonts/catalog.json';fonts=json.loads(p.read_text());fonts=[font for font in fonts if font['id']!='kesong'];fonts.append(dict(id='kesong',name='香萃刻宋',category='宋体',cssUrl='/fonts/watermark/'+name,metadataUrl='/fonts/watermark/'+name,source='https://github.com/Miiiller/Xiangcui-Kesong',tags='古籍刻本 雕版 刻宋 旧字形 香萃'));p.write_text(json.dumps(fonts,ensure_ascii=False,indent=2)+'\n');print('Created',len(codes),'glyphs')

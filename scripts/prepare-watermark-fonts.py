"""Bundle pinned font metadata and small real preview subsets; retain source licensing headers."""
import concurrent.futures, hashlib, json, re, time, urllib.parse, urllib.request, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/fonts/watermark'
OUT.mkdir(parents=True,exist_ok=True)
fonts=json.loads((ROOT/'src/pages/watermark/fonts/catalog.json').read_text())
def read(url):
    last=None
    for endpoint in [url,url.replace('https://cdn.jsdelivr.net/npm/','https://unpkg.com/')]*2:
        try:
            result=subprocess.run(['curl','--http1.1','-L','--fail','--compressed','--connect-timeout','6','--max-time','22','-s',urllib.parse.quote(endpoint,safe=':/@.-_%')],check=True,capture_output=True)
            return result.stdout
        except Exception as error:last=error
    raise last

def includes(value,char):
    code=ord(char)
    for part in value.split(','):
        part=part.strip().upper().removeprefix('U+')
        bounds=[part.replace('?','0'),part.replace('?','F')] if '?' in part else part.split('-')
        try:
            if int(bounds[0],16)<=code<=int(bounds[-1],16):return True
        except ValueError:pass
    return False

def build(font):
    existing=list(OUT.glob(font['id']+'-*.css'))
    if existing:return font['id'],'/fonts/watermark/'+existing[0].name,0,0
    css=read(font['cssUrl']).decode('utf-8')
    faces=re.findall(r'@font-face\s*\{([^}]+)\}',css)
    selected=set()
    sample='永和九年'
    for body in faces:
        coverage=re.search(r'unicode-range\s*:\s*([^;]+)',body,re.I)
        if coverage and not any(includes(coverage[1],char) for char in sample):continue
        urls=re.findall(r'url\(\s*[\'"]?([^\'"\s)]+)',body)
        if urls:selected.add(urllib.parse.urljoin(font['cssUrl'],urls[0]))
    local={}
    total=0
    for url in selected:
        data=read(url)
        digest=hashlib.sha256(data).hexdigest()[:16]
        filename=digest+('.woff2' if '.woff2' in url else '.woff')
        (OUT/filename).write_bytes(data)
        local[url]='/fonts/watermark/'+filename
        total+=len(data)
    def replace(match):
        url=urllib.parse.urljoin(font['cssUrl'],match[1])
        return 'url("'+local.get(url,url)+'")'
    css=re.sub(r'url\(\s*[\'"]?([^\'"\s)]+)[\'"]?\s*\)',replace,css)
    digest=hashlib.sha256(css.encode()).hexdigest()[:12]
    filename=font['id']+'-'+digest+'.css'
    (OUT/filename).write_text(css)
    return font['id'],'/fonts/watermark/'+filename,total,len(selected)

results=[]
errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    tasks={pool.submit(build,font):font for font in fonts}
    for task in concurrent.futures.as_completed(tasks):
        try:
            row=task.result();results.append(row)
            key,path,size,count=row
            next(font for font in fonts if font['id']==key)['metadataUrl']=path
            (ROOT/'src/pages/watermark/fonts/catalog.json').write_text(json.dumps(fonts,ensure_ascii=False,indent=2)+'\n')
            print(key,count,size,flush=True)
        except Exception as error:errors.append(tasks[task]['id']);print('FAILED',tasks[task]['id'],str(error),flush=True)
print('Total preview bytes',sum(row[2] for row in results))
if errors:raise SystemExit('Unfinished: '+','.join(errors))

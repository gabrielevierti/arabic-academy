"""Build static English course files with local OPUS-MT inference.
Usage: PYTHONPATH=<dependencies> python scripts/translation/translate_course.py --model <directory>
Requires ctranslate2 and sentencepiece. No runtime translation service is used.
Arabic and transliteration runs never enter the model. IDs/choice keys remain unchanged.
"""
from pathlib import Path
import argparse,json,re,time,hashlib
parser=argparse.ArgumentParser();parser.add_argument('--model',required=True);parser.add_argument('--cache',default='/tmp/arabic-course-en-cache.json');args=parser.parse_args()
import ctranslate2,sentencepiece
root=Path(__file__).resolve().parents[2];model=Path(args.model)
sp=sentencepiece.SentencePieceProcessor(model_file=str(model/'source.spm'));target=sentencepiece.SentencePieceProcessor(model_file=str(model/'target.spm'))
engine=ctranslate2.Translator(str(model),device='cpu',compute_type='int8',inter_threads=2,intra_threads=4)
# Protected Arabic includes bidi isolates and every code point, including diacritics.
protected=re.compile(r'(\u2067[^\u2069]*\u2069|[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]+(?:[ \t]+[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]+)*|[\wʾʿ’\-]*[\u0100-\u03ff\u1e00-\u1eff][\wʾʿ’\-]*|\b(?:A[012]|B[12]|C[12]|L0)(?:-[A-Z0-9]+)*\b|(?<!\w)\(?[a-z]\)|[0-9]+(?:[–—:./,-][0-9]+)*%?)',re.UNICODE)
readable={'title','text','prompt','instruction','model','explanation','rows','answers','tokens','description'}
index=json.loads((root/'data/course.json').read_text())
files={p.name:json.loads(p.read_text()) for p in sorted((root/'public/course').glob('*.json'))}
files['index.json']=index
cachepath=Path(args.cache);cache=json.loads(cachepath.read_text()) if cachepath.exists() else {}
overrides=json.loads((root/'scripts/translation/overrides.json').read_text())
cache.update(overrides)
strings=set()
def collect(v,key=''):
 if isinstance(v,dict):
  for k,x in v.items():collect(x,k)
 elif isinstance(v,list):
  for x in v:collect(x,key)
 elif isinstance(v,str) and key in readable:strings.add(v)
for d in files.values():collect(d)
# The exercise target language changes with the course; references comparing Italian
# and Arabic remain factual references to Italian.
def adapt(s):
 for a,b in [("all'italiano","all'inglese"),('all’italiano','all’inglese'),('in italiano','in inglese'),('dall’italiano','dall’inglese'),("dall'italiano","dall'inglese"),('Traduci in italiano','Traduci in inglese')]:s=s.replace(a,b)
 return s

def pieces(s):
 result=[]
 for i,part in enumerate(protected.split(s)):
  if not part:continue
  if i%2:result.append((part,False));continue
  # Newlines and sentence boundaries keep model input short without truncation.
  for x in re.split(r'(\n+|(?<=[.!?;])\s+)',part):
   if not x:continue
   leading=x[:len(x)-len(x.lstrip())];trailing=x[len(x.rstrip()):];core=x.strip()
   if not core:
    result.append((x,False));continue
   if leading:result.append((leading,False))
   if core:
    if s != core and core in {'e','o'}:
     result.append(('and' if core=='e' else 'or',False))
     if trailing:result.append((trailing,False))
     continue
    if not re.search('[A-Za-zÀ-ÿ]{2}',core) or (core in {'MSA','CEFR','PDF','ONU','UE','NATO','IPA','CV','SMS','BCE','FMI','USA','USB','ID'} or re.fullmatch(r'(?=.*\d)[A-Z0-9_./-]+',core)) or re.fullmatch(r'\(?[a-z]\)',core):result.append((core,False))
    else:
     # Split very long paragraphs at word boundaries before tokenisation.
     words=core.split(' ');chunk=[]
     for w in words:
      if chunk and len(sp.encode(' '.join(chunk+[w])))>140:
       result.append((' '.join(chunk),True));result.append((' ',False));chunk=[]
      chunk.append(w)
     if chunk:result.append((' '.join(chunk),True))
   if trailing:result.append((trailing,False))
 return result
plans={s:pieces(s) for s in strings}
segments=sorted({x for parts in plans.values() for x,yes in parts if yes and x not in cache},key=lambda x:len(sp.encode(x)))
print('Source strings',len(strings),'segments to translate',len(segments),'characters',sum(map(len,segments)),flush=True)
start=time.time()
for offset in range(0,len(segments),256):
 batch=segments[offset:offset+256]
 encoded=[sp.encode(adapt(x),out_type=str)+['</s>'] for x in batch]
 results=engine.translate_batch(encoded,beam_size=2,max_decoding_length=300,max_batch_size=64,repetition_penalty=1.05,asynchronous=True)
 results=[result.result() for result in results]
 for text,r in zip(batch,results):
  value=target.decode(r.hypotheses[0]).strip()
  if not value:
   print('UNCHANGED_EMPTY',repr(text),flush=True);value=text
  # No Arabic may be fabricated by the Italian-English model.
  value=re.sub(r'[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]','',value)
  cache[text]=value
 if offset%1024==0:
  cachepath.write_text(json.dumps(cache,ensure_ascii=False));print(offset+len(batch),'/',len(segments),'seconds',round(time.time()-start),flush=True)
cachepath.write_text(json.dumps(cache,ensure_ascii=False))
# Overrides may be updated during a long translation job; apply the latest review.
overrides=json.loads((root/'scripts/translation/overrides.json').read_text())
cache.update(overrides)
def polish(source,value):
 if re.search(r'(?i)\besercizi[oa]\s+\d',source):
  value=re.sub(r'(?i)\b(?:financial|fiscal) years?\b','Exercise',value)
 if 'vocal' in source.lower():value=re.sub(r'(?i)\b(?:vocals|voices)\b','vowels',value)
 if 'condizionale' in source.lower() and 'libertà' not in source.lower():value=re.sub(r'(?i)\bparole\b','conditional',value)
 if 'pragmatic' in source.lower():value=re.sub(r'(?i)\bpractical analysis\b','pragmatic analysis',value)
 return value
translations={s:overrides.get(s,'') or polish(s,''.join(cache[x] if yes else x for x,yes in parts)) for s,parts in plans.items()}

def transform(v,key=''):
 if isinstance(v,dict):
  d={k:transform(x,k) for k,x in v.items()}
  if v.get('type')=='table' and v.get('rows'):
   # Preserve complete transliteration columns, including plain Latin spellings.
   columns=[i for i,header in enumerate(v['rows'][0]) if 'traslitt' in header.lower()]
   for row_index,row in enumerate(v['rows'][1:],1):
    for column in columns:
     if column<len(row):d['rows'][row_index][column]=row[column]
  if 'mode' in v and 'answers' in v:
   # Input exercises accept both language variants; choice keys and Arabic stay exact.
   if v['mode']=='choice':d['answers']=v['answers']
   elif v['mode']=='input':d['answers']=list(dict.fromkeys(d['answers']+v['answers']))
  return d
 if isinstance(v,list):return [transform(x,key) for x in v]
 if isinstance(v,str) and key in readable:return translations[v]
 return v
out=root/'public/course/en';out.mkdir(exist_ok=True)
for name,doc in files.items():
 translated=transform(doc)
 translated['contentLanguage']='en';translated['translationStatus']='machine-translated'
 (out/name).write_text(json.dumps(translated,ensure_ascii=False,separators=(',',':')))
 if name=='index.json':(root/'data/course.en.json').write_text(json.dumps(translated,ensure_ascii=False,separators=(',',':')))
summary={'language':'en','method':'Local OPUS-MT Italian-English, protected Arabic/transliteration segments','files':len(files),'uniqueSourceStrings':len(strings),'translatedSegments':len(cache),'model':json.loads((model/'provenance.json').read_text()),'review':'Automated structural checks and spot checks; not a full human linguistic review.'}
(root/'data/translation-report.json').write_text(json.dumps(summary,indent=2))
print('COMPLETE',json.dumps(summary),flush=True)

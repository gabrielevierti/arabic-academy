"""Apply exact source overrides to committed English JSON; never translate Arabic."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
overrides=json.loads((root/'scripts/translation/overrides.json').read_text())
changes=[]
def walk(source,target,path='$'):
    if isinstance(source,str):
        if source in overrides and isinstance(target,str) and target!=overrides[source]:
            changes.append(path)
            return overrides[source]
    elif isinstance(source,list) and isinstance(target,list):
        return [walk(source[i],v,f'{path}[{i}]') if i<len(source) else v for i,v in enumerate(target)]
    elif isinstance(source,dict) and isinstance(target,dict):
        return {k:walk(source[k],v,path+'.'+k) if k in source else v for k,v in target.items()}
    return target
pairs=[(p,root/'public/course/en'/p.name) for p in (root/'public/course').glob('*.json')]
pairs.append((root/'data/course.json',root/'data/course.en.json'))
for src,dst in pairs:
    before=json.loads(dst.read_text());after=walk(json.loads(src.read_text()),before,str(src.relative_to(root)))
    if after!=before:dst.write_text(json.dumps(after,ensure_ascii=False,separators=(',',':'))+'\n')
(root/'reports/translation-corrections.json').write_text(json.dumps({'status':'Targeted corrections, not full human review','paths':changes},indent=2)+'\n')
print(f'Applied {len(changes)} exact source overrides')

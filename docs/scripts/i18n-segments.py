import json,re,sys,os
S='/private/tmp/claude-501/-Users-bytedance-projects-lynx-stack-docs-all-in-one/940f018a-b91e-4da2-bdb4-5c14e4908668/scratchpad/'
FENCE=re.compile(r'(```[^\n]*\n[\s\S]*?\n```)')
def segments(en):
    parts=FENCE.split(en)
    return parts  # even idx = prose, odd idx = fence
def dump(pkg):
    d=json.load(open(f'api-data/zh/{pkg}.json')); lines=[]
    for k,v in d.items():
        if v.get('text'): continue
        for i,seg in enumerate(segments(v['en'])):
            if i%2==0 and seg.strip():
                lines.append(f"{k}\t{i}\t{seg.strip().replace(chr(10),' ⏎ ')}")
    open(S+f'seg-{pkg}.tsv','w').write('\n'.join(lines)); return len(lines), sum(len(l) for l in lines)
def apply(pkg, tsv):
    d=json.load(open(f'api-data/zh/{pkg}.json'))
    tr={}
    for line in open(tsv, encoding='utf8', newline='\n'):
        if not line.strip() or line.startswith('#'): continue
        k,i,t=line.rstrip('\n').split('\t',2); tr.setdefault(k,{})[int(i)]=t.replace(' ⏎ ','\n')
    n=0
    for k,segs in tr.items():
        if k not in d or d[k].get('text'): continue
        parts=segments(d[k]['en'])
        for i,t in segs.items():
            if i<len(parts): parts[i]=('\n\n' if i>0 else '')+t+('\n\n' if i<len(parts)-1 else '')
        d[k]['text']=''.join(parts).strip(); d[k].pop('en',None); n+=1
    json.dump(d,open(f'api-data/zh/{pkg}.json','w'),indent=2,ensure_ascii=False); open(f'api-data/zh/{pkg}.json','a').write('\n')
    return n
def apply_dir(locale_dir):
    import glob
    groups={}
    for f in sorted(glob.glob(os.path.join(locale_dir,'seg-*.zh.tsv'))):
        pkg=re.sub(r'\.part\d+$','',os.path.basename(f)[4:-7])
        groups.setdefault(pkg,[]).append(f)
    for pkg,files in groups.items():
        merged=os.path.join(locale_dir,f'.merged-{pkg}.tsv')
        with open(merged,'w',encoding='utf8') as out:
            for f in files: out.write(open(f,encoding='utf8',newline='\n').read().replace('\r','').rstrip('\n')+'\n')
        print(f'{pkg:34s} applied {apply(pkg,merged)}')
        os.remove(merged)

if __name__=='__main__':
    cmd=sys.argv[1]
    if cmd=='apply-dir':
        apply_dir(sys.argv[2])
    elif cmd=='dump':
        for p in sys.argv[2:]:
            n,c=dump(p); print(f"{p:34s} {n:4d} segments {c:6d} chars")
    else:
        pkg,tsv=sys.argv[2],sys.argv[3]; print(pkg,'applied',apply(pkg,tsv))

import {useId,useRef,useState} from 'react';
import {ArrowUpRight,ChevronDown,History,Search,X} from 'lucide-react';
import {entries,filterPatchEntries,patchSize,type PatchSize} from './patchNotesData';

const latest=entries[0];
const sizeLabels:Record<PatchSize,string>={major:'큰 패치',minor:'작은 패치'};
const filters=['all','major','minor'] as const;

export function PatchNotes(){
 const dialog=useRef<HTMLDialogElement>(null),content=useRef<HTMLDivElement>(null),id=useId();
 const [unread,setUnread]=useState(()=>{try{return localStorage.getItem('valoprac-patch-seen')!==latest.version;}catch{return true;}});
 const [size,setSize]=useState<PatchSize|'all'>('all'),[query,setQuery]=useState('');
 const visible=filterPatchEntries(size,query);
 const resetScroll=()=>content.current?.scrollTo({top:0});
 const open=()=>{
  if(document.pointerLockElement)document.exitPointerLock();
  dialog.current?.showModal();setUnread(false);
  try{localStorage.setItem('valoprac-patch-seen',latest.version);}catch{/* Reading updates also works without local storage. */}
 };
 return <>
  <button className="patch-button" aria-label="패치노트 열기" aria-haspopup="dialog" title="패치노트" onClick={open}>
   <History size={19} aria-hidden="true"/>{unread&&<i aria-hidden="true"/>}
  </button>
  <dialog ref={dialog} className="patch-dialog patch-notes-dialog" aria-labelledby={`${id}-title`}>
   <header className="patch-notes-header">
    <div>
     <h2 id={`${id}-title`}>패치노트</h2>
     <p>최신 패치 <strong>{latest.version}</strong></p>
    </div>
    <button className="patch-notes-close" aria-label="패치노트 닫기" autoFocus onClick={()=>dialog.current?.close()}><X size={20} aria-hidden="true"/></button>
   </header>
   <div className="patch-notes-toolbar">
    <nav className="patch-notes-filters" aria-label="패치 규모">
     {filters.map(value=><button key={value} aria-pressed={size===value} onClick={()=>{setSize(value);resetScroll();}}>{value==='all'?'전체':sizeLabels[value]}<span>{filterPatchEntries(value).length}</span></button>)}
    </nav>
    <label className="patch-notes-search">
     <Search size={17} aria-hidden="true"/><span className="patch-notes-sr-only">패치노트 검색</span>
     <input type="search" name="patch-search" autoComplete="off" value={query} placeholder="버전 또는 내용 검색" onChange={event=>{setQuery(event.target.value);resetScroll();}}/>
    </label>
   </div>
   <div ref={content} className="patch-notes-content" role="region" aria-label="업데이트 목록" tabIndex={0}>
    <p className="patch-notes-count" role="status">{query.trim()?`검색 결과 ${visible.length}개`:`${visible.length}개의 업데이트 · 최신순`}</p>
    {visible.length===0?<div className="patch-notes-empty"><Search size={26} aria-hidden="true"/><h3>검색 결과가 없어요</h3><p>다른 단어나 버전 번호로 찾아보세요.</p><button onClick={()=>{setQuery('');setSize('all');}}>모든 업데이트 보기</button></div>:
     visible.map(entry=><details className={`patch-note${entry===latest?' patch-note-latest':''}`} key={entry.version} open={entry===latest||Boolean(query.trim())}>
      <summary>
       <span className="patch-note-heading">
        <span className="patch-note-meta"><strong>{entry.version}</strong><span>{sizeLabels[patchSize(entry.version)]}</span>{entry===latest&&<span className="patch-note-badge">최신 업데이트</span>}<time dateTime={entry.date}>{entry.date.replaceAll('-','. ')}</time></span>
        <span className="patch-note-title">{entry.title}</span>
        <span className="patch-note-description">{entry.description}</span>
       </span>
       <ChevronDown className="patch-note-chevron" size={19} aria-hidden="true"/>
      </summary>
      <ul>{entry.changes.map(change=><li key={change}>{change}</li>)}</ul>
     </details>)}
   </div>
   <footer className="patch-notes-footer">
    <details><summary>업데이트 검증 자료 <ChevronDown size={14} aria-hidden="true"/></summary><div>
     <a href="/modern-web.html" target="_blank" rel="noreferrer">12.01 웹 화면 개선과 전후 비교 <ArrowUpRight size={13} aria-hidden="true"/></a>
     <a href="/physics-materials.html" target="_blank" rel="noreferrer">12.00 물리·재질 개선과 검증 <ArrowUpRight size={13} aria-hidden="true"/></a>
     <a href="/interface-comparison.html" target="_blank" rel="noreferrer">11.00 변경 전후 화면과 검증 <ArrowUpRight size={13} aria-hidden="true"/></a>
    </div></details>
   </footer>
  </dialog>
 </>;
}

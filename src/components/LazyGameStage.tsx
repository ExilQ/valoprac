import { lazy,Suspense } from 'react';
const Stage=lazy(()=>import('./GameStage').then(m=>({default:m.GameStage})));
export function GameStage({preview=false}:{preview?:boolean}){return <Suspense fallback={<div className={`game-stage ${preview?'range-preview':''}`}><p className="stage-loading" role="status">입체 훈련장을 준비하고 있습니다…</p></div>}><Stage preview={preview}/></Suspense>;}

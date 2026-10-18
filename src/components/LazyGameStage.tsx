import { lazy, Suspense } from 'react';
const Stage = lazy(() => import('./GameStage').then(module => ({ default: module.GameStage })));
export function GameStage({ preview = false }: { preview?: boolean }) {
  return <Suspense fallback={<div className={`game-stage ${preview ? 'range-preview' : ''}`}><div className="stage-loading" role="status">입체 훈련 환경을 준비하고 있습니다…</div></div>}><Stage preview={preview} /></Suspense>;
}

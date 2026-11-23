import { useState } from 'react';
import { decodeScenario } from '../training/scenarios/codec';
import { loadDrills, updateDrill, type SavedDrill } from '../training/scenarios/library';
import type { ScenarioDefinition } from '../training/scenarios/types';

export function DrillLibrary({ onStart, onEdit }: {
  onStart: (scenario: ScenarioDefinition) => void;
  onEdit: (scenario: ScenarioDefinition) => void;
}) {
  const [drills, setDrills] = useState(loadDrills);
  const [message, setMessage] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const sorted = [...drills].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.lastPlayed - a.lastPlayed);
  function change(drill: SavedDrill, patch: Parameters<typeof updateDrill>[1]) {
    try {
      setDrills(updateDrill(drill.code, patch));
      setMessage('');
    } catch {
      setMessage('보관함을 저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.');
    }
  }
  function open(drill: SavedDrill, edit: boolean) {
    try {
      const scenario = decodeScenario(drill.code);
      if (edit) onEdit(scenario);
      else {
        change(drill, { lastPlayed: Date.now() });
        onStart(scenario);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '드릴을 열 수 없습니다.');
    }
  }
  return <section className="drill-library" aria-label="내 드릴">
    <h2>내 드릴</h2>
    {sorted.length === 0 && <p className="field-note">전술 경로나 시나리오 편집에서 드릴을 저장하면 여기에 표시됩니다.</p>}
    {sorted.map(drill => <article className="data-card drill-library-row" key={drill.code}>
      <div>
        <h3 data-locale="literal">{drill.title}</h3>
        {drill.lastPlayed > 0 && <small>최근 훈련 {new Date(drill.lastPlayed).toLocaleDateString()}</small>}
      </div>
      {pendingDelete === drill.code
        ? <div className="scenario-route-actions"><span>보관함에서 삭제할까요?</span><button type="button" onClick={() => { change(drill, null); setPendingDelete(null); }}>삭제 확인</button><button type="button" onClick={() => setPendingDelete(null)}>취소</button></div>
        : <div className="scenario-route-actions">
          <button type="button" className="secondary-button" aria-pressed={drill.favorite} onClick={() => change(drill, { favorite: !drill.favorite })}>즐겨찾기</button>
          <button type="button" className="secondary-button" onClick={() => open(drill, true)}>편집</button>
          <button type="button" className="secondary-button" onClick={() => setPendingDelete(drill.code)}>삭제</button>
          <button type="button" className="primary-button" onClick={() => open(drill, false)}>훈련 시작</button>
        </div>}
    </article>)}
    {message && <p className="inline-notice" role="status">{message}</p>}
  </section>;
}

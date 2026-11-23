import { useRef, useState } from 'react';
import type { Settings } from '../engine/types';
import { MAX_SETTINGS_FILE_BYTES, previewValorantSettings } from '../config/valorantSettingsImport';

export function ValorantSettingsImport({ settings, update }: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}) {
  const [preview, setPreview] = useState<ReturnType<typeof previewValorantSettings> | null>(null);
  const [undo, setUndo] = useState<Partial<Settings> | null>(null);
  const [message, setMessage] = useState('');
  const request = useRef(0);
  async function read(file: File) {
    const sequence = ++request.current;
    setPreview(null);
    setMessage('');
    if (file.name.toLowerCase() !== 'riotusersettings.ini' || file.size > MAX_SETTINGS_FILE_BYTES) {
      setMessage('2MB 이하의 RiotUserSettings.ini 파일을 선택하세요.');
      return;
    }
    try {
      const text = await file.text();
      if (sequence !== request.current) return;
      const candidate = previewValorantSettings(text, settings);
      setPreview(candidate);
      if (!candidate.rows.length) setMessage('이 파일에서 가져올 수 있는 설정을 찾지 못했습니다.');
    } catch {
      if (sequence === request.current) setMessage('설정 파일을 읽지 못했습니다.');
    }
  }
  return <section className="settings-card valorant-import">
    <h3>발로란트 설정 가져오기</h3>
    <p className="field-note">직접 고른 RiotUserSettings.ini의 감도와 활성 조준선을 브라우저에서 읽습니다.</p>
    <label>설정 파일 <input type="file" accept=".ini,text/plain" onChange={event => {
      const file = event.currentTarget.files?.[0];
      if (file) void read(file);
      event.currentTarget.value = '';
    }}/></label>
    {preview?.warnings.map(warning => <p className="field-note" key={warning}>{warning}</p>)}
    {preview && preview.rows.length > 0 && <>
      <ul>{preview.rows.map(row => <li key={row.label}>{row.label} · {row.from} → {row.to}</li>)}</ul>
      <div className="scenario-route-actions">
        <button type="button" className="primary-button" onClick={() => {
          const before = Object.fromEntries(Object.keys(preview.patch).map(key => [key, settings[key as keyof Settings]]));
          update(preview.patch);
          setUndo(before);
          setPreview(null);
          setMessage('선택한 설정을 적용했습니다.');
        }}>가져온 설정 적용</button>
        <button type="button" className="secondary-button" onClick={() => setPreview(null)}>취소</button>
      </div>
    </>}
    {undo && <button type="button" className="secondary-button" onClick={() => {
      update(undo); setUndo(null); setMessage('가져오기 전 설정을 복원했습니다.');
    }}>가져오기 되돌리기</button>}
    {message && <p role="status">{message}</p>}
  </section>;
}

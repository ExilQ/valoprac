import {Switch} from '@astryxdesign/core/Switch';
import {Slider} from '@astryxdesign/core/Slider';
import {Theme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import {SlidersHorizontal} from 'lucide-react';
import {useApp} from '../app/store';
import './astryx-pilot.css';

/**
 * Intentionally restricted to the General settings tab.
 * The game renderer, input loop, other settings tabs, and global navigation
 * continue to use VALOPRAC's original UI components and state.
 */
const generalToggles = [
  {key: 'showHeadshotConfirmation', label: '명중·헤드샷 확인 표시'},
  {key: 'showControlHints', label: '하단 조작 도움말 표시'},
  {key: 'practiceHud', label: '자유 훈련 사격 통계 표시'},
  {key: 'brakingHud', label: '속도와 제동 피드백 표시'},
  {key: 'showPerformance', label: '프레임 성능 표시'},
] as const;

export function AstryxGeneralSettings() {
  const settings = useApp(state => state.settings);
  const updateSettings = useApp(state => state.updateSettings);
  const setTab = useApp(state => state.setTab);

  return (
    <Theme theme={neutralTheme} mode="dark">
      <div className="settings-grid astryx-pilot-settings" data-testid="astryx-settings-pilot">
        <section className="settings-card astryx-pilot-card" aria-label="훈련 화면 설정">
          <h3><SlidersHorizontal size={18}/> 훈련 화면</h3>
          <div className="setting-readout">
            <span>인터페이스 언어</span>
            <strong>한국어</strong>
          </div>
          <div className="astryx-pilot-slider">
            <Slider
              label="훈련 정보 크기"
              description="게임 HUD의 표시 크기를 조정합니다."
              value={settings.hudScale}
              min={0.75}
              max={1.25}
              step={0.05}
              width="100%"
              valueDisplay="text"
              formatValue={(value: number) => `${value.toFixed(2)}배`}
              onChange={(value: number) => updateSettings({hudScale: value})}
            />
          </div>
          <div className="astryx-pilot-switches" role="group" aria-label="훈련 화면 표시 옵션">
            {generalToggles.map(({key, label}) => (
              <Switch
                key={key}
                label={label}
                value={settings[key]}
                onChange={checked => updateSettings({[key]: checked})}
                labelPosition="start"
                labelSpacing="spread"
                size="md"
              />
            ))}
          </div>
          <p className="field-note">자유 훈련은 시간 제한이 없습니다. 경과 시간은 위쪽에 표시되며 훈련을 종료하지 않습니다.</p>
        </section>
        <section className="settings-card astryx-pilot-card" aria-label="데이터와 렌더링 환경">
          <h3>데이터와 렌더링 환경</h3>
          <p className="field-note">설정과 기록은 이 브라우저에 저장됩니다. 계정이나 서버 업로드 없이 훈련할 수 있습니다.</p>
          <div className="setting-readout">
            <span>현재 훈련 엔진</span>
            <strong>브라우저 입체 렌더링</strong>
          </div>
          <button className="secondary-button" onClick={() => setTab('stream')}>
            언리얼 엔진 연결·검증 상태 확인
          </button>
          <p className="field-note">언리얼 모드는 별도의 GPU 실행 환경이 필요합니다. 현재 브라우저 훈련 경로는 계속 제공됩니다.</p>
        </section>
      </div>
    </Theme>
  );
}

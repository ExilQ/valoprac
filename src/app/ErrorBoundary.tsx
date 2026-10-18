import { Component, type ErrorInfo, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('VALOPRAC render failure', error, info.componentStack); }
  render() {
    if (this.state.failed) return <main className="fatal-screen" role="alert"><span className="eyebrow">발로프랙</span><h1>훈련 화면을 불러오지 못했습니다.</h1><p>화면을 다시 불러와 주세요. 저장된 설정과 훈련 기록은 그대로 유지됩니다.</p><button className="primary-button" onClick={() => window.location.reload()}>다시 불러오기</button><a href="/guide.html">조작 방법과 실행 환경 확인</a></main>;
    return this.props.children;
  }
}

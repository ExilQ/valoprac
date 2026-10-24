import { Component,type ReactNode } from 'react';
export class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error){console.error(error);}
 render(){return this.state.failed?<main style={{padding:48,maxWidth:650,margin:'auto'}}><h1>화면을 불러오지 못했습니다.</h1><p>새로고침하면 훈련장을 다시 열 수 있습니다. 이전에 저장한 기록과 설정은 유지됩니다.</p><button className="primary-button" onClick={()=>window.location.reload()}>새로고침</button></main>:this.props.children;}
}

export const RIOT_NOTICE='VALOPRAC은 라이엇 게임즈의 승인이나 후원을 받지 않는 독립 훈련 도구이며, 라이엇 게임즈 및 관계자의 견해를 대변하지 않습니다. 발로란트와 관련 상표의 권리는 Riot Games, Inc.에 있습니다.';
export function LegalNotice(){return <footer className="legal-notice"><p>{RIOT_NOTICE}</p><a href="https://www.riotgames.com/en/legal" target="_blank" rel="noreferrer">라이엇 팬 콘텐츠 정책</a><span> · 자체 제작 모델·음원 사용</span></footer>;}

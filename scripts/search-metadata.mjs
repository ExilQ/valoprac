import {readFileSync} from 'node:fs';

export const origin='https://valoprac.trade';
export const home={path:'/',title:'발로란트 에임 연습 사이트 | VALOPRAC · Valorant Aim Trainer',description:'설치 없이 시작하는 무료 발로란트 에임 연습 사이트 VALOPRAC. 헤드샷·대기샷·각체크·피킹과 톡브레이킹을 브라우저에서 연습하세요.'};
export const aim={path:'/aim.html',title:'발로란트 감도 찾기·에임 분석 | VALOPRAC',description:'VALOPRAC 감도 연구실에서 DPI, eDPI, cm/360을 확인하고 플릭·추적·클릭 타이밍 과제로 후보 감도를 같은 조건에서 비교하세요.'};
export const guides=[
 {path:'/valorant-aim-trainer.html',title:'발로란트 에임 연습 사이트 | 무료 Valorant Aim Trainer — VALOPRAC',description:'설치 없이 시작하는 발로란트 에임 연습 사이트 VALOPRAC. 무료 Valorant aim trainer에서 헤드샷, 플릭, 추적, 톡브레이킹·피킹과 감도 비교를 연습하세요.'},
 {path:'/guide.html',title:'발로란트 에임 연습 사용법·조작 방법 | VALOPRAC',description:'VALOPRAC의 키보드·마우스 조작, 무기 선택, 표적 설정과 자유·시간제 에임 연습 방법을 확인하세요.'},
 {path:'/aim-methodology.html',title:'발로란트 감도 찾기·에임 분석의 측정 방법 | VALOPRAC',description:'감도 후보 비교, 플릭·추적 과제, 에임 분석 지표와 불확실성을 설명합니다. VALOPRAC의 측정 방법, 공개 검증 근거와 한계를 확인하세요.'},
 {path:'/footsteps.html',title:'발로란트 발소리·걷기·브레이킹 연습 | VALOPRAC',description:'VALOPRAC에서 달리기·걷기·브레이킹에 따른 발소리 게이지와 잠입 연습 방법을 확인하세요. 훈련 모델의 추정값과 한계도 안내합니다.'},
 {path:'/tactical-guide.html',title:'발로란트 피킹·톡브레이킹·반동 연습 | VALOPRAC',description:'VALOPRAC의 발로란트 스타일 피킹·각체크, 톡브레이킹, 정조준, 반동·월샷·공중 이동 훈련 방법과 시뮬레이션 검증 현황을 확인하세요.'}
];
// Only the public homepage is eligible for search results. Guides remain usable.
export const indexedPages=[home];
export const contentPages=[home,...guides,aim];
export function withIndexingPolicy(html,indexable=false){
 const tag=`<meta name="robots" content="${indexable?'index,follow,max-image-preview:large':'noindex,follow'}">`;
 const pattern=/<meta\b[^>]*name=["']robots["'][^>]*>/i;
 return pattern.test(html)?html.replace(pattern,tag):html.replace('</head>',tag+'</head>');
}
export const escapeHTML=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function introduction(){
 const content=JSON.parse(readFileSync('src/content/search.json','utf8'));
 return `<main data-search-intro class="site-intro"><h1>${escapeHTML(content.heading)}</h1><p>${escapeHTML(content.description)}</p><p>${escapeHTML(content.detail)}</p><h2>${escapeHTML(content.holdAngle.heading)}</h2><p>${escapeHTML(content.holdAngle.description)}</p><nav aria-label="훈련 안내"><a href="/training">바로 훈련 시작</a>${content.links.map(link=>`<a href="${link.href}">${escapeHTML(link.label)}</a>`).join('')}</nav><noscript><p>실제 사격 훈련에는 자바스크립트가 필요합니다. 훈련 안내는 위 링크에서 계속 읽을 수 있습니다.</p></noscript></main>`;
}
export function decorate(html,page){
 const canonical=origin+page.path;
 html=html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${escapeHTML(page.title)}</title>`);
 const meta=(attribute,name,value)=>{
  const pattern=new RegExp(`<meta\\b[^>]*\\b${attribute}=["']${name}["'][^>]*>`,'i');
  const tag=`<meta ${attribute}="${name}" content="${escapeHTML(value)}">`;
  html=pattern.test(html)?html.replace(pattern,tag):html.replace('</head>',tag+'</head>');
 };
 for(const [name,value] of Object.entries({description:page.description,'twitter:card':'summary_large_image','twitter:title':page.title,'twitter:description':page.description,'twitter:image':origin+'/social-card.png'}))meta('name',name,value);
 html=withIndexingPolicy(html,page.path==='/');
 for(const [name,value] of Object.entries({'og:type':'website','og:locale':'ko_KR','og:site_name':'VALOPRAC','og:title':page.title,'og:description':page.description,'og:url':canonical,'og:image':origin+'/social-card.png','og:image:width':'1200','og:image:height':'630'}))meta('property',name,value);
 const link=`<link rel="canonical" href="${canonical}">`;
 html=/<link\b[^>]*rel=["']canonical["'][^>]*>/i.test(html)?html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/i,link):html.replace('</head>',link+'</head>');
 const graph=[
  {'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:'VALOPRAC',alternateName:'발로프랙',inLanguage:'ko-KR'},
  {'@type':'WebApplication','@id':origin+'/#application',url:origin+'/',name:'VALOPRAC',alternateName:'VALOPRAC Valorant Aim Trainer',applicationCategory:'GameApplication',operatingSystem:'Web browser',inLanguage:'ko-KR',isAccessibleForFree:true,description:home.description,browserRequirements:'JavaScript, WebGL, keyboard and mouse',offers:{'@type':'Offer',price:'0',priceCurrency:'KRW'}},
  {'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:page.title,description:page.description,inLanguage:'ko-KR',isPartOf:{'@id':origin+'/#website'},...(page.path==='/'||page.path==='/valorant-aim-trainer.html'?{mainEntity:{'@id':origin+'/#application'}}:{})}
 ];
 if(page.path!=='/')graph.push({'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'VALOPRAC',item:origin+'/'},{'@type':'ListItem',position:2,name:page.title.split(' | ')[0],item:canonical}]});
 const data=`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c')}</script>`;
 html=/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i.test(html)?html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i,data):html.replace('</head>',data+'</head>');
 return html;
}

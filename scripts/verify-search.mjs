import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {indexedPages,contentPages,origin} from './search-metadata.mjs';

const root='dist-client';
const sitemap=readFileSync(root+'/sitemap.xml','utf8');
const listed=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
assert.deepEqual([...listed].sort(),indexedPages.map(page=>origin+page.path).sort(),'Sitemap must list each canonical content page exactly once');
assert.deepEqual(listed,[origin+'/'],'Only the main homepage may appear in the sitemap');
for(const page of contentPages){
 const html=readFileSync(root+(page.path==='/'?'/index.html':page.path),'utf8');
 assert(html.includes(`<link rel="canonical" href="${origin+page.path}">`),page.path+' canonical');
 assert(html.includes(`<title>${page.title}</title>`),page.path+' title');
 assert(html.includes(page.description),page.path+' description');
 assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length,1,page.path+' must have one useful main heading');
 assert(html.includes(`<meta name="robots" content="${page.path==='/'?'index,follow,max-image-preview:large':'noindex,follow'}">`),page.path+' homepage-only search policy');
 const scripts=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1,page.path+' structured data');
 const data=JSON.parse(scripts[0][1]);
 const document=data['@graph'].find(item=>item['@type']==='WebPage');
 assert.equal(document.url,origin+page.path);
 assert.equal(data['@graph'].find(item=>item['@type']==='WebSite').name,'VALOPRAC');
 assert(!html.includes('aggregateRating'),'Do not publish unsupported review scores');
 assert(/<a\s[^>]*href="\/(?:valorant-aim-trainer\.html|aim-methodology\.html|guide\.html|training)/.test(html),page.path+' crawlable links');
 assert(!/\b(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/.test(html.match(/<main data-search-intro[\s\S]*?<\/main>/)?.[0]??''),'Introductory text must remain visible without JavaScript');
}
let excludedDocuments=0;
function verifyExcluded(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){
 const file=join(directory,entry.name);
 if(entry.isDirectory())verifyExcluded(file);
 else if(entry.name.endsWith('.html')&&file!==root+'/index.html'){
  const document=readFileSync(file,'utf8');
  if(document.includes('</head>'))assert(document.includes('<meta name="robots" content="noindex,follow">'),file+' must be excluded');
  else assert(/^google-site-verification: google[a-f0-9]+\.html\s*$/.test(document),'Only an official verification file may lack an HTML head');
  excludedDocuments++;
 }
}}
verifyExcluded(root);
const home=readFileSync(root+'/index.html','utf8');
for(const term of ['발로란트 에임 연습 사이트','Valorant aim trainer','바로 훈련 시작','발로란트 대기샷 연습'])assert(home.includes(term),'Homepage HTML must contain '+term);
const landing=readFileSync(root+'/valorant-aim-trainer.html','utf8');
for(const term of ['Valorant aim training','10분 에임 연습 루틴','톡브레이킹','무료','Riot Games'])assert(landing.includes(term),'Training introduction must explain '+term);
for(const match of landing.matchAll(/href="(\/[^"?#]*)/g))assert(match[1]==='/'||match[1]==='/training'||match[1]==='/aim.html'||existsSync(root+match[1]),'Broken introduction link '+match[1]);
const verification=JSON.parse(readFileSync('deployment/search-discovery.json','utf8'));
const key=readFileSync(root+'/'+verification.indexNowKeyFile,'utf8').trim();
assert(/^[a-f0-9]{32}$/.test(key));assert.equal(verification.indexNowKeyFile,key+'.txt');
const robots=readFileSync(root+'/robots.txt','utf8');assert(/User-agent: GPTBot\s+Disallow: \//.test(robots));assert(/User-agent: OAI-SearchBot\s+Allow: \//.test(robots));
console.log(JSON.stringify({searchVerified:true,indexablePages:indexedPages.length,excludedDocuments,structuredData:true,htmlContentWithoutJavaScript:true,crawlableLinks:true,indexNowVerificationFile:true,trainingOptOutPreserved:true}));

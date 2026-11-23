import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
const html=readFileSync('dist/index.html','utf8');
// The production static host resolves concrete documents, not Pages rewrite rules.
// Export every client entry route while retaining the same SPA and absolute asset URLs.
for(const route of ['training','settings','statistics','results','weapons','unreal','aim']){
 mkdirSync(`dist/${route}`,{recursive:true});
 writeFileSync(`dist/${route}/index.html`,html);
 writeFileSync(`dist/${route}.html`,html);
}

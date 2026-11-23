import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
const html=readFileSync('dist-client/index.html','utf8');
// The production static host resolves concrete documents, not Pages rewrite rules.
// Export every client entry route while retaining the same SPA and absolute asset URLs.
for(const route of ['training','settings','statistics','results','weapons','unreal','aim']){
 mkdirSync(`dist-client/${route}`,{recursive:true});
 writeFileSync(`dist-client/${route}/index.html`,html);
 writeFileSync(`dist-client/${route}.html`,html);
}

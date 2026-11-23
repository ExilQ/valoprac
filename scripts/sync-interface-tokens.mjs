import {readFileSync,writeFileSync} from 'node:fs';
// Static guides and the application consume the same authoritative theme tokens.
writeFileSync('public/precision-tokens.css',readFileSync('src/ui/tokens.css','utf8'));

const bootstrap=readFileSync('src/ui/theme/bootstrap.ts','utf8').match(/THEME_BOOTSTRAP_SCRIPT=(".*");/);
if(!bootstrap)throw new Error('Theme bootstrap source missing');
writeFileSync('public/interface-theme.js',JSON.parse(bootstrap[1])+'\n');

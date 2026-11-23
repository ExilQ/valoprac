import {getLocale,translateText} from './locale';

function children(value:unknown):unknown{
 if(typeof value==='string')return translateText(value);
 if(!Array.isArray(value))return value;
 const result:unknown[]=[];let pending='';
 const flush=()=>{if(pending){result.push(translateText(pending));pending='';}};
 for(const child of value){if(typeof child==='string'||typeof child==='number')pending+=String(child);else{flush();result.push(Array.isArray(child)?children(child):child);}}flush();return result;
}
/** Only actual DOM text/accessible labels are localized. Component arguments,
 * form values, event handlers, keys, URLs and executable/data strings are intact. */
export function localizedHostProps(type:unknown,props:unknown):unknown{
 if(getLocale()==='ko'||!props||typeof props!=='object')return props;
 // Fragments contain presentation text too. Function-component arguments stay
 // untouched so translating a label cannot change a component's data logic.
 if(type===Symbol.for('react.fragment')){const raw=props as Record<string,unknown>;return 'children'in raw?{...raw,children:children(raw.children)}:props;}
 if(typeof type!=='string')return props;
 const raw=props as Record<string,unknown>,next={...raw};
 if(raw['data-locale']==='literal'||type==='code'||type==='pre')return props;
 if('children'in raw)next.children=children(raw.children);
 for(const key of ['title','aria-label','aria-description','aria-valuetext','placeholder','alt'])if(typeof raw[key]==='string')next[key]=translateText(raw[key] as string);
 return next;
}

import type {ButtonHTMLAttributes,HTMLAttributes,ReactNode} from 'react';
import {useRef} from 'react';

export function Button({variant='primary',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'quiet'}){return <button type="button" {...props} className={`utility-button utility-button-${variant} ${className}`}/>;}
export function IconButton({label,children,className='',...props}:Omit<ButtonHTMLAttributes<HTMLButtonElement>,'aria-label'>&{label:string;children:ReactNode}){return <button type="button" {...props} aria-label={label} title={props.title??label} className={`utility-icon-button ${className}`}>{children}</button>;}
export function Panel({className='',...props}:HTMLAttributes<HTMLElement>){return <section {...props} className={`utility-panel ${className}`}/>;}
/** Roving focus supports keyboard selection without adding navigation screens. */
export function Tabs<T extends string>({items,value,onChange,label,prefix,panelId,className=''}:{items:readonly{id:T;label:string}[];value:T;onChange:(value:T)=>void;label:string;prefix:string;panelId:string;className?:string}){
 const refs=useRef<(HTMLButtonElement|null)[]>([]);
 return <div role="tablist" aria-label={label} className={`utility-tabs ${className}`}>{items.map((item,index)=><button type="button" role="tab" key={item.id} id={`${prefix}-${item.id}`} aria-controls={panelId} aria-selected={value===item.id} tabIndex={value===item.id?0:-1} ref={node=>{refs.current[index]=node;}} onClick={()=>onChange(item.id)} onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%items.length:event.key==='ArrowLeft'?(index+items.length-1)%items.length:event.key==='Home'?0:event.key==='End'?items.length-1:-1;if(next>=0){event.preventDefault();onChange(items[next].id);refs.current[next]?.focus();}}}>{item.label}</button>)}</div>;
}

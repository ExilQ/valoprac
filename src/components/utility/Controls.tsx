import type {ButtonHTMLAttributes,HTMLAttributes,KeyboardEvent,ReactNode} from 'react';
import {useEffect,useRef,useState} from 'react';

export function Button({variant='primary',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'quiet'}){return <button type="button" {...props} className={`utility-button utility-button-${variant} ${className}`}/>;}
export function IconButton({label,children,className='',...props}:Omit<ButtonHTMLAttributes<HTMLButtonElement>,'aria-label'>&{label:string;children:ReactNode}){return <button type="button" {...props} aria-label={label} title={props.title??label} className={`utility-icon-button ${className}`}>{children}</button>;}
export function Panel({className='',...props}:HTMLAttributes<HTMLElement>){return <section {...props} className={`utility-panel ${className}`}/>;}
type TabItem<T extends string>={id:T;label:string};

interface TabsProps<T extends string> {
 items:readonly TabItem<T>[];
 value:T;
 onChange:(value:T)=>void;
 label:string;
 prefix:string;
 className?:string;
 orientation?:'horizontal'|'vertical';
 activation?:'automatic'|'manual';
}

function revealHorizontalTab(strip:HTMLElement,button:HTMLElement) {
 const left=strip.getBoundingClientRect().left+strip.clientLeft;
 const right=left+strip.clientWidth;
 const bounds=button.getBoundingClientRect();
 if(bounds.left<left)strip.scrollLeft+=bounds.left-left;
 else if(bounds.right>right)strip.scrollLeft+=bounds.right-right;
}

/** Native buttons with one tab stop and keyboard navigation matching the visual axis. */
export function Tabs<T extends string>({
 items,value,onChange,label,prefix,className='',orientation='horizontal',activation='automatic'
}:TabsProps<T>) {
 const strip=useRef<HTMLDivElement>(null);
 const [focused,setFocused]=useState<T|null>(null);
 useEffect(()=>{
  const element=strip.current;
  const selected=element?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
  if(orientation==='horizontal'&&element&&selected)revealHorizontalTab(element,selected);
 },[orientation,value]);

 function moveFocus(event:KeyboardEvent<HTMLButtonElement>,index:number) {
  const previous=orientation==='vertical'?'ArrowUp':'ArrowLeft';
  const following=orientation==='vertical'?'ArrowDown':'ArrowRight';
  let next:number;
  if(event.key==='Home')next=0;
  else if(event.key==='End')next=items.length-1;
  else if(event.key===previous)next=(index+items.length-1)%items.length;
  else if(event.key===following)next=(index+1)%items.length;
  else return;

  event.preventDefault();
  const element=strip.current;
  const button=element?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
  if(!element||!button)return;
  if(activation==='automatic')onChange(items[next].id);
  button.focus({preventScroll:orientation==='horizontal'});
  if(orientation==='horizontal')revealHorizontalTab(element,button);
 }

 return <div ref={strip} role="tablist" aria-label={label} aria-orientation={orientation}
  className={`utility-tabs ${className}`}
  onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(null);}}>
  {items.map((item,index)=><button type="button" role="tab" key={item.id} id={`${prefix}-${item.id}`}
   aria-selected={value===item.id} tabIndex={(focused??value)===item.id?0:-1}
   onFocus={()=>setFocused(item.id)} onClick={()=>onChange(item.id)}
   onKeyDown={event=>moveFocus(event,index)}>
   {item.label}
  </button>)}
 </div>;
}

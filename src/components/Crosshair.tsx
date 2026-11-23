import type {Settings,WeaponId} from '../engine/types';
import type {CSSProperties} from 'react';
import {activeCrosshair,type CrosshairDesign,type CrosshairLine} from '../config/crosshair';
import './crosshair.css';
function Lines({line,color,design,kind}:{line:CrosshairLine;color:string;design:CrosshairDesign;kind:string}){
 if(!line.enabled||line.length<=0||line.opacity<=0)return null;
 const t=line.thickness,l=line.length,rects=[{className:'reticle-up',x:-t/2,y:-l,width:t,height:l},{className:'reticle-down',x:-t/2,y:0,width:t,height:l},{className:'reticle-left',x:-l,y:-t/2,width:l,height:t},{className:'reticle-right',x:0,y:-t/2,width:l,height:t}];
 return <g className={`reticle-lines reticle-${kind}`} style={{'--line-gap':`${line.gap}px`} as CSSProperties} opacity={line.opacity}>{rects.map(r=><g key={r.className} className={r.className}>{design.outline&&design.outlineThickness>0&&<rect {...r} className="reticle-outline" fill="none" stroke="#081017" strokeWidth={design.outlineThickness*2} strokeOpacity={design.outlineOpacity}/>}<rect {...r} className="reticle-fill" fill={color}/></g>)}</g>;
}
export function Crosshair({settings,preview=false,hit=false,ads=false,weapon='rifleA'}:{settings:Settings;preview?:boolean;hit?:boolean;ads?:boolean;weapon?:WeaponId}){
 if(!preview&&settings.crosshairAdvanced?.weaponVisibility[weapon]===false)return null;
 const d=activeCrosshair(settings,ads),style={'--reticle-motion-gap':settings.dynamicCrosshair&&!preview?'var(--movement-gap,0px)':'0px'} as CSSProperties;
 return <div className={`crosshair advanced-crosshair ${preview?'crosshair-preview':''} ${hit?'crosshair-hit':''} ${ads?'advanced-ads-crosshair':''}`} style={style} data-reticle-context={ads?'ads':'primary'} aria-hidden="true"><svg className="reticle-svg" viewBox="-60 -60 120 120" width="120" height="120"><Lines line={d.outer} color={d.color} design={d} kind="outer"/><Lines line={d.inner} color={d.color} design={d} kind="inner"/>{d.centerDot&&d.centerOpacity>0&&<g opacity={d.centerOpacity}>{d.outline&&d.outlineThickness>0&&(<rect className="reticle-outline" x={-d.centerSize/2} y={-d.centerSize/2} width={d.centerSize} height={d.centerSize} fill="none" stroke="#081017" strokeWidth={d.outlineThickness*2} strokeOpacity={d.outlineOpacity}/>)}{<rect className="reticle-dot" x={-d.centerSize/2} y={-d.centerSize/2} width={d.centerSize} height={d.centerSize} fill={d.color}/>}</g>}</svg></div>;
}

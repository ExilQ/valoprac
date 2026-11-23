import type { Settings } from '../engine/types';
import type { CSSProperties } from 'react';
export function Crosshair({settings,preview=false,hit=false,ads=false}:{settings:Settings;preview?:boolean;hit?:boolean;ads?:boolean}){
  const style={'--ads-dot':`${settings.adsDotSize}px`,'--cross-color':settings.crosshairColor,'--cross-thickness':`${settings.crosshairThickness}px`,'--cross-gap':`${settings.crosshairGap}px`,'--cross-length':`${settings.crosshairLength}px`} as CSSProperties;
  return <div className={`crosshair ${preview?'crosshair-preview':''} ${hit?'crosshair-hit':''} ${ads?'ads-crosshair':''}`} style={style} aria-hidden="true"><i className="cross-line top"/><i className="cross-line bottom"/><i className="cross-line left"/><i className="cross-line right"/><b/></div>;
}

import type { Settings } from '../engine/types';
import type { CSSProperties } from 'react';
export function Crosshair({settings,preview=false,hit=false}:{settings:Settings;preview?:boolean;hit?:boolean}){
  const style={'--cross-color':settings.crosshairColor,'--cross-thickness':`${settings.crosshairThickness}px`,'--cross-gap':`${settings.crosshairGap}px`,'--cross-length':`${settings.crosshairLength}px`} as CSSProperties;
  return <div className={`crosshair ${preview?'crosshair-preview':''} ${hit?'crosshair-hit':''}`} style={style} aria-hidden="true"><i className="cross-line top"/><i className="cross-line bottom"/><i className="cross-line left"/><i className="cross-line right"/><b/></div>;
}

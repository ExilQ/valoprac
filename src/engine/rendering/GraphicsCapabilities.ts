export interface GraphicsCapabilities {
 kind:'software'|'integrated'|'hardware'|'unknown';renderer:string;reason:string;recommendLow:boolean;
 /** Device-name classification is advisory, not a measured frame-rate result. */
 heuristic:boolean;
}
export function classifyGraphicsRenderer(renderer:string):GraphicsCapabilities {
 const name=renderer.trim().slice(0,300);
 if(/swiftshader|llvmpipe|softpipe|swrast|software(?:\s+\w+){0,3}\s+(?:rasterizer|renderer)|microsoft basic render|gdi generic/i.test(name))return {kind:'software',renderer:name,reason:'소프트웨어 렌더러가 보고되었습니다. CPU로 그래픽을 처리할 수 있어 낮음 설정을 권장합니다.',recommendLow:true,heuristic:false};
 if(/intel(?:\(r\))?.*(?:\buhd\b|\bhd\b|\biris\b)|radeon.*vega\s*(?:[1-9]|1[01])\b|radeon\(tm\) graphics|\badreno\b|\bmali[-\s]/i.test(name))return {kind:'integrated',renderer:name,reason:'보고된 장치 이름이 내장·모바일 그래픽 계열과 일치합니다. 이름에 따른 추정이며 실제 성능 측정은 아닙니다.',recommendLow:true,heuristic:true};
 if(!name||/^(?:webgl(?:\s+\d)?|webkit webgl|angle|unknown|unavailable)$/i.test(name))return {kind:'unknown',renderer:name||'정보 비공개',reason:'브라우저가 상세 그래픽 장치 정보를 제공하지 않아 자동 분류하지 않았습니다.',recommendLow:false,heuristic:true};
 return {kind:'hardware',renderer:name,reason:'하드웨어 렌더러 이름이 보고되었습니다. 실제 프레임 성능은 별도로 확인해야 합니다.',recommendLow:false,heuristic:true};
}
export function detectGraphicsCapabilities(gl:WebGLRenderingContext|WebGL2RenderingContext):GraphicsCapabilities {
 try {
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  const name=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  return classifyGraphicsRenderer(typeof name==='string'?name:'');
 }catch{return classifyGraphicsRenderer('');}
}

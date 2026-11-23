export interface StreamingConfig {schema:1;enabled:boolean;allocatorUrl:string|null;signallingHosts:string[];engineVersion:string;infrastructureCommit:string;}
export function validateStreamingConfig(raw:unknown):StreamingConfig {
 if(!raw||typeof raw!=='object')throw new Error('엔진 연결 설정을 읽지 못했습니다.');const c=raw as StreamingConfig;
 if(c.schema!==1||typeof c.enabled!=='boolean'||!Array.isArray(c.signallingHosts)||!c.signallingHosts.every(x=>typeof x==='string'&&/^[a-z0-9.-]+$/.test(x)))throw new Error('엔진 연결 설정 형식이 올바르지 않습니다.');
 if(c.enabled){const u=new URL(c.allocatorUrl??'');if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!c.signallingHosts.length)throw new Error('안전한 GPU 연결 주소가 필요합니다.');}
 return c;
}
export function validateSignalUrl(url:string,c:StreamingConfig){const u=new URL(url);if(u.protocol!=='wss:'||u.username||u.password||u.search||u.hash||!c.signallingHosts.includes(u.hostname))throw new Error('허용하지 않은 스트리밍 서버입니다.');return u.href;}

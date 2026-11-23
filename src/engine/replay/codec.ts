import {MAX_REPLAY_COMPRESSED_BYTES,MAX_REPLAY_DECOMPRESSED_BYTES,ReplayError,type ReplayRecording} from './types';
import {validateReplay} from './validation';
export {MAX_REPLAY_COMPRESSED_BYTES,MAX_REPLAY_DECOMPRESSED_BYTES,ONE_MINUTE_REPLAY_TARGET_BYTES} from './types';
async function boundedStream(stream:ReadableStream<Uint8Array>,limit:number){
 const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new ReplayError('리플레이 압축 해제 크기가 한도를 넘습니다.');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}return result;
}
/** File format: UTF-8 JSON in standard gzip, no executable code or dependencies. */
export async function encodeReplay(recording:ReplayRecording):Promise<Uint8Array>{
 validateReplay(recording);if(typeof CompressionStream==='undefined')throw new ReplayError('이 브라우저는 리플레이 압축을 지원하지 않습니다. 최신 데스크톱 브라우저를 사용하세요.');
 const bytes=new TextEncoder().encode(JSON.stringify(recording));if(bytes.length>MAX_REPLAY_DECOMPRESSED_BYTES)throw new ReplayError('리플레이 원본 크기가 기록 한도를 넘습니다.');
 return boundedStream(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),MAX_REPLAY_COMPRESSED_BYTES);
}
export async function decodeReplay(bytes:Uint8Array):Promise<ReplayRecording>{
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_REPLAY_COMPRESSED_BYTES||bytes[0]!==31||bytes[1]!==139)throw new ReplayError('유효한 gzip 리플레이 파일이 아니거나2MB 한도를 넘습니다.');
 if(typeof DecompressionStream==='undefined')throw new ReplayError('이 브라우저는 리플레이 압축 해제를 지원하지 않습니다.');
 try{const input=Uint8Array.from(bytes),plain=await boundedStream(new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip')),MAX_REPLAY_DECOMPRESSED_BYTES),raw:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));validateReplay(raw);return raw;}
 catch(error){if(error instanceof ReplayError)throw error;throw new ReplayError('리플레이 파일이 손상됐거나 지원하는 형식이 아닙니다.');}
}

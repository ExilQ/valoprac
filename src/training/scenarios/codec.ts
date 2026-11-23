import {MAX_SCENARIO_BYTES,SCENARIO_CODE_PREFIX,ScenarioError,type ScenarioDefinition} from './types';
import {validateScenario} from './validation';

export const MAX_SCENARIO_CODE_LENGTH=SCENARIO_CODE_PREFIX.length+Math.ceil(MAX_SCENARIO_BYTES/3)*4;
const SHARE_ORIGIN='https://valoprac.trade/tools.html';
const poison=new Set(['__proto__','prototype','constructor']);
function fail(message='유효한 시나리오 공유 코드가 아닙니다.'):never{throw new ScenarioError(message);}
function base64url(bytes:Uint8Array){
 let binary='';for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192));
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function bytesFromCode(payload:string){
 if(!payload||!/^[A-Za-z0-9_-]+$/.test(payload)||payload.length%4===1)fail();
 let binary:string;try{binary=atob(payload.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-payload.length%4)%4));}catch{fail();}
 if(binary.length>MAX_SCENARIO_BYTES)fail('시나리오 데이터는 24KB 이하여야 합니다.');
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 // Refuse alternate encodings with non-zero unused tail bits.
 if(base64url(bytes)!==payload)fail();return bytes;
}

/** UTF-8 JSON in unpadded base64url. No executable payload or external service. */
export function encodeScenario(definition:ScenarioDefinition):string{
 const canonical=validateScenario(definition),bytes=new TextEncoder().encode(JSON.stringify(canonical));
 if(bytes.length>MAX_SCENARIO_BYTES)fail('시나리오 데이터는 24KB 이하여야 합니다.');
 return SCENARIO_CODE_PREFIX+base64url(bytes);
}
export function decodeScenario(raw:unknown):ScenarioDefinition{
 if(typeof raw!=='string'||raw.length>MAX_SCENARIO_CODE_LENGTH+128)fail('시나리오 공유 코드가 비어 있거나 길이 한도를 넘습니다.');
 const code=raw.trim();if(!code.startsWith(SCENARIO_CODE_PREFIX)||code.length>MAX_SCENARIO_CODE_LENGTH)fail('VP-S1 형식의 시나리오 공유 코드를 입력하세요.');
 try{
  const bytes=bytesFromCode(code.slice(SCENARIO_CODE_PREFIX.length));
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  const value:unknown=JSON.parse(text,(key,value)=>{if(poison.has(key))fail('허용하지 않는 시나리오 항목입니다.');return value;});
  return validateScenario(value);
 }catch(error){if(error instanceof ScenarioError)throw error;fail();}
}

function shareURL(raw:unknown){
 if(typeof raw!=='string'||raw.length>MAX_SCENARIO_CODE_LENGTH+4096)fail('공유 주소가 너무 길거나 올바르지 않습니다.');
 let url:URL;try{url=new URL(raw,SHARE_ORIGIN);}catch{fail('공유 주소가 올바르지 않습니다.');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)fail('HTTP 또는 HTTPS 공유 주소를 사용하세요.');
 return url;
}
/** Fragment storage avoids sending the scenario payload in the HTTP request. */
export function scenarioURL(definition:ScenarioDefinition,base=SHARE_ORIGIN):string{
 const url=shareURL(base);url.search='';url.hash=new URLSearchParams({scenario:encodeScenario(definition)}).toString();return url.toString();
}
/** Reads data only. It never navigates to or fetches the supplied address. */
export function scenarioCodeFromURL(raw:unknown):string|null{
 const url=shareURL(raw),query=url.searchParams.getAll('scenario'),fragment=new URLSearchParams(url.hash.slice(1)).getAll('scenario'),values=[...query,...fragment];
 if(!values.length)return null;if(values.length!==1)fail('하나의 시나리오만 포함한 공유 주소를 사용하세요.');
 return encodeScenario(decodeScenario(values[0]));
}

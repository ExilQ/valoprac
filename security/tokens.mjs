const encoder=new TextEncoder();
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function decode(text){if(!/^[A-Za-z0-9_-]+$/.test(text))throw Error('token encoding');const raw=atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function tokenKey(secret){if(typeof secret!=='string'||secret.length<32)throw Error('Admission secret is not configured');return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signToken(secret,payload){const body=encode(encoder.encode(JSON.stringify(payload))),key=await tokenKey(secret);return body+'.'+encode(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(body))));}
export async function verifyToken(secret,token){
 try{if(typeof token!=='string'||token.length>2048)return null;const parts=token.split('.');if(parts.length!==2)return null;const key=await tokenKey(secret);if(!await crypto.subtle.verify('HMAC',key,decode(parts[1]),encoder.encode(parts[0])))return null;const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[0])));return value&&typeof value==='object'&&!Array.isArray(value)?value:null;}catch{return null;}
}
export async function privateDigest(secret,text){const key=await tokenKey(secret);return encode(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(text))));}
export function bearer(request){const value=request.headers?.get?request.headers.get('authorization'):request.headers?.authorization;return typeof value==='string'&&value.startsWith('Bearer ')?value.slice(7):'';}
export function validLifetime(claims,now,maxSeconds){return Number.isSafeInteger(claims.iat)&&Number.isSafeInteger(claims.exp)&&claims.iat<=now&&claims.exp>now&&claims.exp>claims.iat&&claims.exp-claims.iat<=maxSeconds;}

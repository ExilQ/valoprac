import {signToken,privateDigest} from '../security/tokens.mjs';
const admissionOrigin='https://valoprac.trade';
export function admissionReply(status,body=null){return new Response(body===null?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'}});}
export function validAdmissionRequest(request){return new URL(request.url).origin===admissionOrigin&&request.headers.get('origin')===admissionOrigin&&request.headers.get('sec-fetch-site')==='same-origin';}
export async function handleGPUGrant(request,env={}){
 if(request.method!=='POST')return admissionReply(405);
 if(!validAdmissionRequest(request))return admissionReply(403);
 // These identity headers are supplied/overwritten by Sites dispatch, never by the browser.
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return admissionReply(401);
 const allowed=String(env.VALOPRAC_GPU_ALLOWED_USERS??'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!allowed.includes(user))return admissionReply(403);
 const secret=env.VALOPRAC_GPU_GRANT_SECRET,audience=env.VALOPRAC_GPU_ORIGIN;
 try{
  if(typeof secret!=='string'||secret.length<32||!audience||new URL(audience).origin!==audience||!audience.startsWith('https://'))return admissionReply(503);
  const now=Math.floor(Date.now()/1000),subject=await privateDigest(secret,'gpu-user:'+user);
  const token=await signToken(secret,{v:1,typ:'gpu-allocation',aud:audience,sub:subject,jti:crypto.randomUUID(),iat:now,exp:now+60});
  return admissionReply(200,{token,expiresAt:(now+60)*1000});
 }catch{return admissionReply(503);}
}

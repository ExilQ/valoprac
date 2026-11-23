import {bearer,verifyToken,validLifetime} from '../../security/tokens.mjs';
export function createAllocationAdmission({secret,audience,now=Date.now}){
 if(typeof secret!=='string'||secret.length<32)throw Error('A private GPU grant verification key is required');
 if(!audience||new URL(audience).origin!==audience||!audience.startsWith('https://'))throw Error('GPU grant audience must be the public HTTPS origin');
 const spent=new Map();
 return async request=>{
  const time=Math.floor(now()/1000),claims=await verifyToken(secret,bearer(request));
  if(!claims||claims.v!==1||claims.typ!=='gpu-allocation'||claims.aud!==audience||!validLifetime(claims,time,60)||typeof claims.sub!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(claims.sub)||typeof claims.jti!=='string'||!/^[a-f0-9-]{36}$/.test(claims.jti))return null;
  for(const [key,expiry]of spent)if(expiry<=time)spent.delete(key);
  if(spent.has(claims.jti)||spent.size>=4096)return null;
  // Consume synchronously before allocation; concurrent retries cannot share a grant.
  spent.set(claims.jti,claims.exp);return {subject:claims.sub};
 };
}

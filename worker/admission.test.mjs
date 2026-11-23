import test from 'node:test';
import assert from 'node:assert/strict';
import {handleGPUGrant} from './admission.js';
import {verifyToken} from '../security/tokens.mjs';
const origin='https://valoprac.trade',audience='https://gpu-staging.valoprac.trade',secret='test-only-gpu-grant-not-a-live-secret-1234567890';
const env={VALOPRAC_GPU_GRANT_SECRET:secret,VALOPRAC_GPU_ORIGIN:audience,VALOPRAC_GPU_ALLOWED_USERS:'approved-fixture-user'};
const request=headers=>new Request(origin+'/api/gpu/grant',{method:'POST',headers:{origin,'sec-fetch-site':'same-origin',...headers}});
test('GPU grants require a platform identity and an explicit approval, with no anonymous fallback',async()=>{
 assert.equal((await handleGPUGrant(request({}),env)).status,401);
 assert.equal((await handleGPUGrant(request({'oai-authenticated-user-id':'other-user'}),env)).status,403);
 assert.equal((await handleGPUGrant(request({'oai-authenticated-user-id':'approved-fixture-user'}),{...env,VALOPRAC_GPU_ALLOWED_USERS:''})).status,403);
 assert.equal((await handleGPUGrant(request({'oai-authenticated-user-id':'approved-fixture-user',origin:'https://evil.example'}),env)).status,403);
});
test('an approved tester receives a scoped, expiring grant without exposing the user ID',async()=>{
 const response=await handleGPUGrant(request({'oai-authenticated-user-id':'approved-fixture-user'}),env);assert.equal(response.status,200);
 const {token}=await response.json(),claims=await verifyToken(secret,token);assert.equal(claims.typ,'gpu-allocation');assert.equal(claims.aud,audience);assert.equal(claims.exp-claims.iat,60);assert.equal(claims.sub.length,43);assert(!JSON.stringify(claims).includes('approved-fixture-user'));
 const broken={...env,VALOPRAC_GPU_GRANT_SECRET:''};assert.equal((await handleGPUGrant(request({'oai-authenticated-user-id':'approved-fixture-user'}),broken)).status,503);
});

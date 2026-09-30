import crypto from 'node:crypto';
import { config } from './config.mjs';
import { normalizeEmail, nowIso } from './utils.mjs';

const SESSION_COOKIE='dws_sid';
const OAUTH_STATE_COOKIE='dws_oauth_state';

function parseCookies(req){const out={};for(const part of String(req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)out[decodeURIComponent(part.slice(0,i).trim())]=decodeURIComponent(part.slice(i+1).trim());}return out;}
function appendSetCookie(res,value){const current=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',current?[...(Array.isArray(current)?current:[current]),value]:value);}
function cookieString(name,value,{maxAge,httpOnly=true,sameSite='Lax'}={}){const parts=[`${encodeURIComponent(name)}=${encodeURIComponent(value)}`,'Path=/',`SameSite=${sameSite}`];if(httpOnly)parts.push('HttpOnly');if(config.cookieSecure)parts.push('Secure');if(maxAge!=null)parts.push(`Max-Age=${Math.max(0,Math.floor(maxAge))}`);return parts.join('; ');}
function hashToken(token){return crypto.createHash('sha256').update(String(token)).digest('hex');}
function hmac(value){return crypto.createHmac('sha256',config.sessionSecret).update(value).digest('base64url');}
function signState(value){return `${value}.${hmac(value)}`;}
function verifyState(signed){const i=String(signed||'').lastIndexOf('.');if(i<1)return'';const value=signed.slice(0,i),sig=signed.slice(i+1),expected=hmac(value);const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length)return'';return crypto.timingSafeEqual(a,b)?value:'';}
function encryptionKey(){if(config.sessionEncryptionKey&&/^[0-9a-f]{64}$/i.test(config.sessionEncryptionKey))return Buffer.from(config.sessionEncryptionKey,'hex');return crypto.scryptSync(config.sessionSecret,'dws-session-token',32);}
function seal(value){if(!value)return'';const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv),ct=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]),tag=cipher.getAuthTag();return Buffer.concat([iv,tag,ct]).toString('base64url');}
function open(value){if(!value)return'';try{const b=Buffer.from(value,'base64url'),iv=b.subarray(0,12),tag=b.subarray(12,28),ct=b.subarray(28),dec=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),iv);dec.setAuthTag(tag);return Buffer.concat([dec.update(ct),dec.final()]).toString('utf8');}catch{return'';}}

export class AuthManager {
  constructor(store){this.store=store;}
  async identity(req){
    if(config.authMode==='dev')return{email:config.devUserEmail,name:config.devUserName,session:null};
    const sid=parseCookies(req)[SESSION_COOKIE];if(!sid)return null;const row=this.store.sessionGet(hashToken(sid));if(!row||row.SessionExpiresAt<nowIso()){if(row)this.store.sessionDelete(hashToken(sid));return null;}return{email:normalizeEmail(row.Email),name:row.Name||'',session:row};
  }
  async googleAccessToken(req){
    if(config.authMode!=='google')return'';const sid=parseCookies(req)[SESSION_COOKIE];if(!sid)return'';const row=this.store.sessionGet(hashToken(sid));if(!row)return'';let access=open(row.AccessTokenCipher);if(row.TokenExpiresAt&&row.TokenExpiresAt>new Date(Date.now()+60_000).toISOString())return access;const refresh=open(row.RefreshTokenCipher);if(!refresh)return access;
    const body=new URLSearchParams({client_id:config.googleClientId,client_secret:config.googleClientSecret,refresh_token:refresh,grant_type:'refresh_token'});const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(!r.ok)return access;const t=await r.json();access=t.access_token||access;const now=new Date(),updated={...row,AccessTokenCipher:seal(access),TokenExpiresAt:new Date(now.getTime()+(Number(t.expires_in)||3600)*1000).toISOString(),UpdatedAt:now.toISOString()};this.store.sessionPut(updated);return access;
  }
  async handle(req,res,url){
    if(url.pathname==='/auth/login'){
      if(config.authMode==='dev'){res.statusCode=302;res.setHeader('Location','/');res.end();return true;}
      const state=crypto.randomBytes(24).toString('base64url'),signed=signState(`${state}:${Date.now()}`);appendSetCookie(res,cookieString(OAUTH_STATE_COOKIE,signed,{maxAge:600}));const scope=['openid','email','profile'];if(config.googleSheetsScope)scope.push('https://www.googleapis.com/auth/spreadsheets.readonly');const q=new URLSearchParams({client_id:config.googleClientId,redirect_uri:config.googleRedirectUri,response_type:'code',scope:scope.join(' '),state,access_type:'offline',prompt:'consent',include_granted_scopes:'true'});res.statusCode=302;res.setHeader('Location',`https://accounts.google.com/o/oauth2/v2/auth?${q}`);res.end();return true;
    }
    if(url.pathname==='/auth/google/callback'){
      const signed=parseCookies(req)[OAUTH_STATE_COOKIE],verified=verifyState(signed),[savedState,savedAt]=verified.split(':');appendSetCookie(res,cookieString(OAUTH_STATE_COOKIE,'',{maxAge:0}));if(!savedState||savedState!==url.searchParams.get('state')||Date.now()-Number(savedAt)>600_000){res.statusCode=400;res.end('Invalid or expired OAuth state.');return true;}const code=url.searchParams.get('code');if(!code){res.statusCode=400;res.end('Google authorization did not return a code.');return true;}
      const body=new URLSearchParams({code,client_id:config.googleClientId,client_secret:config.googleClientSecret,redirect_uri:config.googleRedirectUri,grant_type:'authorization_code'});const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(!tr.ok){res.statusCode=502;res.end('Google token exchange failed.');return true;}const tokens=await tr.json();const ur=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`}});if(!ur.ok){res.statusCode=502;res.end('Google user profile lookup failed.');return true;}const profile=await ur.json();if(!profile.email||profile.email_verified===false){res.statusCode=403;res.end('A verified Google email is required.');return true;}
      const rawSid=crypto.randomBytes(32).toString('base64url'),now=new Date(),expires=new Date(now.getTime()+config.sessionTtlHours*3600_000);this.store.sessionPut({SessionHash:hashToken(rawSid),Email:normalizeEmail(profile.email),Name:profile.name||profile.email,AccessTokenCipher:seal(tokens.access_token||''),RefreshTokenCipher:seal(tokens.refresh_token||''),TokenExpiresAt:new Date(now.getTime()+(Number(tokens.expires_in)||3600)*1000).toISOString(),SessionExpiresAt:expires.toISOString(),CreatedAt:now.toISOString(),UpdatedAt:now.toISOString()});appendSetCookie(res,cookieString(SESSION_COOKIE,rawSid,{maxAge:config.sessionTtlHours*3600}));res.statusCode=302;res.setHeader('Location','/');res.end();return true;
    }
    if(url.pathname==='/auth/logout'){
      const sid=parseCookies(req)[SESSION_COOKIE];if(sid)this.store.sessionDelete(hashToken(sid));appendSetCookie(res,cookieString(SESSION_COOKIE,'',{maxAge:0}));res.statusCode=302;res.setHeader('Location','/');res.end();return true;
    }
    return false;
  }
}

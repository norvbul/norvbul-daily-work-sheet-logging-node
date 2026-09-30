import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.mjs';
import { Store } from './db.mjs';
import { DwsService } from './service.mjs';
import { AuthManager } from './auth.mjs';
import { APP_VERSION } from './schema.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicDir=path.join(root,'public');
const store=new Store();
store.seed({bootstrapAdminEmail:config.bootstrapAdminEmail||(config.authMode==='dev'?config.devUserEmail:''),bootstrapAdminName:config.bootstrapAdminName||(config.authMode==='dev'?config.devUserName:'')});
const service=new DwsService(store);const auth=new AuthManager(store);

const RPC={
  getSessionData:({user})=>service.getSessionData(user),
  saveWorksheet:({user,args})=>service.saveWorksheet(user,args[0]),
  getWorksheet:({user,args})=>service.getWorksheet(user,args[0]),
  deleteWorksheet:({user,args})=>service.deleteWorksheet(user,args[0]),
  importBulkRows:({user,args})=>service.importBulkRows(user,args[0],args[1]),
  importGoogleSheet:async({user,args,req})=>service.importGoogleSheet(user,args[0],args[1],await auth.googleAccessToken(req)),
  getTemplateData:({user,args})=>service.getTemplateData(user,args[0]),
  getDashboardData:({user,args})=>service.getDashboardData(user,args[0]),
  getReportData:({user,args})=>service.getReportData(user,args[0],args[1]),
  getAiInsights:({user,args})=>service.getAiInsights(user,args[0]),
  getAdminData:({user,args})=>service.getAdminData(user,args[0]),
  saveAdminRecord:({user,args})=>service.saveAdminRecord(user,args[0],args[1]),
  deleteAdminRecord:({user,args})=>service.deleteAdminRecord(user,args[0],args[1]),
  updateExceptionReview:({user,args})=>service.updateExceptionReview(user,args[0],args[1],args[2]),
  upgradeLegalContent:({user})=>service.upgradeLegalContent(user),
  getApplicationDatabaseInfo:({user})=>service.getApplicationDatabaseInfo(user),
  getApplicationSpreadsheetInfo:({user})=>service.getApplicationDatabaseInfo(user)
};

function securityHeaders(res){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com data:; img-src 'self' data: blob:; connect-src 'self' https://oauth2.googleapis.com https://openidconnect.googleapis.com https://sheets.googleapis.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://accounts.google.com");if(config.cookieSecure)res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');}
function json(res,status,obj){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(obj));}
function contentType(file){return file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/octet-stream';}
async function bodyJson(req){let total=0,chunks=[];for await(const chunk of req){total+=chunk.length;if(total>config.maxRpcBodyBytes)throw Object.assign(new Error('Request body is too large.'),{statusCode:413});chunks.push(chunk);}return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).origin===new URL(config.appBaseUrl).origin;}catch{return false;}}
async function userFor(req){const identity=await auth.identity(req);if(!identity)return null;return service.getUserByEmail(identity.email);}

const server=http.createServer(async(req,res)=>{securityHeaders(res);const url=new URL(req.url,config.appBaseUrl);try{
  if(await auth.handle(req,res,url))return;
  if(url.pathname==='/api/health'){return json(res,200,{ok:true,version:APP_VERSION,time:new Date().toISOString(),database:'sqlite'});}
  if(url.pathname==='/api/version')return json(res,200,{version:APP_VERSION});
  if(url.pathname==='/api/rpc'&&req.method==='POST'){
    if(!sameOrigin(req))return json(res,403,{ok:false,error:{message:'Cross-origin request rejected.'}});const identity=await auth.identity(req);if(!identity)return json(res,401,{ok:false,error:{message:'Authentication required.',code:'AUTH_REQUIRED'}});let user;try{user=service.getUserByEmail(identity.email);}catch(e){return json(res,403,{ok:false,error:{message:e.message,code:'ACCESS_DENIED'}});}const body=await bodyJson(req),method=String(body.method||''),args=Array.isArray(body.args)?body.args:[];const fn=RPC[method];if(!fn)return json(res,404,{ok:false,error:{message:`Unknown RPC method: ${method}`,code:'RPC_NOT_FOUND'}});try{const data=await fn({user,args,req,identity});return json(res,200,{ok:true,data});}catch(e){console.error(`[RPC ${method}]`,e);return json(res,e.statusCode||400,{ok:false,error:{message:e.message||'Request failed.',code:e.code||'RPC_FAILED'}});}
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{ok:false,error:{message:'Method not allowed.'}});
  let filePath=url.pathname==='/'?path.join(publicDir,'index.html'):path.join(publicDir,url.pathname.replace(/^\/+/,''));if(!filePath.startsWith(publicDir))return json(res,403,{ok:false,error:{message:'Forbidden.'}});if(!fs.existsSync(filePath)||fs.statSync(filePath).isDirectory()){filePath=path.join(publicDir,'index.html');}res.statusCode=200;res.setHeader('Content-Type',contentType(filePath));res.setHeader('Cache-Control',filePath.endsWith('index.html')?'no-store':'public, max-age=3600');if(req.method==='HEAD')return res.end();fs.createReadStream(filePath).pipe(res);
}catch(e){console.error('[HTTP]',e);json(res,e.statusCode||500,{ok:false,error:{message:e.message||'Internal server error.'}});}});

server.listen(config.port,config.host,()=>{console.log(`Daily Work Sheet Logging v${APP_VERSION} listening on ${config.host}:${config.port}`);console.log(`Database: ${config.databasePath}`);console.log(`Auth mode: ${config.authMode}`);});

function shutdown(signal){console.log(`${signal}: shutting down`);server.close(()=>{try{store.close();}catch{}process.exit(0);});setTimeout(()=>process.exit(1),10_000).unref();}
process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));

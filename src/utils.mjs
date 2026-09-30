import crypto from 'node:crypto';

export function newId(prefix='ID') { return `${prefix}-${crypto.randomUUID()}`; }
export function nowIso() { return new Date().toISOString(); }
export function cleanString(v) { return v == null ? '' : String(v).trim(); }
export function normalizeEmail(v) { return cleanString(v).toLowerCase(); }
export function displayNameFromEmail(email) { return cleanString(email).split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
export function truthy(v) { return v === true || ['true','yes','1','y','active'].includes(String(v||'').toLowerCase()); }
export function num(v,fallback=0) { const n=Number(v); return Number.isFinite(n)?n:fallback; }
export function round2(n) { return Math.round((Number(n)||0)*100)/100; }
export function sum(rows,field) { return (rows||[]).reduce((a,r)=>a+num(r[field],0),0); }
export function averageNumeric(values) { const x=(values||[]).map(Number).filter(Number.isFinite); return x.length?round2(x.reduce((a,b)=>a+b,0)/x.length):0; }
export function cleanTime(value) { const p=parseFlexibleTime(cleanString(value)); return p ? `${String(p.h).padStart(2,'0')}:${String(p.m).padStart(2,'0')}` : ''; }
export function parseFlexibleTime(s) {
  if (!s) return null;
  const x=String(s).trim();
  let m=x.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?$/i);
  if (!m) return null;
  let h=Number(m[1]), min=Number(m[2]); if (min>59) return null;
  const ap=(m[3]||'').toUpperCase();
  if (ap) { if(h<1||h>12)return null; if(ap==='AM'&&h===12)h=0; if(ap==='PM'&&h<12)h+=12; }
  else if(h>23) return null;
  return {h,m:min};
}
export function timeToMinutes(value) { const p=parseFlexibleTime(cleanString(value)); return p ? p.h*60+p.m : null; }
export function normalizeImportedTime(value) {
  if (typeof value === 'number' && Number.isFinite(value)) { const total=Math.round((((value%1)+1)%1)*1440)%1440; return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`; }
  return cleanTime(value);
}
export function normalizeDateString(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const s=String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d=new Date(s); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
}
export function validateDate(value) {
  const d=normalizeDateString(value); if(!d) throw new Error('Date Worked is missing or invalid.');
  const m=d.match(/^(\d{4})-(\d{2})-(\d{2})$/); const y=+m[1], mo=+m[2], day=+m[3]; const x=new Date(Date.UTC(y,mo-1,day));
  if(x.getUTCFullYear()!==y||x.getUTCMonth()!==mo-1||x.getUTCDate()!==day) throw new Error(`Date Worked is not a valid calendar date: ${d}`);
  const today=new Date().toISOString().slice(0,10); if(d>today) throw new Error(`Date Worked cannot be later than today: ${d}`); return d;
}
export function hasAnyJobData(job) { return Object.values(job||{}).some(v=>cleanString(v)!==''); }
export function normalizeHeader(s) { return cleanString(s).toLowerCase().replace(/[^a-z0-9]/g,''); }
export function stringifySafe(v) { try{return JSON.stringify(v??'');}catch{return String(v??'');} }
export function formatMinutesText(minutes) { const n=Math.round(num(minutes,0)); if(n<60)return `${n} min`; return `${Math.floor(n/60)}h ${n%60}m`; }
export function escapeHtml(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function normalizeIdentityText(v) { return cleanString(v).toUpperCase(); }
export function mergeDelimitedValues(values, separator) {
  const seen=new Set(), out=[];
  for(const value of values||[]) {
    const parts=separator===', ' ? cleanString(value).split(',') : cleanString(value).split(separator);
    for(const part of parts){const item=cleanString(part); if(!item)continue; const k=item.toUpperCase(); if(!seen.has(k)){seen.add(k);out.push(item);}}
  }
  return out.join(separator);
}
export function sortByOrder(orderField,nameField){return(a,b)=>{const ao=num(a[orderField],9999),bo=num(b[orderField],9999);return ao!==bo?ao-bo:String(a[nameField]||'').localeCompare(String(b[nameField]||''));};}
export function findByIdOrName(rows,value,idField,nameField){const s=cleanString(value);return (rows||[]).find(r=>String(r[idField])===s)|| (rows||[]).find(r=>cleanString(r[nameField]).toLowerCase()===s.toLowerCase()) || null;}
export function extractSpreadsheetId(source){const s=cleanString(source);const m=s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);return m?m[1]:(/^[a-zA-Z0-9-_]{20,}$/.test(s)?s:'');}
export function sanitizeAdminValue(header,value){if(header==='Active')return truthy(value);if(['SortOrder'].includes(header))return num(value,0);return cleanString(value);}

import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCHEMA, PRIMARY_KEYS, NUMERIC_COLUMNS, BOOLEAN_COLUMNS,
  DEFAULT_SETTINGS, DEFAULT_PARISHES, DEFAULT_SHIFTS, DEFAULT_WORK_TYPES,
  LEGAL_CONTENT_VERSION
} from './schema.mjs';
import { config } from './config.mjs';

function q(name) { return `"${String(name).replaceAll('"','""')}"`; }
function columnType(name) {
  if (BOOLEAN_COLUMNS.has(name)) return 'INTEGER';
  if (NUMERIC_COLUMNS.has(name)) return 'REAL';
  return 'TEXT';
}
function toDbValue(name, value) {
  if (value === undefined || value === null) return '';
  if (BOOLEAN_COLUMNS.has(name)) return value === true || ['true','1','yes','y','active'].includes(String(value).toLowerCase()) ? 1 : 0;
  if (NUMERIC_COLUMNS.has(name)) {
    if (value === '') return '';
    const n = Number(value); return Number.isFinite(n) ? n : '';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
function fromDbRow(row) {
  if (!row) return row;
  const out = {};
  for (const [k,v] of Object.entries(row)) {
    if (BOOLEAN_COLUMNS.has(k)) out[k] = Boolean(v);
    else out[k] = v ?? '';
  }
  return out;
}

export class Store {
  constructor(dbPath = config.databasePath) {
    this.dbPath = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;');
    this.ensureSchema();
  }

  ensureSchema() {
    for (const [table, columns] of Object.entries(SCHEMA)) {
      const pk = PRIMARY_KEYS[table];
      const defs = columns.map(c => `${q(c)} ${columnType(c)}${c === pk ? ' PRIMARY KEY' : ''}`).join(', ');
      this.db.exec(`CREATE TABLE IF NOT EXISTS ${q(table)} (${defs})`);
      const existing = new Set(this.db.prepare(`PRAGMA table_info(${q(table)})`).all().map(x => x.name));
      for (const c of columns) if (!existing.has(c)) this.db.exec(`ALTER TABLE ${q(table)} ADD COLUMN ${q(c)} ${columnType(c)}`);
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS AppSessions (
        SessionHash TEXT PRIMARY KEY, Email TEXT NOT NULL, Name TEXT, AccessTokenCipher TEXT,
        RefreshTokenCipher TEXT, TokenExpiresAt TEXT, SessionExpiresAt TEXT NOT NULL,
        CreatedAt TEXT NOT NULL, UpdatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_email ON AppSessions(Email);
      CREATE INDEX IF NOT EXISTS idx_worksheets_date ON Worksheets(DateWorked);
      CREATE INDEX IF NOT EXISTS idx_worksheets_contractor ON Worksheets(ContractorID);
      CREATE INDEX IF NOT EXISTS idx_worksheets_crew ON Worksheets(CrewID);
      CREATE INDEX IF NOT EXISTS idx_jobs_worksheet ON WorksheetJobs(WorksheetID);
      CREATE INDEX IF NOT EXISTS idx_jobs_jobid ON WorksheetJobs(JobID);
      CREATE INDEX IF NOT EXISTS idx_exceptions_worksheet ON Exceptions(WorksheetID);
      CREATE INDEX IF NOT EXISTS idx_users_email ON Users(Email);
    `);
  }

  seed({ bootstrapAdminEmail = config.bootstrapAdminEmail, bootstrapAdminName = config.bootstrapAdminName } = {}) {
    const now = new Date().toISOString();
    if (!this.count('Settings')) {
      this.insertMany('Settings', DEFAULT_SETTINGS.map(([Key,Value,Description]) => ({Key,Value,Description,UpdatedAt:now})));
    }
    if (!this.count('Parishes')) {
      this.insertMany('Parishes', DEFAULT_PARISHES.map((p,i)=>({ParishID:`PAR-${String(i+1).padStart(2,'0')}`,ParishName:p[0],Region:p[1],Active:true,SortOrder:i+1,CreatedAt:now,UpdatedAt:now})));
    }
    if (!this.count('Shifts')) this.insertMany('Shifts', DEFAULT_SHIFTS.map(x=>({...x,CreatedAt:now,UpdatedAt:now})));
    if (!this.count('WorkTypes')) this.insertMany('WorkTypes', DEFAULT_WORK_TYPES.map(x=>({...x,CreatedAt:now,UpdatedAt:now})));
    this.seedLegal(now);
    if (!this.count('Users') && bootstrapAdminEmail) {
      this.insert('Users', {
        UserID: crypto.randomUUID(), Email: bootstrapAdminEmail.toLowerCase(), Name: bootstrapAdminName || bootstrapAdminEmail.split('@')[0],
        Role:'Admin', ContractorID:'', AuthorizedParishes:'', Active:true, CreatedAt:now, UpdatedAt:now
      });
    }
  }

  seedLegal(now = new Date().toISOString(), force = false) {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const legal = JSON.parse(fs.readFileSync(path.join(moduleDir,'legal-seed.json'),'utf8'));
    const current = Number(this.findOne('Settings','Key','LEGAL_CONTENT_VERSION')?.Value || 0);
    if (!force && current >= LEGAL_CONTENT_VERSION && this.count('LegalContent')) return;
    for (const p of legal) {
      const Content = String(p.Content)
        .replaceAll('Google Apps Script deployment settings', 'the Node.js application authentication and deployment settings')
        .replaceAll('Google Apps Script, Google Sheets, browser-based libraries', 'Node.js, SQLite, browser-based libraries')
        .replaceAll('Google Apps Script and Google Sheets are Google services.', 'Node.js and SQLite are third-party open-source technologies used by the application.')
        .replace('The application uses Google Sheets as its backend database and reads operational settings, users, contractors, crews, parishes, shifts, work types and legal/information content dynamically from the configured spreadsheet. When no database ID has been configured, the application can create its database automatically and store the Spreadsheet ID in Script Properties.', 'The application uses a server-side SQLite database and reads operational settings, users, contractors, crews, parishes, shifts, work types and legal/information content dynamically from that database. Database initialization and migrations run automatically when the Node.js service starts.')
        .replace('Access is controlled using the active Google account and the role stored in the Users sheet.', 'Access is controlled by the authenticated user email and the role stored in the Users table.');
      this.upsert('LegalContent','PageKey',{...p,Content,UpdatedAt:now});
    }
    this.upsert('Settings','Key',{Key:'LEGAL_CONTENT_VERSION',Value:String(LEGAL_CONTENT_VERSION),Description:'Internal version marker for About / Licensing / Disclaimer / Copyright content',UpdatedAt:now});
  }

  count(table) { return Number(this.db.prepare(`SELECT COUNT(*) AS n FROM ${q(table)}`).get().n); }
  all(table) { return this.db.prepare(`SELECT * FROM ${q(table)}`).all().map(fromDbRow); }
  findOne(table, field, value) { return fromDbRow(this.db.prepare(`SELECT * FROM ${q(table)} WHERE ${q(field)} = ? LIMIT 1`).get(value)); }
  filter(table, field, value) { return this.db.prepare(`SELECT * FROM ${q(table)} WHERE ${q(field)} = ?`).all(value).map(fromDbRow); }

  insert(table, obj) {
    const columns = SCHEMA[table] || Object.keys(obj);
    const used = columns.filter(c => Object.prototype.hasOwnProperty.call(obj,c));
    const sql = `INSERT INTO ${q(table)} (${used.map(q).join(',')}) VALUES (${used.map(()=>'?').join(',')})`;
    this.db.prepare(sql).run(...used.map(c=>toDbValue(c,obj[c])));
    return obj;
  }
  insertMany(table, rows) { for (const row of rows || []) this.insert(table,row); }
  upsert(table, keyField, obj) {
    const exists = this.findOne(table,keyField,obj[keyField]);
    if (!exists) return this.insert(table,obj);
    const columns = (SCHEMA[table] || Object.keys(obj)).filter(c => Object.prototype.hasOwnProperty.call(obj,c) && c !== keyField);
    const sql = `UPDATE ${q(table)} SET ${columns.map(c=>`${q(c)}=?`).join(',')} WHERE ${q(keyField)}=?`;
    this.db.prepare(sql).run(...columns.map(c=>toDbValue(c,obj[c])), obj[keyField]);
    return obj;
  }
  deleteWhere(table, field, value) { return this.db.prepare(`DELETE FROM ${q(table)} WHERE ${q(field)} = ?`).run(value).changes; }
  clear(table) { this.db.exec(`DELETE FROM ${q(table)}`); }

  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (e) { try { this.db.exec('ROLLBACK'); } catch {} throw e; }
  }

  sessionGet(hash) { return this.db.prepare('SELECT * FROM AppSessions WHERE SessionHash=?').get(hash) || null; }
  sessionPut(row) {
    this.db.prepare(`INSERT INTO AppSessions(SessionHash,Email,Name,AccessTokenCipher,RefreshTokenCipher,TokenExpiresAt,SessionExpiresAt,CreatedAt,UpdatedAt)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(SessionHash) DO UPDATE SET Email=excluded.Email,Name=excluded.Name,AccessTokenCipher=excluded.AccessTokenCipher,RefreshTokenCipher=excluded.RefreshTokenCipher,TokenExpiresAt=excluded.TokenExpiresAt,SessionExpiresAt=excluded.SessionExpiresAt,UpdatedAt=excluded.UpdatedAt`)
      .run(row.SessionHash,row.Email,row.Name,row.AccessTokenCipher||'',row.RefreshTokenCipher||'',row.TokenExpiresAt||'',row.SessionExpiresAt,row.CreatedAt,row.UpdatedAt);
  }
  sessionDelete(hash) { this.db.prepare('DELETE FROM AppSessions WHERE SessionHash=?').run(hash); }
  sessionPurgeExpired(nowIso = new Date().toISOString()) { this.db.prepare('DELETE FROM AppSessions WHERE SessionExpiresAt < ?').run(nowIso); }

  async backup(destination) {
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    await sqliteBackup(this.db, destination);
    return destination;
  }
  close() { this.db.close(); }
}

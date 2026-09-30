import { Store } from '../src/db.mjs';
import { newId, nowIso, normalizeEmail, displayNameFromEmail } from '../src/utils.mjs';

const email=normalizeEmail(process.argv[2]||process.env.ADMIN_EMAIL);if(!email){console.error('Usage: npm run create-admin -- admin@example.com ["Display Name"]');process.exit(2);}const name=process.argv[3]||displayNameFromEmail(email),store=new Store(),now=nowIso();const existing=store.all('Users').find(u=>normalizeEmail(u.Email)===email);const record={UserID:existing?.UserID||newId('USR'),Email:email,Name:name,Role:'Admin',ContractorID:'',AuthorizedParishes:'',Active:true,CreatedAt:existing?.CreatedAt||now,UpdatedAt:now};store.upsert('Users','UserID',record);console.log(`Admin ready: ${email} (${record.UserID})`);store.close();

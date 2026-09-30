import path from 'node:path';import { Store } from '../src/db.mjs';
const store=new Store(),stamp=new Date().toISOString().replace(/[:.]/g,'-'),dest=path.resolve(process.argv[2]||`./backups/dws-${stamp}.sqlite`);await store.backup(dest);console.log(dest);store.close();

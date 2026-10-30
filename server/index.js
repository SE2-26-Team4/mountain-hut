import app from './app.js';
import { initializeDatabase } from './db.js';
import { initializeAccounts } from './init/init-accounts.js';

await initializeDatabase();

await initializeAccounts();

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Mountain Hut API listening on http://localhost:${port}`);
});
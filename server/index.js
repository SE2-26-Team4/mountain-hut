import app from './app.js';
import { initializeDatabase } from './db.js';
import { initializeAccounts } from './init/init-accounts.js';

// [Database initialization and initial schema]: Initialize the database before accepting requests.
await initializeDatabase();

// [Minimal login setup (backend)]: Prepare the local test hiker account.
await initializeAccounts();

// [Backend project setup]: Start the Express application as a local server.
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Mountain Hut API listening on http://localhost:${port}`);
});
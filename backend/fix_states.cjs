const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });
async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const [r1] = await db.execute("UPDATE programs SET state='All India' WHERE state='All States'");
  console.log('All States -> All India:', r1.affectedRows);
  const [r2] = await db.execute("UPDATE programs SET state='All India' WHERE state IN ('All','Central','National','')");
  console.log('Other variants -> All India:', r2.affectedRows);
  const [r3] = await db.execute("SELECT state, COUNT(*) as cnt FROM programs GROUP BY state ORDER BY cnt DESC LIMIT 8");
  console.log('Top states now:');
  r3.forEach(r => console.log(' ', r.cnt, r.state));
  await db.end();
}
run().catch(console.error);

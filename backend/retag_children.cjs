const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // All Women & Child schemes → 'any' occupation (gender filter handles female-only ones)
  const [r1] = await db.execute("UPDATE programs SET target_occupations='any' WHERE category='Women & Child'");
  console.log('Women & Child → any:', r1.affectedRows, 'rows');

  // Child health / nutrition keyword schemes → 'any'
  const keywords = [
    'anganwadi', 'poshan', 'vaccination', 'immunisation', 'immunization',
    'nutrition', 'mid-day meal', 'midday meal', 'child welfare', 'child health',
    'pradhan mantri matru', 'janani', 'beti bachao',
  ];
  for (const kw of keywords) {
    const [r] = await db.execute(
      "UPDATE programs SET target_occupations='any' WHERE target_occupations != 'any' AND (name LIKE ? OR description LIKE ?)",
      [`%${kw}%`, `%${kw}%`]
    );
    if (r.affectedRows > 0) console.log(`  "${kw}" → any: ${r.affectedRows} rows`);
  }

  await db.end();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });

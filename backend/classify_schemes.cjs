/**
 * classify_schemes.cjs
 * One-time script: adds target_occupations column and tags every scheme in the DB.
 *
 * Occupation values (matching the frontend form):
 *   farmer | student | business | street_vendor | unorganised_worker
 *   armed_forces | government_employee | private_employee | homemaker | other | any
 *
 * Run: node classify_schemes.cjs
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

// ─────────────────────────────────────────────────────────────────────────────
// Classification logic
// ─────────────────────────────────────────────────────────────────────────────
function classifyScheme(scheme) {
  const cat  = (scheme.category    || '').toLowerCase().trim();
  const name = (scheme.name        || '').toLowerCase();
  const desc = (scheme.description || '').toLowerCase();
  const text = name + ' ' + desc;

  // ── Agriculture ────────────────────────────────────────────────────────────
  if (cat === 'agriculture') return 'farmer';

  // ── Education ──────────────────────────────────────────────────────────────
  if (cat === 'education') {
    // Broader adult / vocational / skill schemes are for everyone
    if (/adult literacy|vocational training|skill development|nios|open school|digital literacy|e-learning/.test(text)) {
      return 'any';
    }
    return 'student';
  }

  // ── Women & Child ──────────────────────────────────────────────────────────
  // Gender filter already restricts to female; leave occupation open
  if (cat === 'women & child') return 'any';

  // ── Disability Support ─────────────────────────────────────────────────────
  // disability_required filter already handles this
  if (cat === 'disability support') return 'any';

  // ── Health ─────────────────────────────────────────────────────────────────
  if (cat === 'health') return 'any';

  // ── Housing ────────────────────────────────────────────────────────────────
  if (cat === 'housing') return 'any';

  // ── Social Welfare ─────────────────────────────────────────────────────────
  if (cat === 'social welfare') return 'any';

  // ── Financial Inclusion ────────────────────────────────────────────────────
  if (cat === 'financial inclusion') {
    if (/\bkisan\b|\bfarmer\b|\bagricultural credit\b|\bcrop loan\b|\bkcc\b/.test(text))
      return 'farmer';
    if (/fisherm[ae]n|fisheries|\baquaculture\b/.test(text))
      return 'farmer';
    if (/\bmsme\b|micro.?enterprise|small.?enterprise|start.?up|mudra|enterprise loan|self.?employ/.test(text))
      return 'business,street_vendor,farmer,unorganised_worker,other';
    if (/construction worker|\bbocw\b|building worker/.test(text))
      return 'unorganised_worker';
    if (/street vendor|hawker|svanidhi/.test(text))
      return 'street_vendor,unorganised_worker';
    if (/ex.?serviceman|veteran|sainik/.test(text))
      return 'armed_forces';
    if (/central government employee|cghs|government servant|civil servant/.test(text))
      return 'government_employee';
    // General financial inclusion — loans, insurance, banking for everyone
    return 'any';
  }

  // ── Employment ─────────────────────────────────────────────────────────────
  if (cat === 'employment') {
    // Ex-serviceman / armed forces
    if (/ex.?serviceman|ex-service\b|veteran|\bechs\b|\bsainik\b|defence pension|armed forces veteran/.test(text))
      return 'armed_forces';

    // Central government employee
    if (/central government employee|central govt.*employee|\bcghs\b|government servant|civil servant/.test(text))
      return 'government_employee';

    // ESIC / EPF / organised private sector
    if (/\besic\b|\bepf\b|employees.*provident|employees.*state insurance/.test(text))
      return 'private_employee,government_employee';

    // Campus recruitment / fresher placement
    if (/campus recruitment|campus placement|campus assistance|fresh graduate|\bfresher\b/.test(text))
      return 'student';

    // Apprenticeship / internship / trainee
    if (/\bapprenticeship\b|\binternship\b|\btrainee\b/.test(text))
      return 'student,unorganised_worker';

    // MSME / startup / self-employment schemes
    if (/\bmsme\b|micro.?enterprise|small.?enterprise|start.?up.*scheme|self.?employ.*scheme|own.*business.*loan/.test(text))
      return 'business,street_vendor,farmer,other';

    // Construction / BOCW
    if (/construction worker|building worker|\bbocw\b|construction.*welfare board|building.*welfare board/.test(text))
      return 'unorganised_worker';

    // Street vendor / hawker
    if (/street vendor|hawker|svanidhi|\bpm sva\b/.test(text))
      return 'street_vendor,unorganised_worker';

    // Weaver / artisan / traditional craft
    if (/\bweaver\b|\bartisan\b|\bhandloom\b|\bhandicraft\b|\bkhadi\b|\bpotter\b|\bblacksmith\b|\bcarpenter\b/.test(text))
      return 'unorganised_worker';

    // Fishermen / aquaculture
    if (/fisherm[ae]n|fisheries|\baquaculture\b|\bfishing\b/.test(text))
      return 'farmer,unorganised_worker';

    // Farmer / kisan / agricultural worker
    if (/\bkisan\b|\bfarmer\b|\bfarming\b|\bcrop\b|\bhorticulture\b|\blivestock\b|\banimal husbandry\b/.test(text))
      return 'farmer';

    // Auto / taxi / transport
    if (/auto driver|auto rickshaw|taxi driver|cab driver|\brickshaw\b/.test(text))
      return 'unorganised_worker,street_vendor';

    // Factory / industrial / mill worker
    if (/factory worker|industrial worker|mill worker|\bworkmen\b/.test(text))
      return 'unorganised_worker';

    // Daily wage / migrant / bonded labour
    if (/daily wage|migrant worker|unorganised worker|bonded labour/.test(text))
      return 'unorganised_worker,street_vendor';

    // Default employment → general schemes open to all
    return 'any';
  }

  return 'any';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const db = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // 1. Add column if it doesn't exist
  console.log('Adding target_occupations column (if missing)…');
  await db.execute(`
    ALTER TABLE programs
    ADD COLUMN IF NOT EXISTS target_occupations VARCHAR(255) NOT NULL DEFAULT 'any'
  `).catch(() => {
    // MySQL <8 doesn't support IF NOT EXISTS on column; silently ignore
  });

  // Fallback for older MySQL
  const [cols] = await db.execute(`SHOW COLUMNS FROM programs LIKE 'target_occupations'`);
  if (cols.length === 0) {
    await db.execute(`ALTER TABLE programs ADD COLUMN target_occupations VARCHAR(255) NOT NULL DEFAULT 'any'`);
    console.log('Column created.');
  } else {
    console.log('Column already exists.');
  }

  // 2. Fetch all schemes
  const [schemes] = await db.execute('SELECT id, name, description, category FROM programs');
  console.log(`Classifying ${schemes.length} schemes…`);

  // 3. Classify and batch-update
  const stats = {};
  const updates = [];

  for (const scheme of schemes) {
    const tag = classifyScheme(scheme);
    stats[tag] = (stats[tag] || 0) + 1;
    updates.push([tag, scheme.id]);
  }

  // Batch in chunks of 500
  const chunkSize = 500;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(chunk.map(([tag, id]) =>
      db.execute('UPDATE programs SET target_occupations = ? WHERE id = ?', [tag, id])
    ));
    console.log(`  Updated ${Math.min(i + chunkSize, updates.length)} / ${updates.length}`);
  }

  console.log('\n✅ Done! Classification summary:');
  Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, cnt]) => console.log(`  ${String(cnt).padStart(5)}  ${tag}`));

  await db.end();
}

main().catch(err => { console.error(err); process.exit(1); });

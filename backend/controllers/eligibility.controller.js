const db = require('../config/db');

// ── Weighted scoring constants ────────────────────────────────────────────────
// Inspired by predict_bridge.py from the reference project.
// Each dimension contributes points; threshold = 40 to be shown as eligible.
const OCC_ACCESS = {
  farmer:              ['farmer'],
  student:             ['student'],
  business:            ['business', 'unorganised_worker'],
  street_vendor:       ['street_vendor', 'unorganised_worker'],
  unorganised_worker:  ['unorganised_worker'],
  armed_forces:        ['armed_forces'],
  government_employee: ['government_employee'],
  private_employee:    ['private_employee'],
  homemaker:           [],
  other:               [],
};

const EDU_LEVELS = {
  'Illiterate': 0, 'Primary': 1, 'Secondary': 2,
  'Higher Secondary': 3, 'Graduate': 4, 'Post-Graduate': 5,
};

const NATIONAL = ['all india', 'all states', 'all', 'central', 'national', ''];

/**
 * calculateMatchScore — returns 0 (ineligible) or 1–100 (confidence %).
 * Schemes scoring >= 40 are considered eligible.
 * Adapts the weighted scoring engine from predict_bridge.py to work
 * with our 3,300+ MyScheme dataset.
 */
const calculateMatchScore = (program, data) => {
  const {
    age, income, occupation, has_disability, is_citizen,
    gender, caste, state,
    education    = 'any',
    location_type = 'any',
  } = data;

  // ── HARD DISQUALIFIERS (score = 0) ───────────────────────────────────────
  if (program.citizenship_required && !is_citizen) return 0;
  if (program.disability_required  && !has_disability) return 0;

  // Age hard bounds
  if (program.min_age > 0   && age < program.min_age) return 0;
  if (program.max_age < 120 && age > program.max_age) return 0;

  // Income hard bounds
  if (program.min_income > 0            && income < parseFloat(program.min_income)) return 0;
  if (parseFloat(program.max_income) < 99999999 && income > parseFloat(program.max_income)) return 0;

  // Gender hard
  if (program.gender !== 'any' && gender && gender !== program.gender) return 0;

  // ── Category-level safety
  if (program.category === 'Women & Child'    && age >= 18 && gender && gender !== 'female') return 0;
  if (program.category === 'Disability Support' && !has_disability) return 0;

  // Caste hard (mismatch → 0)
  if (program.caste !== 'any' && caste && caste !== program.caste) return 0;

  // State hard (wrong state → 0)
  const progState = (program.state || '').toLowerCase().trim();
  const userState = (state || '').toLowerCase().trim();
  if (
    progState && !NATIONAL.includes(progState) &&
    userState && !NATIONAL.includes(userState) &&
    progState !== userState
  ) return 0;

  // Occupation hard (specific occupation mismatch → 0)
  const targetOcc = (program.target_occupations || 'any').trim();
  let occDirect = false;
  if (targetOcc !== 'any') {
    const allowed = targetOcc.split(',').map(s => s.trim());
    if (!allowed.includes('any')) {
      const userTags = OCC_ACCESS[occupation] || [];
      if (!userTags.some(t => allowed.includes(t))) return 0;
      occDirect = true;
    }
  }

  // ── Keyword-based age safety rules (hard blocks) ─────────────────────────
  const schemeText = ((program.name || '') + ' ' + (program.description || '')).toLowerCase();

  if (program.category === 'Education' && program.min_age === 0 && program.max_age === 120 && age > 35) return 0;
  if (program.min_age === 0 && program.max_age === 120 && age > 35 &&
    /\bstudent\b|\bschool\b|\b10th\b|\b11th\b|\b12th\b|\bsslc\b|\bhsc\b|\bmatric\b|\bscholarship\b|\beducation loan\b|\bfellowship\b|\bundergraduate\b|\bpostgraduate\b|\bcollege\b|\buniversity\b|\bacademic\b|\btuition\b/.test(schemeText)) return 0;
  if (program.max_age === 120 && age > 40 && /campus recruitment|campus placement|fresh graduate|\bfresher\b/.test(schemeText)) return 0;
  if (program.max_age === 120 && age > 35 && /\bapprenticeship\b|\binternship\b|\btrainee\b/.test(schemeText)) return 0;
  if (program.max_age === 120 && age > 18 && /\bchild\b|\bchildren\b|\bjuvenile\b|\borphan\b/.test(schemeText)) return 0;
  if (program.min_age === 0 && age < 60 && /senior citizen|old age|elderly|aged person/.test(schemeText)) return 0;
  if (age < 18 && /\bwidow\b|\bwidower\b/.test(schemeText)) return 0;
  if (program.max_age === 120 && (age < 15 || age > 55) && /\bmaternity\b|\bpregnant\b|\bpregnancy\b|\bnursing mother\b/.test(schemeText)) return 0;
  if (program.max_age === 120 && age > 45 && /young entrepreneur|youth entrepreneurship/.test(schemeText)) return 0;
  if (program.min_age === 0 && age < 18 && /\boverseas\b|\bstudy abroad\b|\bforeign university\b|\babroad\b/.test(schemeText)) return 0;
  if (program.min_age === 0 && age < 21 && /\bfellowship\b|\bresearch fellow\b|\bchair professor\b|\bpost.?doctoral\b/.test(schemeText)) return 0;
  if (program.min_age === 0 && age < 20 && /\bdoctoral\b|\bphd\b|\bp\.h\.d\b|\bm\.tech\b|\bmba\b|\bm\.sc\b|\bpostgraduate\b|\bpost.?graduation\b/.test(schemeText)) return 0;
  if (program.min_age === 0 && age < 15 && /\baicte\b/.test(schemeText)) return 0;
  if (program.min_age === 0 && age < 15 && /\bundergraduate\b|\bgraduation\b|\bdegree course\b|\bcollege\b|\buniversity\b|\bb\.tech\b|\bbsc\b|\bba\b|\bllb\b|\bmbbs\b/.test(schemeText)) return 0;
  if (program.min_age === 0 && age < 15 && /education loan|educational loan|loan subsidy/.test(schemeText)) return 0;
  if (program.min_age === 0 && age < 14 && /post.?matric|postmatric|\b11th\b|\b12th\b|\bclass xi\b|\bclass xii\b|\bhigher secondary\b/.test(schemeText)) return 0;
  if (program.min_age === 0 && age < 14 && /vocational training|\biti\b|polytechnic|skill.*training/.test(schemeText)) return 0;
  if (program.min_age === 0 && age < 18 && program.category === 'Employment' && !/\bchild\b|\bchildren\b|\bscholarship\b/.test(schemeText)) return 0;

  // Disability-specific schemes for non-disabled users
  if (!has_disability && /\bdisability (relief|aid|aids|assistance|pension|benefit)\b|\bdivyang\b|\bpwd\b|\bpwds\b|\bhandicap(ped)?\b/.test(schemeText)) return 0;

  // Widow/widower schemes for non-widowed (too specific to apply broadly)
  if (gender === 'male' && /\bwidow pension\b|\bwidow (relief|benefit|assistance)\b/.test(schemeText)) return 0;

  // ── SCORING (total 0-100) ─────────────────────────────────────────────────
  // Dimension weights:
  //   income(20) + occupation(20) + caste(15) + state(15) + location(10) + education(10) + age_spec(5) + base(5)
  let score = 5; // base: passed all hard filters

  // 1. Income relevance (0-20)
  //    Lower income relative to limit = higher score (poverty-targeted schemes prioritised)
  const maxInc = parseFloat(program.max_income);
  if (maxInc >= 99999999) {
    score += 8;                                    // universal, no income limit
  } else {
    const ratio = income / maxInc;
    if (ratio <= 0.25)      score += 20;
    else if (ratio <= 0.50) score += 16;
    else if (ratio <= 0.75) score += 11;
    else                    score += 6;
  }

  // 2. Occupation relevance (0-20)
  score += occDirect ? 20 : 5;                    // direct match = 20; open-to-all = 5

  // 3. Caste relevance (0-15)
  score += (program.caste !== 'any') ? 15 : 5;   // targeted match = 15; generic = 5

  // 4. State relevance (0-15)
  score += (!progState || NATIONAL.includes(progState)) ? 5 : 15; // state-specific = 15

  // 5. Location type relevance (0-10)
  const progLoc = (program.location_type || 'any').toLowerCase().trim();
  const userLoc = (location_type || 'any').toLowerCase().trim();
  if (progLoc === 'any' || userLoc === 'any') {
    score += 5;
  } else if (progLoc === userLoc) {
    score += 10;                                   // exact match (e.g. both Rural)
  } else if (userLoc === 'semi_urban' || userLoc === 'semi-urban') {
    score += 4;                                    // semi-urban overlaps both
  } else {
    score += 1;                                    // location mismatch (not a hard block)
  }

  // 6. Education relevance (0-10)
  const progEdu = program.education_min || 'any';
  if (progEdu === 'any') {
    score += 5;
  } else {
    const userEduLevel = EDU_LEVELS[education] !== undefined ? EDU_LEVELS[education] : -1;
    const progEduLevel = EDU_LEVELS[progEdu]   !== undefined ? EDU_LEVELS[progEdu]   : -1;
    if (userEduLevel >= progEduLevel) {
      score += 10;                                 // meets or exceeds requirement
    } else if (progEduLevel - userEduLevel <= 1) {
      score += 5;                                  // one level below (partial credit)
    } else {
      score += 1;
    }
  }

  // 7. Age specificity bonus (0-5): specific-age schemes are more precisely targeted
  score += (program.min_age > 0 || program.max_age < 120) ? 5 : 2;

  return Math.min(100, score);
};

// ── Single scheme eligibility check ──────────────────────────────────────────
const checkEligibility = async (req, res) => {
  const {
    program_id, age, income, employment_status, occupation,
    has_disability, is_citizen, gender, caste, state, education, location_type,
  } = req.body;
  const user_id = req.user.id;

  if (!program_id || age === undefined || income === undefined) {
    return res.status(400).json({ success: false, message: 'program_id, age, and income are required.' });
  }

  try {
    const [programs] = await db.execute('SELECT * FROM programs WHERE id = ? AND is_active = TRUE', [program_id]);
    if (programs.length === 0) {
      return res.status(404).json({ success: false, message: 'Program not found.' });
    }

    const program = programs[0];
    const citizenData = { age, income, employment_status, occupation, has_disability, is_citizen, gender, caste, state, education, location_type };

    const match_score = calculateMatchScore(program, citizenData);
    const is_eligible = match_score >= 40;

    await db.execute(
      `INSERT INTO eligibility_results
        (user_id, program_id, age, income, employment_status, occupation, has_disability, is_citizen, gender, caste, state, ml_score, is_eligible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, program_id, age, income, employment_status || null,
       occupation || 'other', has_disability || false, is_citizen !== false,
       gender || 'any', caste || 'General', state || 'All India',
       match_score / 100, is_eligible]
    );

    res.json({
      success: true,
      program: program.name,
      program_id: program.id,
      is_eligible,
      match_score,
      official_link: program.official_link,
      message: is_eligible
        ? `You are eligible for ${program.name}. (${match_score}% match)`
        : `You do not meet the requirements for ${program.name}. (${match_score}% match)`,
    });
  } catch (err) {
    console.error('Eligibility check error:', err);
    res.status(500).json({ success: false, message: 'Server error during eligibility check.' });
  }
};

// ── Results history ───────────────────────────────────────────────────────────
const getMyResults = async (req, res) => {
  const user_id = req.user.id;
  try {
    const [rows] = await db.execute(
      `SELECT er.*, p.name as program_name, p.category, p.official_link
       FROM eligibility_results er
       JOIN programs p ON er.program_id = p.id
       WHERE er.user_id = ?
       ORDER BY er.checked_at DESC`,
      [user_id]
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch results.' });
  }
};

// ── Check ALL programs ────────────────────────────────────────────────────────
const checkAllPrograms = async (req, res) => {
  const {
    age, income, employment_status, occupation,
    has_disability, is_citizen, gender, caste, state,
    education    = 'any',
    location_type = 'any',
  } = req.body;

  const citizenData = {
    age, income, employment_status, occupation,
    has_disability, is_citizen, gender, caste, state,
    education, location_type,
  };

  try {
    const [programs] = await db.execute('SELECT * FROM programs WHERE is_active = TRUE ORDER BY category, name');

    const results = programs.map(program => {
      const match_score = calculateMatchScore(program, citizenData);
      return {
        program_id:         program.id,
        program_name:       program.name,
        category:           program.category,
        official_link:      program.official_link,
        state:              program.state,
        caste:              program.caste,
        ministry:           program.ministry,
        documents_required: program.documents_required,
        how_to_apply:       program.how_to_apply,
        benefits:           program.benefits,
        tags:               program.tags_list,
        match_score,
        is_eligible:        match_score >= 40,
      };
    });

    res.json({ success: true, results });
  } catch (err) {
    console.error('checkAllPrograms error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { checkEligibility, getMyResults, checkAllPrograms };

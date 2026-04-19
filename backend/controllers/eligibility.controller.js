const db = require('../config/db');

const checkEligibility = async (req, res) => {
  const { program_id, age, income, employment_status, occupation, has_disability, is_citizen, gender, caste, state } = req.body;
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
    const citizenData = { age, income, employment_status, occupation, has_disability, is_citizen, gender, caste, state };
    let ml_score = null;
    let is_eligible = false;

    try {
      const fetch = (await import('node-fetch')).default;
      const mlResponse = await fetch(`${process.env.ML_SERVICE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age,
          income,
          employment_status: employment_status || 'unemployed',
          has_disability: has_disability ? 1 : 0,
          is_citizen: is_citizen !== false ? 1 : 0,
          gender: gender || 'any',
          caste: caste || 'General',
          occupation: occupation || 'other',
          min_age: program.min_age,
          max_age: program.max_age,
          min_income: program.min_income,
          max_income: program.max_income,
          program_employment_status: program.employment_status,
          required_occupation: program.required_occupation,
          disability_required: program.disability_required ? 1 : 0,
          citizenship_required: program.citizenship_required ? 1 : 0,
          program_gender: program.gender,
          program_caste: program.caste,
        }),
      });

      if (mlResponse.ok) {
        const mlData = await mlResponse.json();
        ml_score = mlData.score;
        is_eligible = mlData.eligible;
      } else {
        is_eligible = fallbackEligibilityCheck(program, citizenData);
      }
    } catch {
      is_eligible = fallbackEligibilityCheck(program, citizenData);
    }

    await db.execute(
      `INSERT INTO eligibility_results
        (user_id, program_id, age, income, employment_status, occupation, has_disability, is_citizen, gender, caste, state, ml_score, is_eligible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, program_id, age, income, employment_status || null,
       occupation || 'other',
       has_disability || false, is_citizen !== false,
       gender || 'any', caste || 'General', state || 'All India',
       ml_score, is_eligible]
    );

    res.json({
      success: true,
      program: program.name,
      program_id: program.id,
      is_eligible,
      ml_score,
      official_link: program.official_link,
      message: is_eligible
        ? `You are eligible for ${program.name}.`
        : `You do not meet the requirements for ${program.name}.`,
    });
  } catch (err) {
    console.error('Eligibility check error:', err);
    res.status(500).json({ success: false, message: 'Server error during eligibility check.' });
  }
};

const fallbackEligibilityCheck = (program, data) => {
  const { age, income, employment_status, occupation, has_disability, is_citizen, gender, caste, state } = data;

  // ── Hard eligibility criteria ──────────────────────────────────────────────
  if (program.citizenship_required && !is_citizen) return false;
  if (program.disability_required && !has_disability) return false;

  // Apply age/income bounds only when explicitly set (not default 0 / 120 / 0 / 99999999)
  if (program.min_age > 0 && age < program.min_age) return false;
  if (program.max_age < 120 && age > program.max_age) return false;
  if (program.min_income > 0 && income < program.min_income) return false;
  if (program.max_income < 99999999 && income > program.max_income) return false;

  if (program.employment_status !== 'any' && employment_status !== program.employment_status) return false;
  if (program.gender !== 'any' && gender && gender !== program.gender) return false;
  if (program.caste !== 'any' && caste && caste !== program.caste) return false;

  // ── State filter ──────────────────────────────────────────────────────────
  if (
    program.state && program.state !== 'All India' &&
    state && state !== 'All India' &&
    program.state.toLowerCase().trim() !== state.toLowerCase().trim()
  ) return false;

  // ── Category-level safety ─────────────────────────────────────────────────
  // Women & Child: adult males (18+) are excluded, but children of any gender are eligible
  if (program.category === 'Women & Child' && age >= 18 && gender && gender !== 'female') return false;
  if (program.category === 'Disability Support' && !has_disability) return false;

  // ── Occupation filter ─────────────────────────────────────────────────────
  // Uses the pre-classified target_occupations column (set by classify_schemes.cjs).
  // Format: 'any' | 'farmer' | 'student,unorganised_worker' | etc.
  const targetOcc = (program.target_occupations || 'any').trim();
  if (targetOcc !== 'any' && occupation) {
    const allowed = targetOcc.split(',').map(s => s.trim());
    if (!allowed.includes(occupation) && !allowed.includes('any')) return false;
  }

  // ── Keyword-based age safety ──────────────────────────────────────────────
  const schemeText = ((program.name || '') + ' ' + (program.description || '')).toLowerCase();

  // Education category — for students/young adults only
  if (program.category === 'Education' && program.min_age === 0 && program.max_age === 120 && age > 35) return false;

  // Student-keyword schemes
  if (
    program.min_age === 0 && program.max_age === 120 && age > 35 &&
    /\bstudent\b|\bschool\b|\b10th\b|\b11th\b|\b12th\b|\bsslc\b|\bhsc\b|\bmatric\b|\bscholarship\b|\beducation loan\b|\bfellowship\b|\bundergraduate\b|\bpostgraduate\b|\bcollege\b|\buniversity\b|\bacademic\b|\btuition\b/.test(schemeText)
  ) return false;

  // Campus recruitment / fresh graduates
  if (program.max_age === 120 && age > 40 && /campus recruitment|campus placement|fresh graduate|\bfresher\b/.test(schemeText)) return false;

  // Apprenticeship / internship
  if (program.max_age === 120 && age > 35 && /\bapprenticeship\b|\binternship\b|\btrainee\b/.test(schemeText)) return false;

  // Child / juvenile welfare
  if (program.max_age === 120 && age > 18 && /\bchild\b|\bchildren\b|\bjuvenile\b|\borphan\b/.test(schemeText)) return false;

  // Senior citizen / old age
  if (program.min_age === 0 && age < 60 && /senior citizen|old age|elderly|aged person/.test(schemeText)) return false;

  // Widow / widower
  if (age < 18 && /\bwidow\b|\bwidower\b/.test(schemeText)) return false;

  // Maternity / pregnancy
  if (program.max_age === 120 && (age < 15 || age > 55) && /\bmaternity\b|\bpregnant\b|\bpregnancy\b|\bnursing mother\b/.test(schemeText)) return false;

  // Young entrepreneur
  if (program.max_age === 120 && age > 45 && /young entrepreneur|youth entrepreneurship/.test(schemeText)) return false;

  return true;
};

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

const checkAllPrograms = async (req, res) => {
  const { age, income, employment_status, occupation, has_disability, is_citizen, gender, caste, state } = req.body;
  const citizenData = { age, income, employment_status, occupation, has_disability, is_citizen, gender, caste, state };

  try {
    const [programs] = await db.execute('SELECT * FROM programs WHERE is_active = TRUE ORDER BY category, name');
    const results = programs.map(program => ({
      program_id: program.id,
      program_name: program.name,
      category: program.category,
      official_link: program.official_link,
      state: program.state,
      documents_required: program.documents_required,
      is_eligible: fallbackEligibilityCheck(program, citizenData),
    }));

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { checkEligibility, getMyResults, checkAllPrograms };

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

  if (program.citizenship_required && !is_citizen) return false;
  if (program.disability_required && !has_disability) return false;

  // Only apply age bounds when they are explicitly set (not at their defaults of 0 / 120)
  if (program.min_age > 0 && age < program.min_age) return false;
  if (program.max_age < 120 && age > program.max_age) return false;

  if (program.min_income > 0 && income < program.min_income) return false;
  if (program.max_income < 99999999 && income > program.max_income) return false;
  if (program.employment_status !== 'any' && employment_status !== program.employment_status) return false;
  if (program.required_occupation && program.required_occupation !== 'any' && occupation !== program.required_occupation) return false;
  if (program.gender !== 'any' && gender && gender !== program.gender) return false;
  if (program.caste !== 'any' && caste && caste !== program.caste) return false;

  // ── State filter ──────────────────────────────────────────────────────────
  // If the scheme is state-specific, only show it to users from that state
  // (or users who selected "All India" to see everything).
  if (
    program.state &&
    program.state !== 'All India' &&
    state &&
    state !== 'All India' &&
    program.state.toLowerCase().trim() !== state.toLowerCase().trim()
  ) return false;

  // Category-level safety: Women & Child schemes are female-only even if DB gender is 'any'
  if (program.category === 'Women & Child' && gender && gender !== 'female') return false;
  // Disability Support schemes require disability even if DB flag missed it
  if (program.category === 'Disability Support' && !has_disability) return false;

  // ── Keyword-based age safety for schemes where DB age defaults (0–120) were stored ──
  // These catch cases where the eligibility text had no explicit age numbers to parse.
  const schemeText = ((program.name || '') + ' ' + (program.description || '')).toLowerCase();

  // Category-level rule: Education schemes without explicit age bounds are for students/young adults
  if (
    program.category === 'Education' &&
    program.min_age === 0 && program.max_age === 120 &&
    age > 35
  ) return false;

  // School / student / education-loan schemes
  if (
    program.min_age === 0 && program.max_age === 120 &&
    /\bstudent\b|\bschool\b|\b10th\b|\b11th\b|\b12th\b|\bsslc\b|\bhsc\b|\bmatric\b|\bscholarship\b|\beducation loan\b|\bloan subsidy\b|\bfellowship\b|\bundergraduate\b|\bpostgraduate\b|\bcollege\b|\buniversity\b|\bexamination\b|\bacademic\b|\btuition\b/.test(schemeText) &&
    age > 35
  ) return false;

  // Campus recruitment / placement schemes — for fresh graduates / young job seekers
  if (
    program.max_age === 120 &&
    /campus recruitment|campus placement|campus assistance|fresh graduate|fresher/.test(schemeText) &&
    age > 40
  ) return false;

  // Apprenticeship / internship / trainee schemes
  if (
    program.max_age === 120 &&
    /\bapprenticeship\b|\binternship\b|\btrainee\b/.test(schemeText) &&
    age > 35
  ) return false;

  // Child / juvenile welfare schemes
  if (
    program.max_age === 120 &&
    /\bchild\b|\bchildren\b|\bjuvenile\b|\borphan\b/.test(schemeText) &&
    age > 18
  ) return false;

  // Schemes explicitly for senior citizens / old age
  if (
    program.min_age === 0 &&
    /senior citizen|old age|elderly|aged person/.test(schemeText) &&
    age < 60
  ) return false;

  // Widow / widower — only applicable after typical adult age
  if (
    /\bwidow\b|\bwidower\b/.test(schemeText) &&
    age < 18
  ) return false;

  // Maternity / pregnancy schemes — reproductive age range
  if (
    program.max_age === 120 &&
    /\bmaternity\b|\bpregnant\b|\bpregnancy\b|\bnursing mother\b/.test(schemeText) &&
    (age < 15 || age > 55)
  ) return false;

  // Schemes for new/young entrepreneurs — usually target working-age adults
  if (
    program.max_age === 120 &&
    /young entrepreneur|youth entrepreneurship/.test(schemeText) &&
    age > 45
  ) return false;

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

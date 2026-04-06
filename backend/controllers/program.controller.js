const db = require('../config/db');

const getAllPrograms = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM programs WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, programs: rows });
  } catch (err) {
    console.error('Get programs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch programs.' });
  }
};

const getProgramById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM programs WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Program not found.' });
    }
    res.json({ success: true, program: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createProgram = async (req, res) => {
  const {
    name, description, category, min_age, max_age,
    min_income, max_income, employment_status,
    disability_required, citizenship_required
  } = req.body;

  try {
    const [result] = await db.execute(
      `INSERT INTO programs 
        (name, description, category, min_age, max_age, min_income, max_income, employment_status, disability_required, citizenship_required)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, category, min_age, max_age, min_income, max_income,
       employment_status || 'any', disability_required || false, citizenship_required !== false]
    );
    res.status(201).json({ success: true, message: 'Program created.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create program.' });
  }
};

const updateProgram = async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const keys = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(fields), id];

  try {
    await db.execute(`UPDATE programs SET ${keys} WHERE id = ?`, values);
    res.json({ success: true, message: 'Program updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update program.' });
  }
};

const deleteProgram = async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('UPDATE programs SET is_active = FALSE WHERE id = ?', [id]);
    res.json({ success: true, message: 'Program deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to deactivate program.' });
  }
};

module.exports = { getAllPrograms, getProgramById, createProgram, updateProgram, deleteProgram };

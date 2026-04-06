const db = require('../config/db');

const submitApplication = async (req, res) => {
  const { program_id } = req.body;
  const user_id = req.user.id;

  if (!program_id) {
    return res.status(400).json({ success: false, message: 'program_id is required.' });
  }

  try {
    const [existing] = await db.execute(
      'SELECT id FROM applications WHERE user_id = ? AND program_id = ? AND status IN ("pending", "under_review")',
      [user_id, program_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'You already have a pending application for this program.' });
    }

    const [result] = await db.execute(
      'INSERT INTO applications (user_id, program_id) VALUES (?, ?)',
      [user_id, program_id]
    );
    res.status(201).json({ success: true, message: 'Application submitted successfully.', id: result.insertId });
  } catch (err) {
    console.error('Submit application error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit application.' });
  }
};

const getMyApplications = async (req, res) => {
  const user_id = req.user.id;
  try {
    const [rows] = await db.execute(
      `SELECT a.*, p.name as program_name, p.category, p.description
       FROM applications a
       JOIN programs p ON a.program_id = p.id
       WHERE a.user_id = ?
       ORDER BY a.submitted_at DESC`,
      [user_id]
    );
    res.json({ success: true, applications: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch applications.' });
  }
};

const getAllApplications = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT a.*, u.full_name, u.email, p.name as program_name
       FROM applications a
       JOIN users u ON a.user_id = u.id
       JOIN programs p ON a.program_id = p.id
       ORDER BY a.submitted_at DESC`
    );
    res.json({ success: true, applications: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch applications.' });
  }
};

const updateApplicationStatus = async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const reviewer_id = req.user.id;

  const validStatuses = ['approved', 'rejected', 'under_review'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }

  try {
    await db.execute(
      'UPDATE applications SET status = ?, notes = ?, reviewer_id = ?, reviewed_at = NOW() WHERE id = ?',
      [status, notes || null, reviewer_id, id]
    );
    res.json({ success: true, message: `Application ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update application.' });
  }
};

module.exports = { submitApplication, getMyApplications, getAllApplications, updateApplicationStatus };

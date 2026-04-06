const db = require('../config/db');

const getProfile = async (req, res) => {
  const user_id = req.user.id;
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.full_name, u.email, u.role, u.created_at,
              cp.date_of_birth, cp.aadhaar_number, cp.phone, cp.address,
              cp.state, cp.district, cp.city, cp.pincode,
              cp.annual_income, cp.employment_status, cp.has_disability,
              cp.is_citizen, cp.gender, cp.caste
       FROM users u
       LEFT JOIN citizen_profiles cp ON u.id = cp.user_id
       WHERE u.id = ?`,
      [user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }
    res.json({ success: true, profile: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
};

const updateProfile = async (req, res) => {
  const user_id = req.user.id;
  const {
    full_name, phone, date_of_birth, aadhaar_number,
    address, state, district, city, pincode,
    annual_income, employment_status, occupation, has_disability, is_citizen,
    gender, caste,
  } = req.body;

  try {
    if (full_name) {
      await db.execute('UPDATE users SET full_name = ? WHERE id = ?', [full_name, user_id]);
    }

    await db.execute(
      `INSERT INTO citizen_profiles
        (user_id, phone, date_of_birth, aadhaar_number, address, state, district, city, pincode,
         annual_income, employment_status, occupation, has_disability, is_citizen, gender, caste)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        phone = VALUES(phone),
        date_of_birth = VALUES(date_of_birth),
        aadhaar_number = VALUES(aadhaar_number),
        address = VALUES(address),
        state = VALUES(state),
        district = VALUES(district),
        city = VALUES(city),
        pincode = VALUES(pincode),
        annual_income = VALUES(annual_income),
        employment_status = VALUES(employment_status),
        occupation = VALUES(occupation),
        has_disability = VALUES(has_disability),
        is_citizen = VALUES(is_citizen),
        gender = VALUES(gender),
        caste = VALUES(caste)`,
      [user_id, phone || null, date_of_birth || null, aadhaar_number || null,
       address || null, state || null, district || null, city || null, pincode || null,
       annual_income || null, employment_status || 'unemployed',
       occupation || 'other',
       has_disability || false, is_citizen !== false,
       gender || 'male', caste || 'General']
    );

    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};

module.exports = { getProfile, updateProfile };

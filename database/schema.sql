-- Government Eligibility Checker - MySQL Schema (India)
-- Run this file to initialize the database

CREATE DATABASE IF NOT EXISTS gov_eligibility_db;
USE gov_eligibility_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('citizen', 'officer', 'admin') DEFAULT 'citizen',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Government schemes/programs table
CREATE TABLE IF NOT EXISTS programs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  min_age INT DEFAULT 0,
  max_age INT DEFAULT 120,
  min_income DECIMAL(15, 2) DEFAULT 0,
  max_income DECIMAL(15, 2) DEFAULT 99999999,
  employment_status ENUM('employed', 'unemployed', 'self_employed', 'retired', 'any') DEFAULT 'any',
  required_occupation VARCHAR(100) DEFAULT 'any',
  disability_required BOOLEAN DEFAULT FALSE,
  citizenship_required BOOLEAN DEFAULT TRUE,
  gender ENUM('male', 'female', 'any') DEFAULT 'any',
  caste ENUM('SC', 'ST', 'OBC', 'General', 'any') DEFAULT 'any',
  state VARCHAR(100) DEFAULT 'All India',
  official_link VARCHAR(500) DEFAULT NULL,
  documents_required TEXT DEFAULT NULL,
  -- Sync tracking columns
  external_id VARCHAR(150) DEFAULT NULL UNIQUE,
  content_hash VARCHAR(64) DEFAULT NULL,
  source_api VARCHAR(200) DEFAULT 'manual',
  last_synced_at TIMESTAMP NULL DEFAULT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sync run logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL DEFAULT NULL,
  status ENUM('running', 'success', 'failed') DEFAULT 'running',
  sync_type ENUM('full', 'incremental') DEFAULT 'incremental',
  schemes_fetched INT DEFAULT 0,
  schemes_inserted INT DEFAULT 0,
  schemes_updated INT DEFAULT 0,
  schemes_deleted INT DEFAULT 0,
  schemes_skipped INT DEFAULT 0,
  error_message TEXT DEFAULT NULL
);

-- Eligibility check results table
CREATE TABLE IF NOT EXISTS eligibility_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  program_id INT NOT NULL,
  age INT,
  income DECIMAL(15, 2),
  employment_status VARCHAR(50),
  occupation VARCHAR(100),
  has_disability BOOLEAN DEFAULT FALSE,
  is_citizen BOOLEAN DEFAULT TRUE,
  gender VARCHAR(10) DEFAULT 'any',
  caste VARCHAR(20) DEFAULT 'any',
  state VARCHAR(100) DEFAULT 'All India',
  ml_score DECIMAL(5, 4),
  is_eligible BOOLEAN NOT NULL,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);

-- Citizen profiles table (extended user info)
CREATE TABLE IF NOT EXISTS citizen_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  date_of_birth DATE,
  aadhaar_number VARCHAR(20),
  phone VARCHAR(20),
  address TEXT,
  state VARCHAR(100),
  district VARCHAR(100),
  city VARCHAR(100),
  pincode VARCHAR(10),
  annual_income DECIMAL(15, 2),
  employment_status ENUM('employed', 'unemployed', 'self_employed', 'retired') DEFAULT 'unemployed',
  occupation VARCHAR(100) DEFAULT 'other',
  has_disability BOOLEAN DEFAULT FALSE,
  is_citizen BOOLEAN DEFAULT TRUE,
  gender ENUM('male', 'female', 'other') DEFAULT 'male',
  caste ENUM('SC', 'ST', 'OBC', 'General') DEFAULT 'General',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- SEED: Indian Central Government Schemes (38 schemes)
-- required_occupation values:
--   'any'           → open to all occupations
--   'farmer'        → must be a farmer / agricultural worker
--   'student'       → must be a student
--   'street_vendor' → must be a street vendor
--   'business'      → entrepreneur / business owner
--   'armed_forces'  → ex-servicemen / defence personnel
--   'unorganised_worker' → daily wage / informal sector worker
-- ============================================================

INSERT INTO programs (name, description, category, min_age, max_age, min_income, max_income, employment_status, required_occupation, disability_required, citizenship_required, gender, caste, state, official_link, documents_required) VALUES

-- SOCIAL WELFARE & PENSION
('Indira Gandhi National Old Age Pension Scheme (IGNOAPS)',
 'Monthly pension of ₹200 (ages 60-79) and ₹500 (ages 80+) for destitute elderly citizens living below the poverty line. Provided under the National Social Assistance Programme.',
 'Social Welfare', 60, 120, 0, 300000, 'any', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://nsap.nic.in',
 '["Aadhaar Card", "Age Proof (Birth Certificate / School Certificate)", "BPL Ration Card", "Bank Passbook", "2 Passport Size Photos", "Income Certificate"]'),

('Indira Gandhi National Widow Pension Scheme (IGNWPS)',
 'Monthly pension of ₹300 for widows aged 40–79 years from BPL households. Part of the National Social Assistance Programme to provide social security to destitute widows.',
 'Social Welfare', 40, 79, 0, 300000, 'any', 'any', FALSE, TRUE, 'female', 'any', 'All India',
 'https://nsap.nic.in',
 '["Aadhaar Card", "Husband''s Death Certificate", "BPL Ration Card", "Bank Passbook", "2 Passport Size Photos", "Income Certificate", "Age Proof"]'),

('National Family Benefit Scheme (NFBS)',
 'One-time lump sum assistance of ₹20,000 to bereaved BPL households on the death of the primary breadwinner aged 18–60 years.',
 'Social Welfare', 0, 120, 0, 300000, 'any', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://nsap.nic.in',
 '["Aadhaar Card", "Death Certificate of Breadwinner", "BPL Ration Card", "Bank Passbook", "Income Certificate", "Relationship Proof"]'),

('PM Jan Dhan Yojana (PMJDY)',
 'Zero-balance savings account with ₹2 lakh accident insurance, ₹30,000 life insurance, RuPay debit card, and overdraft facility up to ₹10,000 for unbanked citizens.',
 'Financial Inclusion', 10, 120, 0, 500000, 'any', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://pmjdy.gov.in',
 '["Aadhaar Card (with KYC)", "2 Passport Size Photos", "Address Proof", "PAN Card (if available)"]'),

-- DISABILITY
('Indira Gandhi National Disability Pension Scheme (IGNDPS)',
 'Monthly pension of ₹300 for persons with 80% or more severe/multiple disabilities aged 18–79 years from BPL households under NSAP.',
 'Disability Support', 18, 79, 0, 300000, 'any', 'any', TRUE, TRUE, 'any', 'any', 'All India',
 'https://nsap.nic.in',
 '["Aadhaar Card", "Disability Certificate (80% or more)", "BPL Ration Card", "Bank Passbook", "2 Passport Size Photos", "Income Certificate", "Age Proof"]'),

('Assistance to Disabled Persons for Purchase of Aids & Appliances (ADIP)',
 'Financial assistance for purchase of assistive devices and aids (wheelchairs, hearing aids, artificial limbs, Braille kits) for persons with disabilities with income up to ₹20,000/month.',
 'Disability Support', 0, 120, 0, 240000, 'any', 'any', TRUE, TRUE, 'any', 'any', 'All India',
 'https://depwd.gov.in/adip/',

('Deendayal Disabled Rehabilitation Scheme (DDRS)',
 'Grants to NGOs to provide comprehensive rehabilitation services — education, vocational training, early intervention, and livelihood support for persons with disabilities.',
 'Disability Support', 0, 120, 0, 300000, 'any', 'any', TRUE, TRUE, 'any', 'any', 'All India',
 'https://depwd.gov.in/',

-- HOUSING
('Pradhan Mantri Awas Yojana – Gramin (PMAY-G)',
 'Financial assistance of ₹1.20 lakh (plains) and ₹1.30 lakh (NE/hilly states) for construction of a pucca house for homeless or kutcha-house-dwelling BPL rural households.',
 'Housing', 18, 120, 0, 300000, 'any', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://pmayg.nic.in',
 '["Aadhaar Card", "BPL Ration Card", "Bank Passbook", "SECC Data Printout", "Land Ownership Proof", "2 Passport Size Photos", "Income Certificate", "Caste Certificate (if applicable)"]'),

('Pradhan Mantri Awas Yojana – Urban (PMAY-U)',
 'Credit-linked subsidy for EWS (income up to ₹3 lakh), LIG (₹3–6 lakh), MIG-I (₹6–12 lakh), and MIG-II (₹12–18 lakh) for home purchase/construction. Subsidy up to ₹2.67 lakh.',
 'Housing', 21, 120, 0, 1800000, 'any', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://pmaymis.gov.in',
 '["Aadhaar Card (with KYC)", "Income Certificate / Salary Slip", "Bank Passbook", "Property Documents", "2 Passport Size Photos", "Self-Declaration of No Pucca House", "PAN Card"]'),

-- HEALTH
('Ayushman Bharat – PM Jan Arogya Yojana (PMJAY)',
 'Cashless health insurance cover of ₹5 lakh per family per year for secondary and tertiary hospitalisation. Covers 1,929 medical procedures for SECC-identified BPL families.',
 'Health', 0, 120, 0, 300000, 'any', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://pmjay.gov.in',
 '["Aadhaar Card", "SECC / Ration Card", "Ayushman Card (Golden Card)", "Bank Passbook", "2 Passport Size Photos", "Income Certificate"]'),

('Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA)',
 'Free assured antenatal care on the 9th of every month at government health facilities for all pregnant women — early detection of high-risk pregnancies.',
 'Health', 15, 49, 0, 999999, 'any', 'any', FALSE, TRUE, 'female', 'any', 'All India',
 'https://pmsma.nhp.gov.in',
 '["Aadhaar Card", "Pregnancy Registration Card", "2 Passport Size Photos", "Last Menstrual Period (LMP) Record"]'),

('Janani Suraksha Yojana (JSY)',
 'Cash assistance to pregnant women from BPL/SC/ST households for institutional delivery — ₹1,400 in rural areas and ₹1,000 in urban areas to reduce maternal and infant mortality.',
 'Health', 15, 49, 0, 300000, 'any', 'any', FALSE, TRUE, 'female', 'any', 'All India',
 'https://nhm.gov.in/index1.php?lang=1&level=3&sublinkid=841',
 '["Aadhaar Card", "BPL/SC/ST Certificate", "Bank Passbook", "2 Passport Size Photos", "Pregnancy Registration Card", "Institutional Delivery Certificate from Hospital"]'),

('Rashtriya Swasthya Bima Yojana (RSBY)',
 'Smart card-based health insurance cover of ₹30,000 per family per year for hospitalisation for unorganised sector BPL workers and their families (up to 5 members).',
 'Health', 0, 120, 0, 300000, 'any', 'unorganised_worker', FALSE, TRUE, 'any', 'any', 'All India',
 'https://www.india.gov.in/spotlight/rashtriya-swasthya-bima-yojana',
 '["Aadhaar Card", "BPL Ration Card", "Employment Proof (Unorganised Sector)", "Bank Passbook", "2 Passport Size Photos", "Income Certificate", "Family Composition Certificate"]'),

-- EDUCATION
('PM Scholarship Scheme (PMSS) – Ex-Servicemen',
 'Scholarship for wards and widows of ex-servicemen/ex-coast guard personnel — ₹2,500/month for girls and ₹2,250/month for boys for professional degree courses (4-5 years).',
 'Education', 16, 30, 0, 800000, 'any', 'student', FALSE, TRUE, 'any', 'any', 'All India',
 'https://ksb.gov.in/',
 '["Aadhaar Card", "Ex-Serviceman PPO / Discharge Book", "Admission Letter from Institution", "Previous Year Marksheet", "Bank Passbook", "2 Passport Size Photos", "Income Certificate", "Bonafide Certificate"]'),

('Post Matric Scholarship Scheme for SC Students',
 'Full financial assistance including maintenance allowance, study tour charges, thesis allowance for SC students pursuing post-matric education. Family income up to ₹2.5 lakh/year.',
 'Education', 15, 35, 0, 250000, 'any', 'student', FALSE, TRUE, 'any', 'SC', 'All India',
 'https://scholarships.gov.in',
 '["Aadhaar Card", "SC Caste Certificate", "Income Certificate (family income)", "Previous Year Marksheet", "Admission Letter", "Bank Passbook", "2 Passport Size Photos", "Bonafide Certificate"]'),

('Post Matric Scholarship Scheme for ST Students',
 'Financial assistance to ST students pursuing post-matriculation or post-secondary education to enable them to complete their education. Family income limit ₹2.5 lakh/year.',
 'Education', 15, 35, 0, 250000, 'any', 'student', FALSE, TRUE, 'any', 'ST', 'All India',
 'https://scholarships.gov.in',
 '["Aadhaar Card", "ST Caste Certificate", "Income Certificate (family income)", "Previous Year Marksheet", "Admission Letter", "Bank Passbook", "2 Passport Size Photos", "Bonafide Certificate"]'),

('National Means-cum-Merit Scholarship (NMMS)',
 'Scholarship of ₹12,000/year for meritorious students from EWS families studying in state government schools in Classes IX–XII. Parental income limit ₹3.5 lakh/year.',
 'Education', 13, 18, 0, 350000, 'any', 'student', FALSE, TRUE, 'any', 'any', 'All India',
 'https://scholarships.gov.in',
 '["Aadhaar Card", "Class VIII Marksheet (qualifying exam)", "Income Certificate (parental)", "School Bonafide Certificate", "Bank Passbook", "2 Passport Size Photos", "Domicile Certificate"]'),

('Sukanya Samriddhi Yojana (SSY)',
 'Small deposit savings scheme for the girl child — account opened for girls below 10 years. 8.2% p.a. interest (2024-25), tax-free maturity corpus, minimum ₹250/year deposit.',
 'Education', 0, 10, 0, 999999, 'any', 'any', FALSE, TRUE, 'female', 'any', 'All India',
 'https://www.indiapost.gov.in',
 '["Girl Child''s Birth Certificate", "Parent/Guardian''s Aadhaar Card", "Parent/Guardian''s PAN Card", "2 Passport Size Photos of Parent", "Address Proof"]'),

('Pre-Matric Scholarship for Minorities',
 'Scholarship for minority community students (Muslim, Christian, Sikh, Buddhist, Zoroastrian, Jain) studying in Classes I–X with family income below ₹1 lakh/year.',
 'Education', 6, 16, 0, 100000, 'any', 'student', FALSE, TRUE, 'any', 'any', 'All India',
 'https://scholarships.gov.in',
 '["Aadhaar Card", "Minority Community Certificate", "Income Certificate (family)", "Previous Year Marksheet", "School Bonafide Certificate", "Bank Passbook", "2 Passport Size Photos"]'),

('Dr. Ambedkar Post-Matric Scholarship for OBC Students',
 'Scholarship for OBC students pursuing post-matriculation education. Covers tuition fees, maintenance allowance, study tour. Family income up to ₹1 lakh/year.',
 'Education', 15, 35, 0, 100000, 'any', 'student', FALSE, TRUE, 'any', 'OBC', 'All India',
 'https://scholarships.gov.in',
 '["Aadhaar Card", "OBC Non-Creamy Layer Certificate", "Income Certificate", "Previous Year Marksheet", "Admission Letter", "Bank Passbook", "2 Passport Size Photos", "Bonafide Certificate"]'),

-- EMPLOYMENT & SKILL
('Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA)',
 'Guarantees 100 days of wage employment per financial year to every rural household willing to do unskilled manual work at statutory minimum wage (avg ₹220–₹357/day by state).',
 'Employment', 18, 120, 0, 200000, 'unemployed', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://nrega.nic.in',
 '["Aadhaar Card", "Job Card (MGNREGA Job Card from Gram Panchayat)", "Bank Passbook / Post Office Account", "2 Passport Size Photos", "Address Proof"]'),

('Pradhan Mantri Kaushal Vikas Yojana (PMKVY 4.0)',
 'Free short-duration skill training (150–300 hours) aligned with industry needs for youth aged 15–45. Monetary reward of ₹8,000 on successful NSQF-certified training completion.',
 'Employment', 15, 45, 0, 500000, 'unemployed', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://www.pmkvyofficial.org',
 '["Aadhaar Card", "Educational Qualification Certificate", "Bank Passbook", "2 Passport Size Photos", "Mobile Number linked to Aadhaar"]'),

('PM SVANidhi – PM Street Vendor AtmaNirbhar Nidhi',
 'Collateral-free working capital loans of ₹10,000 (1st), ₹20,000 (2nd), ₹50,000 (3rd) for street vendors to resume livelihoods. Interest subsidy and digital transaction incentive.',
 'Employment', 18, 65, 0, 300000, 'self_employed', 'street_vendor', FALSE, TRUE, 'any', 'any', 'All India',
 'https://pmsvanidhi.mohua.gov.in',
 '["Aadhaar Card", "Street Vending Certificate / Letter of Recommendation from ULB", "Bank Passbook", "2 Passport Size Photos", "Mobile Number"]'),

('Stand-Up India Scheme',
 'Bank loans between ₹10 lakh and ₹1 crore for at least one SC/ST borrower and one woman borrower per bank branch to set up greenfield enterprises in manufacturing, services, or trading.',
 'Employment', 18, 120, 0, 999999, 'any', 'business', FALSE, TRUE, 'any', 'any', 'All India',
 'https://www.standupmitra.in',
 '["Aadhaar Card", "PAN Card", "Caste Certificate (SC/ST) or Gender Proof", "Business Plan / Project Report", "Bank Statement (6 months)", "2 Passport Size Photos", "Address Proof", "Income Tax Returns (if applicable)"]'),

('PM Rozgar Protsahan Yojana (PMRPY)',
 'Government pays the 8.33% EPS employer contribution for new employees earning up to ₹15,000/month for 3 years, incentivising formal sector job creation. New employees under EPFO.',
 'Employment', 18, 60, 0, 180000, 'employed', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://pmrpy.gov.in',
 '["Aadhaar Card (linked with UAN)", "UAN (Universal Account Number)", "EPFO Registration of Employer", "Salary Slip", "Bank Passbook"]'),

('Venture Capital Fund for Scheduled Castes',
 'Concessional finance/venture capital to SC entrepreneurs for setting up businesses. Loan at 2% p.a. interest rate up to ₹5 crore for SC-owned enterprises.',
 'Employment', 18, 120, 0, 999999, 'any', 'business', FALSE, TRUE, 'any', 'SC', 'All India',
 'https://www.nsfdc.nic.in',
 '["Aadhaar Card", "SC Caste Certificate", "PAN Card", "Business Plan / Project Report", "Bank Statement (6 months)", "2 Passport Size Photos", "Address Proof", "Income Tax Returns (if filed)"]'),

-- AGRICULTURE (farmer occupation required)
('Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
 'Income support of ₹6,000/year in three equal instalments of ₹2,000 directly to small and marginal farmer families with cultivable landholding. Mandatory Aadhaar and e-KYC.',
 'Agriculture', 18, 120, 0, 500000, 'any', 'farmer', FALSE, TRUE, 'any', 'any', 'All India',
 'https://pmkisan.gov.in',
 '["Aadhaar Card (with e-KYC mandatory)", "Land Records / Khatoni / Patta", "Bank Passbook", "2 Passport Size Photos", "Mobile Number linked to Aadhaar"]'),

('PM Fasal Bima Yojana (PMFBY)',
 'Crop insurance covering sowing risk, standing crop loss (natural calamities, pests, diseases), and post-harvest losses. Premium 1.5–5% for farmers; rest subsidised by government.',
 'Agriculture', 18, 120, 0, 1000000, 'any', 'farmer', FALSE, TRUE, 'any', 'any', 'All India',
 'https://pmfby.gov.in',
 '["Aadhaar Card", "Land Records / Khatoni", "Sown Crop Declaration", "Bank Passbook", "2 Passport Size Photos", "Kisan Credit Card (if available)", "Sowing Certificate from Patwari"]'),

('Kisan Credit Card (KCC) Scheme',
 'Revolving credit facility for farmers at subsidised interest rate of 4% p.a. (with interest subvention) for crop production, post-harvest, allied activities, and consumption needs.',
 'Agriculture', 18, 120, 0, 1000000, 'any', 'farmer', FALSE, TRUE, 'any', 'any', 'All India',
 'https://www.nabard.org',
 '["Aadhaar Card", "Land Records / Patta", "Bank Passbook", "2 Passport Size Photos", "PAN Card", "Address Proof", "Income Proof"]'),

-- WOMEN & CHILD
('Pradhan Mantri Matru Vandana Yojana (PMMVY)',
 'Maternity benefit of ₹5,000 in three instalments for the first live birth to compensate for wage loss during pregnancy and lactation. DBT to beneficiary''s bank account.',
 'Women & Child', 18, 49, 0, 800000, 'any', 'any', FALSE, TRUE, 'female', 'any', 'All India',
 'https://wcd.nic.in/schemes/pradhan-mantri-matru-vandana-yojana',
 '["Aadhaar Card", "MCP (Mother and Child Protection) Card", "Bank Passbook", "2 Passport Size Photos", "Pregnancy Registration Certificate", "Husband''s Aadhaar Card"]'),

('Beti Bachao Beti Padhao (BBBP)',
 'Addresses declining child sex ratio and promotes welfare, education and empowerment of the girl child. Focused on 405 districts with low child sex ratio. Awareness and scheme convergence.',
 'Women & Child', 0, 18, 0, 999999, 'any', 'any', FALSE, TRUE, 'female', 'any', 'All India',
 'https://wcd.nic.in/bbbp-schemes',
 '["Aadhaar Card of Girl Child / Parent", "Girl Child''s Birth Certificate", "2 Passport Size Photos", "Address Proof"]'),

('Pradhan Mantri Ujjwala Yojana 2.0 (PMUY)',
 'Free LPG connection with first free refill and stove to women from BPL/SC/ST/PMAY/forest dweller/tea garden worker households. Reduces indoor air pollution from solid fuels.',
 'Women & Child', 18, 120, 0, 300000, 'any', 'any', FALSE, TRUE, 'female', 'any', 'All India',
 'https://pmuy.gov.in',
 '["Aadhaar Card", "BPL / SC / ST / PMAY Ration Card", "2 Passport Size Photos", "Address Proof", "Self-Declaration of No LPG Connection", "Bank Passbook"]'),

('One Stop Centre (OSC) – Sakhi',
 'Integrated support and assistance to women affected by violence — police facilitation, medical aid, legal aid, psychosocial counselling, temporary shelter under one roof.',
 'Women & Child', 0, 120, 0, 999999, 'any', 'any', FALSE, TRUE, 'female', 'any', 'All India',
 'https://wcd.nic.in/schemes/one-stop-centre-osc-scheme',
 '["Aadhaar Card (if available)", "Any ID proof", "2 Passport Size Photos (if available)"]'),

-- INSURANCE & PENSION
('Atal Pension Yojana (APY)',
 'Guaranteed monthly pension of ₹1,000–₹5,000 at age 60 for unorganised sector workers aged 18–40. Subscriber contributes based on chosen pension amount. Government co-contribution for eligible subscribers.',
 'Financial Inclusion', 18, 40, 0, 500000, 'any', 'unorganised_worker', FALSE, TRUE, 'any', 'any', 'All India',
 'https://npscra.nsdl.co.in/scheme-details.php',
 '["Aadhaar Card", "Bank Passbook (with savings account)", "Mobile Number linked to Aadhaar", "2 Passport Size Photos"]'),

('PM Jeevan Jyoti Bima Yojana (PMJJBY)',
 'Renewable one-year term life insurance cover of ₹2 lakh for death due to any cause. Annual premium of ₹436 (2023-24). Available to bank account holders aged 18–50 years.',
 'Financial Inclusion', 18, 50, 0, 999999, 'any', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://jansuraksha.gov.in',
 '["Aadhaar Card", "Bank Passbook (savings account)", "2 Passport Size Photos", "Nomination Details"]'),

('PM Suraksha Bima Yojana (PMSBY)',
 'Accidental death and disability insurance cover of ₹2 lakh (full disability) / ₹1 lakh (partial disability) for bank account holders aged 18–70. Annual premium of just ₹20.',
 'Financial Inclusion', 18, 70, 0, 999999, 'any', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://jansuraksha.gov.in',
 '["Aadhaar Card", "Bank Passbook (savings account)", "2 Passport Size Photos", "Nomination Details"]'),

-- SENIOR CITIZENS
('Senior Citizen Savings Scheme (SCSS)',
 'High-interest savings scheme for senior citizens aged 60+ (55+ for VRS/superannuation retirees). Interest rate 8.2% p.a. (2024-25), quarterly payouts, max deposit ₹30 lakh.',
 'Social Welfare', 60, 120, 0, 999999, 'retired', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://www.indiapost.gov.in',
 '["Aadhaar Card", "PAN Card", "Age Proof (Birth Certificate / Passport)", "Retirement / VRS Certificate", "Bank Passbook", "2 Passport Size Photos", "Address Proof"]'),

('Rashtriya Vayoshri Yojana (RVY)',
 'Provides assisted-living devices and aids (walking sticks, elbow crutches, wheelchairs, hearing aids, spectacles, dentures) free of cost to BPL senior citizens with age-related disabilities.',
 'Social Welfare', 60, 120, 0, 300000, 'any', 'any', FALSE, TRUE, 'any', 'any', 'All India',
 'https://scw.dosje.gov.in/rashtriya-vayoshri-yojana',
 '["Aadhaar Card", "Age Proof", "BPL Ration Card", "Medical Certificate for Age-Related Ailment", "2 Passport Size Photos", "Bank Passbook"]');

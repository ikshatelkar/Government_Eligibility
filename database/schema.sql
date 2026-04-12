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

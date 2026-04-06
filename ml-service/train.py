"""
Training script for the Government Eligibility Checker ML model (India).
Generates synthetic training data and trains a Random Forest classifier.
Run this once before starting the Flask service: python train.py
"""

import os
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import LabelEncoder
import joblib

MODEL_DIR = "model"
MODEL_PATH = os.path.join(MODEL_DIR, "eligibility_model.pkl")
ENCODER_DIR = os.path.join(MODEL_DIR, "encoders")

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(ENCODER_DIR, exist_ok=True)

np.random.seed(42)
N = 15000

# Citizen attributes
ages = np.random.randint(0, 100, N)
incomes = np.random.randint(0, 2000000, N)
employment_options = ['employed', 'unemployed', 'self_employed', 'retired']
employment_statuses = np.random.choice(employment_options, N)
has_disability = np.random.choice([0, 1], N, p=[0.80, 0.20])
is_citizen = np.random.choice([0, 1], N, p=[0.05, 0.95])
genders = np.random.choice(['male', 'female'], N, p=[0.50, 0.50])
castes = np.random.choice(['SC', 'ST', 'OBC', 'General'], N, p=[0.20, 0.10, 0.35, 0.35])

# Program criteria (randomized)
min_ages = np.random.choice([0, 10, 15, 18, 21, 40, 60], N, p=[0.25, 0.05, 0.10, 0.30, 0.10, 0.10, 0.10])
max_ages = np.random.choice([10, 18, 35, 49, 60, 79, 120], N, p=[0.05, 0.10, 0.15, 0.15, 0.20, 0.15, 0.20])
min_incomes = np.random.choice([0, 0, 0, 100000], N, p=[0.40, 0.30, 0.20, 0.10])
max_incomes = np.random.choice([100000, 250000, 300000, 500000, 800000, 1800000, 9999999], N,
                                p=[0.10, 0.20, 0.20, 0.20, 0.15, 0.10, 0.05])
program_employment = np.random.choice(['any', 'any', 'employed', 'unemployed', 'self_employed', 'retired'], N,
                                       p=[0.40, 0.20, 0.10, 0.15, 0.10, 0.05])
disability_required = np.random.choice([0, 1], N, p=[0.85, 0.15])
citizenship_required = np.random.choice([0, 1], N, p=[0.02, 0.98])
program_gender = np.random.choice(['any', 'any', 'female', 'male'], N, p=[0.55, 0.25, 0.15, 0.05])
program_caste = np.random.choice(['any', 'any', 'SC', 'ST', 'OBC'], N, p=[0.40, 0.30, 0.10, 0.10, 0.10])

# Encoders
emp_le = LabelEncoder().fit(['employed', 'unemployed', 'self_employed', 'retired', 'any'])
gender_le = LabelEncoder().fit(['male', 'female', 'any'])
caste_le = LabelEncoder().fit(['SC', 'ST', 'OBC', 'General', 'any'])

employment_enc = emp_le.transform(employment_statuses)
prog_emp_enc = emp_le.transform(program_employment)
gender_enc = gender_le.transform(genders)
prog_gender_enc = gender_le.transform(program_gender)
caste_enc = caste_le.transform(castes)
prog_caste_enc = caste_le.transform(program_caste)

def compute_eligibility(i):
    if citizenship_required[i] and not is_citizen[i]:
        return 0
    if disability_required[i] and not has_disability[i]:
        return 0
    if ages[i] < min_ages[i] or ages[i] > max_ages[i]:
        return 0
    if incomes[i] < min_incomes[i] or incomes[i] > max_incomes[i]:
        return 0
    if program_employment[i] != 'any' and employment_statuses[i] != program_employment[i]:
        return 0
    if program_gender[i] != 'any' and genders[i] != program_gender[i]:
        return 0
    if program_caste[i] != 'any' and castes[i] != program_caste[i]:
        return 0
    return 1

labels = [compute_eligibility(i) for i in range(N)]
print(f"Class distribution — Eligible: {sum(labels)} ({100*sum(labels)/N:.1f}%), Not Eligible: {N-sum(labels)}")

X = np.column_stack([
    ages, incomes, employment_enc, has_disability, is_citizen,
    gender_enc, caste_enc,
    min_ages, max_ages, min_incomes, max_incomes,
    prog_emp_enc, disability_required, citizenship_required,
    prog_gender_enc, prog_caste_enc
])
y = np.array(labels)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(n_estimators=150, random_state=42, n_jobs=-1, class_weight='balanced')
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
print(f"\nAccuracy: {accuracy_score(y_test, y_pred):.4f}")
print(classification_report(y_test, y_pred, target_names=['Not Eligible', 'Eligible']))

# Save model and encoders
joblib.dump(model, MODEL_PATH)
joblib.dump(emp_le, os.path.join(ENCODER_DIR, 'emp_encoder.pkl'))
joblib.dump(gender_le, os.path.join(ENCODER_DIR, 'gender_encoder.pkl'))
joblib.dump(caste_le, os.path.join(ENCODER_DIR, 'caste_encoder.pkl'))

print(f"\nModel saved to {MODEL_PATH}")
print(f"Encoders saved to {ENCODER_DIR}/")

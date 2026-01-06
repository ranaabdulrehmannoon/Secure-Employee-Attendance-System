# Secure Employee Attendance System
## 📌 Project Overview

The Secure Employee Attendance System is a web-based platform designed to track and manage employee attendance with a focus on security, reliability, and regulatory compliance. It ensures accurate attendance records, protects sensitive employee information, and provides features like location verification, biometric-assisted check-in, and role-based access.

The system is post-quantum ready with encryption, authentication, and integrity measures aligned with modern security standards.
## 🎯 Objectives

- Securely track employee attendance in real-time

- Protect sensitive employee data (CNIC, biometrics, passwords)

- Enforce role-based access control for employees, HR, and admins

- Ensure confidentiality, integrity, and availability (CIA triad)

- Provide audit-ready logs and report generation

## 🛠️ Technologies Used

- Frontend	HTML, CSS, JavaScript
- Backend	Python, FastAPI
- Database	SQLite with encrypted fields (SQLAlchemy)
- Authentication	JWT (HS256), Email OTP, Biometric verification
- Communication	HTTPS (TLS 1.2+), Secure REST APIs
- Password Security	Argon2 hashing
- Data Protection	AES/Fernet encryption for PII, SHA-256 for CNIC
## 🔍 Key Features

- Role-Based Access: Employee / HR / Admin

- Location-Based Attendance: Geofence validation

- Email OTP Verification: 10-minute validity

- Biometric-Assisted Check-In: Facial recognition via OpenCV

- Secure Storage: CNIC & biometric data encrypted with AES/Fernet

- Pending/Approval Workflows: HR approval for signups and corrections

- JWT Tokens: Secure session management (24-hour expiry)

- HTTPS/TLS Security: AES-GCM ciphers for transport

## 🛡️ CIA Triad Implementation
# Confidentiality

- Transport: TLS 1.2+ (HTTPS)

- At-Rest: AES/Fernet encryption for CNIC and biometrics

- Passwords: Argon2 hashing

  # Integrity

- Attendance logs: HMAC-SHA256

- Tokens: JWT HS256

- Server-side input validation

  # Availability

- Runtime: HTTPS server ensures continuous service

- Global exception handling and request limits

- POST body size caps to prevent DoS

## 🔐 Backend Security

- TLS with AES-GCM ciphers

- JWT for authentication with 24h expiry

- Argon2 for password hashing

- HMAC-SHA256 for attendance log integrity

- Biometric verification using OpenCV facial features

## 🖥️ Frontend Security

- HTTPS for secure communication

- Camera + Canvas for facial data capture

- JWT stored securely in localStorage

- CORS configured for development hosts

## ⚙️ Authentication & Authorization

- Employee signup requires HR approval

- Login via email + password + OTP + security answer

- Biometric verification for attendance

- Role-based access ensures users see only authorized data

## 🗄️ Data Protection

- Sensitive keys stored in .env: SECRET_KEY, AES_KEY, HMAC_SECRET_KEY

- PII (CNIC, biometrics) encrypted using AES/Fernet

- CNIC stored deterministically with SHA-256 to prevent duplicates

## ✅ Security Testing

- TLS connectivity verification

- Password policy enforcement

- JWT/OTP authentication flows

- Geofence location validation

- HMAC integrity checks on attendance records

## 📌 Recommendations & Future Enhancements

- Use production TLS certificates

- Enable full database encryption at rest (e.g., SQLCipher)

- Implement rate-limiting on authentication endpoints

- Restrict CORS origins in production

- Add security headers (HSTS, XFO, XCTO)

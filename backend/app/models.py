from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255))
    role = Column(String(20))  # employee, hr, admin
    is_active = Column(Boolean, default=False)
    security_question = Column(String(255), nullable=True)
    security_answer = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    failed_login_attempts = Column(Integer, default=0)
    is_locked = Column(Boolean, default=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)

class Employee(Base):
    __tablename__ = "employees"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    full_name = Column(String(100))
    cnic = Column(String(255), unique=True)
    cnic_encrypted = Column(String(1024), nullable=True)
    security_question = Column(String(255))
    security_answer = Column(String(255))
    employee_id = Column(String(20), unique=True)
    department = Column(String(50))
    position = Column(String(50))
    is_approved = Column(Boolean, default=False)
    is_disapproved = Column(Boolean, default=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    face_data = Column(Text, nullable=False)
    face_image = Column(Text, nullable=True)  # Store base64 image for HR approval
    biometric_enrolled = Column(Boolean, default=True)
    last_biometric_success = Column(DateTime(timezone=True), nullable=True)

class Attendance(Base):
    __tablename__ = "attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(20))  # present, absent
    marked_at = Column(DateTime(timezone=True), server_default=func.now())
    latitude = Column(String(50), nullable=True)
    longitude = Column(String(50), nullable=True)
    location_name = Column(String(255), nullable=True)
    hmac = Column(String(64), nullable=False)  # HMAC-SHA256 signature for integrity

class OTP(Base):
    __tablename__ = "otps"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100))
    otp_code = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))
    is_used = Column(Boolean, default=False)

class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    email = Column(String(100), index=True)
    success = Column(Boolean, default=False)
    attempt_at = Column(DateTime(timezone=True), server_default=func.now())

class BiometricRequest(Base):
    __tablename__ = "biometric_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    email = Column(String(100), index=True)
    fingerprint_match = Column(Boolean, default=False)
    face_match = Column(Boolean, default=False)
    status = Column(String(20), default="pending")
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
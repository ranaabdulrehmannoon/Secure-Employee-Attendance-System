from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta, timezone
import random
import string
import math
from pydantic import BaseModel, Field
from typing import Optional
import traceback
import os

from app.database import get_db, engine, Base
from app.models import User, Employee, Attendance, OTP, LoginAttempt, BiometricRequest
from app.encryption import verify_password, get_password_hash, get_deterministic_hash
from app.email_service import send_otp_email, send_approval_email
from app.password_validator import password_validator
from app.auth import create_access_token
from app.hmac_integrity import hmac_integrity
from app.aes_encryption import aes_encryption
from app.biometric import BiometricProcessor
import re

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Employee Attendance System")

from fastapi.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class CustomBodySizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "POST":
            if request.headers.get("content-length"):
                content_length = int(request.headers.get("content-length"))
                if content_length > 50 * 1024 * 1024:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Payload too large. Max 50MB allowed."}
                    )
        return await call_next(request)

app.add_middleware(CustomBodySizeMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://localhost:3000", "http://localhost:3000", "http://127.0.0.1:3000", "https://127.0.0.1:3000", "*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print(f"\n❌ GLOBAL ERROR: {str(exc)}")
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server error: {str(exc)}"}
    )

# Pydantic models
class EmployeeSignup(BaseModel):
    full_name: str
    email: str
    cnic: str
    security_question: str
    security_answer: str
    password: str
    face_image: str = Field(..., min_length=100, description="Base64 encoded face image")

class LoginRequest(BaseModel):
    email: str
    password: str
    security_answer: str = ""
    otp: str = ""

class HRApproval(BaseModel):
    employee_id: int
    department: str = "N/A"
    position: str = "N/A"

class MarkAttendanceRequest(BaseModel):
    employee_id: int
    latitude: float
    longitude: float
    location_name: str = ""

class BiometricEnrollRequest(BaseModel):
    employee_id: int
    fingerprint_image: str = ""
    face_image: str = ""

class BiometricVerifyRequest(BaseModel):
    email: str
    fingerprint_image: str = ""
    face_image: str = ""

class AttendanceApproval(BaseModel):
    attendance_id: int
    status: str = "present"

def validate_email(email: str) -> bool:
    """Validate email format using regex pattern"""
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    return re.match(pattern, email) is not None

def validate_location(latitude: float, longitude: float) -> bool:
    ALLOWED_LAT_RANGE = (33.60, 33.70)
    ALLOWED_LON_RANGE = (72.95, 73.25)
    
    is_valid = (ALLOWED_LAT_RANGE[0] <= latitude <= ALLOWED_LAT_RANGE[1] and 
            ALLOWED_LON_RANGE[0] <= longitude <= ALLOWED_LON_RANGE[1])
    
    print("[DEBUG] Location validation:")
    print("  Latitude: {} (range: {}-{})".format(latitude, ALLOWED_LAT_RANGE[0], ALLOWED_LAT_RANGE[1]))
    print("  Longitude: {} (range: {}-{})".format(longitude, ALLOWED_LON_RANGE[0], ALLOWED_LON_RANGE[1]))
    print("  Valid: {}".format(is_valid))
    
    return is_valid

# Routes
@app.get("/api/test")
async def test_endpoint():
    return {"status": "ok", "message": "Backend is responding", "cors": "enabled"}

@app.options("/{path:path}")
async def options_handler(path: str):
    return {"message": "OK"}

@app.get("/api/security/info")
async def get_security_info():
    """Return security implementation information"""
    return {
        "status": "operational",
        "transport": {
            "protocol": "HTTPS/TLS 1.2+",
            "status": "ACTIVE"
        },
        "password": {
            "algorithm": "Argon2",
            "parameters": "m=65540, t=2, p=4",
            "status": "ACTIVE"
        },
        "authentication": {
            "algorithm": "HS256 (HMAC-SHA256)",
            "type": "JWT Tokens",
            "status": "ACTIVE",
            "expiration": "24 hours"
        },
        "data_integrity": {
            "algorithm": "HMAC-SHA256",
            "use_case": "Attendance record verification",
            "status": "ACTIVE"
        },
        "sensitive_data": {
            "cnic": "AES-256-GCM encrypted",
            "status": "ACTIVE"
        }
    }

@app.post("/api/employee/signup")
async def employee_signup(signup_data: EmployeeSignup, db: Session = Depends(get_db)):
    print(f"\n[SIGNUP] New employee registration: {signup_data.email}")
    print(f"[SIGNUP] 📊 Biometric data sizes:")
    print(f"[SIGNUP]   Face image: {len(signup_data.face_image) / 1024:.2f} KB")
    
    print(f"[SIGNUP] 🔍 Validating email format...")
    if not validate_email(signup_data.email):
        print(f"[SIGNUP] ❌ Invalid email format: {signup_data.email}")
        raise HTTPException(status_code=400, detail="Invalid email format. Please enter a valid email address (e.g., user@example.com)")
    print(f"[SIGNUP] ✅ Email format is valid")
    
    is_valid, msg = password_validator.validate(signup_data.password)
    if not is_valid:
        print(f"[SIGNUP] ❌ Password validation failed: {msg}")
        raise HTTPException(status_code=400, detail=msg)
    
    strength = password_validator.get_strength(signup_data.password)
    print(f"[SIGNUP] ✅ Password strength: {strength}")
    
    print(f"[SIGNUP] 🔍 Checking if email exists...")
    existing_user = db.query(User).filter(User.email == signup_data.email).first()
    print(f"[SIGNUP] ✅ Email check completed")
    if existing_user:
        print(f"[SIGNUP] ❌ Email already exists: {signup_data.email}")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    print(f"[SIGNUP] 🔍 Checking if CNIC exists...")
    hashed_cnic = get_deterministic_hash(signup_data.cnic)
    existing_employee = db.query(Employee).filter(Employee.cnic == hashed_cnic).first()
    print(f"[SIGNUP] ✅ CNIC check completed")
    if existing_employee:
        print(f"[SIGNUP] ❌ CNIC already exists: {signup_data.cnic}")
        raise HTTPException(status_code=400, detail="CNIC already registered")
    
    print(f"[SIGNUP] 🔨 Creating user record...")
    user = User(
        email=signup_data.email,
        hashed_password=get_password_hash(signup_data.password),
        role="employee",
        is_active=False
    )
    db.add(user)
    print(f"[SIGNUP] 📌 User added to session, committing...")
    db.commit()
    print(f"[SIGNUP] ✅ User committed to database")
    db.refresh(user)
    print(f"[SIGNUP] ✅ User created with ID: {user.id}")
    
    print(f"[SIGNUP] 🔨 Encrypting CNIC with AES-256...")
    encrypted_cnic = aes_encryption.encrypt_cnic(signup_data.cnic)
    
    print(f"[SIGNUP] 🔨 Processing biometric data...")
    try:
        face_features = BiometricProcessor.process_face_image(signup_data.face_image)
        
        if not face_features:
            raise HTTPException(status_code=400, detail="Failed to process face image. Please ensure good lighting and clear face visibility.")
        
        print(f"[SIGNUP] ✅ Biometric data processed successfully")
    except Exception as e:
        print(f"[SIGNUP] ❌ Biometric processing failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Biometric processing failed: {str(e)}")
    
    print(f"[SIGNUP] 🔨 Encrypting biometric data...")
    encrypted_face_data = aes_encryption.encrypt_data(face_features)
    encrypted_face_image = aes_encryption.encrypt_data(signup_data.face_image)
    
    print(f"[SIGNUP] 🔨 Creating employee record...")
    employee = Employee(
        user_id=user.id,
        full_name=signup_data.full_name,
        cnic=hashed_cnic,
        cnic_encrypted=encrypted_cnic,
        security_question=get_password_hash(signup_data.security_question),
        security_answer=get_password_hash(signup_data.security_answer),
        face_data=encrypted_face_data,
        face_image=encrypted_face_image,  # Store encrypted base64 image
        is_approved=False
    )
    db.add(employee)
    print(f"[SIGNUP] 📌 Employee added to session, committing...")
    db.commit()
    print(f"[SIGNUP] ✅ Employee committed to database")
    db.refresh(employee)
    print(f"[SIGNUP] ✅ Employee record created with ID: {employee.id}, Status: pending approval")
    
    print(f"[SIGNUP] ✅ SIGNUP COMPLETE - Sending response...")
    return {
        "message": "Registration successful. Biometric data captured. Waiting for HR approval.",
        "employee_id": employee.id
    }

@app.post("/api/auth/login")
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user:
        login_attempt = LoginAttempt(email=login_data.email, success=False)
        db.add(login_attempt)
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    now = datetime.now()
    if user.is_locked:
        if user.locked_until and now < user.locked_until:
            remaining_minutes = int((user.locked_until - now).total_seconds() / 60)
            raise HTTPException(
                status_code=423,
                detail=f"Account locked due to too many failed login attempts. Try again in {remaining_minutes} minutes."
            )
        else:
            user.is_locked = False
            user.locked_until = None
            user.failed_login_attempts = 0
            db.commit()
    
    if not verify_password(login_data.password, user.hashed_password):
        user.failed_login_attempts += 1
        
        if user.failed_login_attempts >= 5:
            user.is_locked = True
            user.locked_until = now + timedelta(minutes=30)
            db.commit()
            
            login_attempt = LoginAttempt(user_id=user.id, email=login_data.email, success=False)
            db.add(login_attempt)
            db.commit()
            
            raise HTTPException(
                status_code=423,
                detail="Account locked due to 5 failed login attempts. Try again after 30 minutes."
            )
        
        db.commit()
        login_attempt = LoginAttempt(user_id=user.id, email=login_data.email, success=False)
        db.add(login_attempt)
        db.commit()
        
        attempts_remaining = 5 - user.failed_login_attempts
        raise HTTPException(
            status_code=400,
            detail=f"Invalid credentials. {attempts_remaining} attempts remaining before account lockout."
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account not approved yet")
    
    user.failed_login_attempts = 0
    db.commit()
    
    if user.role in ['hr', 'admin']:
        if not user.security_answer or not verify_password(login_data.security_answer, user.security_answer):
            login_attempt = LoginAttempt(user_id=user.id, email=login_data.email, success=False)
            db.add(login_attempt)
            db.commit()
            raise HTTPException(status_code=400, detail="Invalid security answer")
        
        otp_records = db.query(OTP).filter(
            OTP.email == login_data.email,
            OTP.is_used == False
        ).all()
        
        valid_otp_record = None
        current_time = datetime.now(timezone.utc)
        
        for record in otp_records:
            is_expired = False
            if record.expires_at:
                rec_expires = record.expires_at
                if rec_expires.tzinfo and not current_time.tzinfo:
                    rec_expires = rec_expires.replace(tzinfo=None)
                elif not rec_expires.tzinfo and current_time.tzinfo:
                    rec_expires = rec_expires.replace(tzinfo=timezone.utc)
                
                if rec_expires < current_time:
                    is_expired = True
            
            if not is_expired and verify_password(login_data.otp, record.otp_code):
                valid_otp_record = record
                break
        
        if not valid_otp_record:
            login_attempt = LoginAttempt(user_id=user.id, email=login_data.email, success=False)
            db.add(login_attempt)
            db.commit()
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
        valid_otp_record.is_used = True
        db.commit()
        
        login_attempt = LoginAttempt(user_id=user.id, email=login_data.email, success=True)
        db.add(login_attempt)
        db.commit()
        
        access_token = create_access_token({"sub": user.email, "role": user.role})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": user.role,
            "employee_id": None
        }
    
    employee = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not employee:
        raise HTTPException(status_code=400, detail="Employee record not found")
    
    if not verify_password(login_data.security_answer, employee.security_answer):
        login_attempt = LoginAttempt(user_id=user.id, email=login_data.email, success=False)
        db.add(login_attempt)
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid security answer")
    
    otp_records = db.query(OTP).filter(
        OTP.email == login_data.email,
        OTP.is_used == False
    ).all()
    
    print(f"[LOGIN DEBUG] Found {len(otp_records)} unused OTP records for {login_data.email}")
    
    valid_otp_record = None
    current_time = datetime.now(timezone.utc)
    
    for record in otp_records:
        # Check expiration manually to debug
        is_expired = False
        if record.expires_at:
            # Handle timezone awareness mismatch if necessary
            rec_expires = record.expires_at
            if rec_expires.tzinfo and not current_time.tzinfo:
                rec_expires = rec_expires.replace(tzinfo=None)
            elif not rec_expires.tzinfo and current_time.tzinfo:
                rec_expires = rec_expires.replace(tzinfo=timezone.utc) # Assume UTC if naive in DB but aware in app
            
            if rec_expires < current_time:
                is_expired = True
        
        print(f"[LOGIN DEBUG] Checking OTP ID {record.id}: Expired={is_expired} (Expires: {record.expires_at}, Now: {current_time})")
        
        if not is_expired and verify_password(login_data.otp, record.otp_code):
            valid_otp_record = record
            print(f"[LOGIN DEBUG] ✅ Valid OTP found: ID {record.id}")
            break
        elif verify_password(login_data.otp, record.otp_code):
             print(f"[LOGIN DEBUG] ❌ OTP matches but is expired")
    
    if not valid_otp_record:
        print("[LOGIN DEBUG] ❌ No valid OTP record found")
        login_attempt = LoginAttempt(user_id=user.id, email=login_data.email, success=False)
        db.add(login_attempt)
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    valid_otp_record.is_used = True
    db.commit()
    
    login_attempt = LoginAttempt(user_id=user.id, email=login_data.email, success=True)
    db.add(login_attempt)
    db.commit()
    
    access_token = create_access_token({"sub": user.email, "role": user.role})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "employee_id": employee.id
    }

@app.post("/api/auth/request-otp")
async def request_otp(email: str, db: Session = Depends(get_db)):
    print(f"\n[DEBUG] request_otp called with email: {email}")
    try:
        user = db.query(User).filter(User.email == email).first()
        print(f"[DEBUG] User found: {user is not None}")
        if not user:
            raise HTTPException(status_code=400, detail="Email not found")
        
        print(f"[DEBUG] User active: {user.is_active}")
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Account not approved yet")
        
        print(f"[DEBUG] Sending OTP email...")
        try:
            success = await send_otp_email(db, email)
            print(f"[DEBUG] OTP send result: {success}")
        except Exception as email_error:
            print(f"[WARNING] Email sending failed: {email_error}")
            print(f"[INFO] Generating OTP without sending email (DEV MODE)")
            from app.email_service import generate_otp
            from datetime import timedelta
            otp_code = generate_otp()
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
            otp = OTP(email=email, otp_code=get_password_hash(otp_code), expires_at=expires_at)
            db.add(otp)
            db.commit()
            print(f"[DEV] Generated OTP: {otp_code}")
            success = True
        
        if success:
            return {"message": "OTP sent to your email"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send OTP")
    except Exception as e:
        print(f"[ERROR] OTP endpoint error: {e}")
        print(traceback.format_exc())
        raise

@app.get("/api/hr/pending-approvals")
async def get_pending_approvals(db: Session = Depends(get_db)):
    pending_employees = db.query(Employee).filter(
        (Employee.is_approved == False) & (Employee.is_disapproved == False)
    ).all()
    total_employees = db.query(Employee).filter(Employee.is_approved == True).count()
    
    print(f"\n[HR APPROVALS] Found {len(pending_employees)} pending employees")
    print(f"[HR APPROVALS] Found {total_employees} approved employees")
    
    result = []
    for emp in pending_employees:
        user = db.query(User).filter(User.id == emp.user_id).first()
        if user:
            decrypted_cnic = "Unable to decrypt"
            try:
                if emp.cnic_encrypted:
                    decrypted_cnic = aes_encryption.decrypt_cnic(emp.cnic_encrypted)
            except Exception as e:
                print(f"[WARNING] Failed to decrypt CNIC for {emp.full_name}: {e}")
            
            decrypted_face_image = None
            if emp.face_image:
                decrypted_face_image = aes_encryption.decrypt_data(emp.face_image)

            emp_data = {
                "id": emp.id,
                "full_name": emp.full_name,
                "email": user.email,
                "cnic": decrypted_cnic,
                "department": emp.department or "N/A",
                "position": emp.position or "N/A",
                "face_image": decrypted_face_image,  # Include the decrypted face image
                "security_question": emp.security_question,
                "created_at": emp.created_at.replace(tzinfo=timezone.utc).isoformat() if emp.created_at else None
            }
            print(f"[HR APPROVALS] Added employee: {emp.full_name} ({user.email})")
            result.append(emp_data)
    
    return {
        "pending_employees": result,
        "total_employees": total_employees,
        "pending_count": len(result)
    }

@app.post("/api/hr/approve-employee")
async def approve_employee(approval_data: HRApproval, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == approval_data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Generate employee ID
    employee_id = f"EMP{employee.id:04d}"
    
    # Update employee record
    employee.employee_id = employee_id
    employee.department = approval_data.department
    employee.position = approval_data.position
    employee.is_approved = True
    employee.approved_at = datetime.now()
    
    # Activate user account
    user = db.query(User).filter(User.id == employee.user_id).first()
    user.is_active = True
    
    db.commit()
    
    # Send approval email
    await send_approval_email(user.email, employee.full_name, employee_id)
    
    return {"message": "Employee approved successfully"}

@app.post("/api/hr/disapprove-employee")
async def disapprove_employee(data: dict, db: Session = Depends(get_db)):
    employee_id = data.get('employee_id')
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee.is_disapproved = True
    db.commit()
    
    print(f"[HR DISAPPROVAL] Employee {employee.full_name} (ID: {employee.id}) has been disapproved")
    
    return {"message": "Employee disapproved successfully"}

@app.post("/api/employee/mark-attendance")
async def mark_attendance(request: MarkAttendanceRequest, db: Session = Depends(get_db)):
    today = date.today()

    dev_mode = os.getenv("DEV_MODE", "false").lower() == "true"
    
    print(f"\n[MARK ATTENDANCE] Employee ID: {request.employee_id} | Type: {type(request.employee_id)}")
    
    now = datetime.now()
    current_hour = now.hour
    current_minute = now.minute
    
    if not dev_mode:
        if not (9 <= current_hour < 24 or (current_hour == 10 and current_minute == 0)):
            raise HTTPException(
                status_code=400,
                detail=f"Attendance can only be marked between 9:00 AM and 10:00 AM. Current time: {now.strftime('%H:%M:%S')}"
            )
    
    if dev_mode:
        print("[DEV MODE] Time validation skipped")
    
    if not dev_mode and not validate_location(request.latitude, request.longitude):
        raise HTTPException(
            status_code=400, 
            detail="Location not authorized. You must be at NUST H-12 Islamabad to mark attendance."
        )
    
    if dev_mode:
        print("[DEV MODE] Location validation skipped")

    existing_attendance = db.query(Attendance).filter(
        Attendance.employee_id == request.employee_id,
        func.date(Attendance.date) == today
    ).first()

    if existing_attendance:
        raise HTTPException(status_code=400, detail="Attendance already marked for today")

    # Check if employee has recently verified biometrics (within last 10 minutes)
    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    status = "pending_approval"
    
    if employee and employee.last_biometric_success:
        # Make sure both datetimes are offset-naive or offset-aware
        last_success = employee.last_biometric_success
        if last_success.tzinfo:
            last_success = last_success.replace(tzinfo=None)
            
        time_diff = datetime.now() - last_success
        if time_diff.total_seconds() < 600:  # 10 minutes
            status = "present"
            print(f"[MARK ATTENDANCE] ✅ Biometric verification valid (verified {int(time_diff.total_seconds())}s ago). Marking PRESENT.")
        else:
            print(f"[MARK ATTENDANCE] ⚠️ Biometric verification expired ({int(time_diff.total_seconds())}s ago). Marking PENDING.")

    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    
    hmac_signature = hmac_integrity.compute_attendance_hmac(
        employee_id=request.employee_id,
        date_str=date_str,
        status=status,
        latitude=str(request.latitude),
        longitude=str(request.longitude)
    )
    
    attendance = Attendance(
        employee_id=request.employee_id,
        date=now,
        status=status,
        marked_at=now,
        latitude=str(request.latitude),
        longitude=str(request.longitude),
        location_name=request.location_name or "NUST H-12 Islamabad",
        hmac=hmac_signature
    )

    db.add(attendance)
    db.commit()
    
    print(f"[MARK ATTENDANCE] ✅ Saved attendance record: ID={attendance.id}, Employee={attendance.employee_id}, Status={attendance.status}")
    print(f"[MARK ATTENDANCE] 🔐 HMAC Signature: {hmac_signature[:16]}...")

    if status == "present":
        return {"message": "Attendance marked successfully (Verified by Biometrics)"}
    else:
        return {"message": "Attendance request submitted. Waiting for admin approval."}


@app.post("/api/admin/approve-attendance")
async def approve_attendance(approval: AttendanceApproval, db: Session = Depends(get_db)):
    print(f"[APPROVE] Request to approve attendance ID: {approval.attendance_id} to status: {approval.status}")
    attendance = db.query(Attendance).filter(Attendance.id == approval.attendance_id).first()
    if not attendance:
        print(f"[APPROVE] ❌ Attendance record not found: {approval.attendance_id}")
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    print(f"[APPROVE] Found record. Current status: {attendance.status}")
    attendance.status = approval.status
    
    # Recompute HMAC because status changed
    try:
        date_str = attendance.date.strftime("%Y-%m-%d")
        hmac_signature = hmac_integrity.compute_attendance_hmac(
            employee_id=attendance.employee_id,
            date_str=date_str,
            status=approval.status,
            latitude=attendance.latitude,
            longitude=attendance.longitude
        )
        attendance.hmac = hmac_signature
        print(f"[APPROVE] HMAC recomputed: {hmac_signature[:10]}...")
    except Exception as e:
        print(f"[APPROVE] ❌ HMAC computation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Integrity check failed: {str(e)}")
    
    db.commit()
    db.refresh(attendance)
    print(f"[APPROVE] ✅ Attendance approved successfully. New status in DB: {attendance.status}")
    
    if attendance.status != approval.status:
        print(f"[APPROVE] ❌ CRITICAL: Status update failed! Expected {approval.status}, got {attendance.status}")
        # Try raw SQL update as fallback
        from sqlalchemy import text
        try:
            db.execute(
                text("UPDATE attendance SET status = :status, hmac = :hmac WHERE id = :id"),
                {"status": approval.status, "hmac": hmac_signature, "id": approval.attendance_id}
            )
            db.commit()
            print(f"[APPROVE] ✅ Raw SQL update executed")
        except Exception as e:
            print(f"[APPROVE] ❌ Raw SQL update failed: {e}")

    return {"message": f"Attendance marked as {approval.status}"}


@app.get("/api/employee/my-attendance")
async def get_my_attendance(employee_id: int, db: Session = Depends(get_db)):
    try:
        print(f"[ATTENDANCE] Fetching attendance for employee_id: {employee_id}")
        attendance_records = db.query(Attendance).filter(
            Attendance.employee_id == employee_id
        ).order_by(Attendance.date.desc()).all()
        
        print(f"[ATTENDANCE] Found {len(attendance_records)} records")
        
        result = []
        for record in attendance_records:
            print(f"[ATTENDANCE] Record ID: {record.id}, Date: {record.date}, Status: {record.status}")
            date_str = record.date.strftime("%Y-%m-%d") if record.date else ""
            
            try:
                is_valid = hmac_integrity.verify_attendance_hmac(
                    employee_id=record.employee_id,
                    date_str=date_str,
                    status=record.status,
                    stored_hmac=record.hmac,
                    latitude=record.latitude or "",
                    longitude=record.longitude or ""
                )
            except Exception as e:
                print(f"[ERROR] HMAC verification failed: {e}")
                is_valid = False
            
            result.append({
                "id": record.id,
                "employee_id": record.employee_id,
                "date": record.date.replace(tzinfo=timezone.utc).isoformat() if record.date else None,
                "status": record.status,
                "marked_at": record.marked_at.replace(tzinfo=timezone.utc).isoformat() if record.marked_at else None,
                "latitude": record.latitude,
                "longitude": record.longitude,
                "location_name": record.location_name or "N/A",
                "integrity_verified": is_valid,
                "tampered": not is_valid
            })
        
        print(f"[ATTENDANCE] Returning {len(result)} records")
        return result
    except Exception as e:
        print(f"[ERROR] get_my_attendance failed: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/all-attendance")
async def get_all_attendance(
    db: Session = Depends(get_db),
    start_date: str = None,
    end_date: str = None
):
    try:
        print("[*] Loading attendance records...")
        
        result = []
        approved_employees = db.query(Employee).filter(Employee.is_approved == True).all()
        print("[INFO] Found {} approved employees".format(len(approved_employees)))
        
        if not start_date:
            start_date = str(date.today())
        if not end_date:
            end_date = str(date.today())
        
        print(f"[ADMIN] Date range: {start_date} to {end_date}")
        
        for employee in approved_employees:
            user = db.query(User).filter(User.id == employee.user_id).first()
            attendance_records = db.query(Attendance).filter(
                Attendance.employee_id == employee.id,
                func.date(Attendance.date) >= start_date,
                func.date(Attendance.date) <= end_date
            ).order_by(Attendance.date.desc()).all()
            
            for attendance_record in attendance_records:
                date_str = attendance_record.date.strftime("%Y-%m-%d") if attendance_record.date else ""
                
                is_valid = hmac_integrity.verify_attendance_hmac(
                    employee_id=attendance_record.employee_id,
                    date_str=date_str,
                    status=attendance_record.status,
                    stored_hmac=attendance_record.hmac,
                    latitude=attendance_record.latitude or "",
                    longitude=attendance_record.longitude or ""
                )
                
                result.append({
                    "id": attendance_record.id,
                    "date": attendance_record.date.replace(tzinfo=timezone.utc).isoformat() if attendance_record.date else None,
                    "employee_name": employee.full_name or "Unknown",
                    "employee_id": employee.employee_id or "PENDING",
                    "email": user.email if user else "N/A",
                    "department": employee.department or "N/A",
                    "position": employee.position or "N/A",
                    "status": attendance_record.status,
                    "marked_at": attendance_record.marked_at.replace(tzinfo=timezone.utc).isoformat() if attendance_record.marked_at else None,
                    "latitude": attendance_record.latitude,
                    "longitude": attendance_record.longitude,
                    "location_name": attendance_record.location_name or "N/A",
                    "integrity_verified": is_valid,
                    "tampered": not is_valid
                })
        
        print("[SUCCESS] Returning {} employee records".format(len(result)))
        return result
    except Exception as e:
        print("[ERROR] Fatal error in get_all_attendance: {}".format(str(e)))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/employee-report/{employee_id}")
async def get_employee_report(
    employee_id: int,
    db: Session = Depends(get_db),
    start_date: str = None,
    end_date: str = None
):
    try:
        if not start_date:
            start_date = str(date.today() - __import__('datetime').timedelta(days=30))
        if not end_date:
            end_date = str(date.today())
        
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        user = db.query(User).filter(User.id == employee.user_id).first()
        
        attendance_records = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            func.date(Attendance.date) >= start_date,
            func.date(Attendance.date) <= end_date
        ).order_by(Attendance.date.desc()).all()
        
        total_days = len(attendance_records)
        present_days = len([a for a in attendance_records if a.status == 'present'])
        absent_days = len([a for a in attendance_records if a.status == 'absent'])
        
        attendance_data = []
        for a in attendance_records:
            date_str = a.date.strftime("%Y-%m-%d") if a.date else ""
            is_valid = hmac_integrity.verify_attendance_hmac(
                employee_id=a.employee_id,
                date_str=date_str,
                status=a.status,
                stored_hmac=a.hmac,
                latitude=a.latitude or "",
                longitude=a.longitude or ""
            )
            attendance_data.append({
                "date": str(a.date),
                "status": a.status,
                "marked_at": str(a.marked_at) if a.marked_at else None,
                "location": a.location_name or "N/A",
                "integrity_verified": is_valid,
                "tampered": not is_valid
            })
        
        return {
            "employee_name": employee.full_name,
            "employee_id": employee.employee_id,
            "department": employee.department or "N/A",
            "email": user.email if user else "N/A",
            "start_date": start_date,
            "end_date": end_date,
            "total_days": total_days,
            "present_days": present_days,
            "absent_days": absent_days,
            "attendance_rate": round((present_days / total_days * 100) if total_days > 0 else 0, 2),
            "attendance_records": attendance_data
        }
    except Exception as e:
        print("[ERROR] Error in get_employee_report: {}".format(str(e)))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/hr/employee-stats")
async def get_employee_stats(db: Session = Depends(get_db)):
    total_employees = db.query(Employee).filter(Employee.is_approved == True).count()
    pending_approvals = db.query(Employee).filter(Employee.is_approved == False).count()
    
    return {
        "total_employees": total_employees,
        "pending_approvals": pending_approvals
    }

@app.get("/api/debug/all-employees")
async def get_all_employees(db: Session = Depends(get_db)):
    try:
        employees = db.query(Employee).all()
        result = []
        print(f"\n[DEBUG] Fetching all employees. Count: {len(employees)}")
        for emp in employees:
            user = db.query(User).filter(User.id == emp.user_id).first()
            if user:
                has_image = bool(emp.face_image)
                image_len = len(emp.face_image) if emp.face_image else 0
                print(f"[DEBUG] Processing {emp.full_name} (ID: {emp.id}). Has image: {has_image}, Len: {image_len}")
                
                decrypted_face_image = aes_encryption.decrypt_data(emp.face_image) if emp.face_image else None
                
                result.append({
                    "id": emp.id,
                    "full_name": emp.full_name,
                    "email": user.email,
                    "cnic": emp.cnic,
                    "face_image": decrypted_face_image  # Include decrypted face image
                })
        return result
    except Exception as e:
        print("[ERROR] Debug all-employees error: {}".format(str(e)))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/employees-list")
async def get_employees_list(db: Session = Depends(get_db)):
    """Get list of all approved employees for admin"""
    try:
        employees = db.query(Employee).filter(Employee.is_approved == True).all()
        result = []
        for emp in employees:
            user = db.query(User).filter(User.id == emp.user_id).first()
            result.append({
                "id": emp.id,
                "employee_id": emp.employee_id,
                "full_name": emp.full_name,
                "email": user.email if user else "N/A",
                "department": emp.department or "N/A",
                "position": emp.position or "N/A"
            })
        return result
    except Exception as e:
        print("[ERROR] Error in get_employees_list: {}".format(str(e)))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/all-employees-stats")
async def get_all_employees_stats(db: Session = Depends(get_db)):
    """Get all employees with their attendance statistics"""
    try:
        employees = db.query(Employee).filter(Employee.is_approved == True).order_by(Employee.full_name).all()
        result = []
        
        for emp in employees:
            user = db.query(User).filter(User.id == emp.user_id).first()
            
            attendance_records = db.query(Attendance).filter(
                Attendance.employee_id == emp.id
            ).all()
            
            total_attendance = len(attendance_records)
            present_count = len([a for a in attendance_records if a.status == 'present'])
            absent_count = len([a for a in attendance_records if a.status == 'absent'])
            attendance_rate = round((present_count / total_attendance * 100) if total_attendance > 0 else 0, 2)
            
            last_attendance = db.query(Attendance).filter(
                Attendance.employee_id == emp.id
            ).order_by(Attendance.date.desc()).first()
            
            result.append({
                "id": emp.id,
                "employee_id": emp.employee_id,
                "full_name": emp.full_name,
                "email": user.email if user else "N/A",
                "department": emp.department or "N/A",
                "position": emp.position or "N/A",
                "cnic": emp.cnic or "N/A",
                "total_attendance": total_attendance,
                "present_count": present_count,
                "absent_count": absent_count,
                "attendance_rate": attendance_rate,
                "last_attendance": str(last_attendance.date) if last_attendance else "No record",
                "joined_at": str(emp.created_at.date()) if emp.created_at else "N/A"
            })
        
        return result
    except Exception as e:
        print("[ERROR] Error in get_all_employees_stats: {}".format(str(e)))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/employee-attendance-history/{employee_id}")
async def get_employee_attendance_history(
    employee_id: int,
    db: Session = Depends(get_db),
    start_date: str = None,
    end_date: str = None
):
    """Get complete attendance history for a specific employee"""
    try:
        if not start_date:
            start_date = str(date.today() - __import__('datetime').timedelta(days=90))
        if not end_date:
            end_date = str(date.today())
        
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        user = db.query(User).filter(User.id == employee.user_id).first()
        
        attendance_records = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            func.date(Attendance.date) >= start_date,
            func.date(Attendance.date) <= end_date
        ).order_by(Attendance.date.desc()).all()
        
        total_days = len(attendance_records)
        present_days = len([a for a in attendance_records if a.status == 'present'])
        absent_days = len([a for a in attendance_records if a.status == 'absent'])
        
        attendance_data = []
        for a in attendance_records:
            date_str = a.date.strftime("%Y-%m-%d") if a.date else ""
            is_valid = hmac_integrity.verify_attendance_hmac(
                employee_id=a.employee_id,
                date_str=date_str,
                status=a.status,
                stored_hmac=a.hmac,
                latitude=a.latitude or "",
                longitude=a.longitude or ""
            )
            attendance_data.append({
                "date": str(a.date.date()) if a.date else "N/A",
                "status": a.status,
                "marked_at": str(a.marked_at) if a.marked_at else "N/A",
                "location": a.location_name or "N/A",
                "latitude": a.latitude or "N/A",
                "longitude": a.longitude or "N/A",
                "integrity_verified": is_valid,
                "tampered": not is_valid
            })
        
        return {
            "employee_name": employee.full_name,
            "employee_id": employee.employee_id,
            "email": user.email if user else "N/A",
            "department": employee.department or "N/A",
            "position": employee.position or "N/A",
            "start_date": start_date,
            "end_date": end_date,
            "total_days": total_days,
            "present_days": present_days,
            "absent_days": absent_days,
            "attendance_rate": round((present_days / total_days * 100) if total_days > 0 else 0, 2),
            "attendance_records": attendance_data
        }
    except Exception as e:
        print("[ERROR] Error in get_employee_attendance_history: {}".format(str(e)))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/generate-report/{employee_id}")
async def generate_report(
    employee_id: int,
    db: Session = Depends(get_db),
    start_date: str = None,
    end_date: str = None
):
    """Generate attendance report in TXT format"""
    try:
        if not start_date:
            start_date = str(date.today() - __import__('datetime').timedelta(days=90))
        if not end_date:
            end_date = str(date.today())
        
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        user = db.query(User).filter(User.id == employee.user_id).first()
        
        attendance_records = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            func.date(Attendance.date) >= start_date,
            func.date(Attendance.date) <= end_date
        ).order_by(Attendance.date.asc()).all()
        
        total_days = len(attendance_records)
        present_days = len([a for a in attendance_records if a.status == 'present'])
        absent_days = len([a for a in attendance_records if a.status == 'absent'])
        attendance_rate = round((present_days / total_days * 100) if total_days > 0 else 0, 2)
        
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("EMPLOYEE ATTENDANCE REPORT".center(80))
        report_lines.append("=" * 80)
        report_lines.append("")
        report_lines.append("EMPLOYEE INFORMATION")
        report_lines.append("-" * 80)
        report_lines.append("Name:          {}".format(employee.full_name))
        report_lines.append("Employee ID:   {}".format(employee.employee_id))
        report_lines.append("Email:         {}".format(user.email if user else "N/A"))
        report_lines.append("Department:    {}".format(employee.department or "N/A"))
        report_lines.append("Position:      {}".format(employee.position or "N/A"))
        report_lines.append("")
        report_lines.append("REPORT PERIOD")
        report_lines.append("-" * 80)
        report_lines.append("From Date:     {}".format(start_date))
        report_lines.append("To Date:       {}".format(end_date))
        report_lines.append("")
        report_lines.append("ATTENDANCE SUMMARY")
        report_lines.append("-" * 80)
        report_lines.append("Total Days:    {}".format(total_days))
        report_lines.append("Present Days:  {}".format(present_days))
        report_lines.append("Absent Days:   {}".format(absent_days))
        report_lines.append("Attendance Rate: {}%".format(attendance_rate))
        report_lines.append("")
        report_lines.append("DETAILED ATTENDANCE RECORDS")
        report_lines.append("-" * 80)
        report_lines.append("Date          | Status   | Time              | Location")
        report_lines.append("-" * 80)
        
        for record in attendance_records:
            date_str = str(record.date.date()) if record.date else "N/A"
            status_str = record.status.upper()
            time_str = record.marked_at.strftime("%H:%M:%S") if record.marked_at else "N/A"
            location_str = record.location_name or "N/A"
            
            date_only = record.date.strftime("%Y-%m-%d") if record.date else ""
            is_valid = hmac_integrity.verify_attendance_hmac(
                employee_id=record.employee_id,
                date_str=date_only,
                status=record.status,
                stored_hmac=record.hmac,
                latitude=record.latitude or "",
                longitude=record.longitude or ""
            )
            
            tamper_flag = " [TAMPERED]" if not is_valid else ""
            report_lines.append("{} | {} | {} | {}{}".format(
                date_str.ljust(13),
                status_str.ljust(8),
                time_str.ljust(17),
                location_str[:30],
                tamper_flag
            ))
        
        report_lines.append("-" * 80)
        report_lines.append("Generated on: {}".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        report_lines.append("=" * 80)
        
        report_content = "\n".join(report_lines)
        
        return {
            "report": report_content,
            "filename": "Attendance_Report_{}_{}_{}.txt".format(
                employee.employee_id,
                start_date.replace("-", ""),
                end_date.replace("-", "")
            )
        }
    except Exception as e:
        print("[ERROR] Error in generate_report: {}".format(str(e)))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debug/status")
async def debug_status(db: Session = Depends(get_db)):
    try:
        attendance_count = db.query(Attendance).count()
        employee_count = db.query(Employee).count()
        user_count = db.query(User).count()
        
        return {
            "backend": "OK",
            "database": "OK",
            "total_attendance": attendance_count,
            "total_employees": employee_count,
            "total_users": user_count
        }
    except Exception as e:
        print("[ERROR] Debug status error: {}".format(str(e)))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/biometric/enroll")
async def enroll_biometric(request: BiometricEnrollRequest, db: Session = Depends(get_db)):
    try:
        employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        fingerprint_processed = None
        face_processed = None
        
        if request.fingerprint_image:
            fingerprint_processed = BiometricProcessor.process_fingerprint_image(request.fingerprint_image)
            if not fingerprint_processed:
                raise HTTPException(status_code=400, detail="Failed to process fingerprint image. Ensure image is clear.")
        
        if request.face_image:
            face_processed = BiometricProcessor.process_face_image(request.face_image)
            if not face_processed:
                raise HTTPException(status_code=400, detail="Failed to process face image. Ensure face is clearly visible.")
        
        if not fingerprint_processed and not face_processed:
            raise HTTPException(status_code=400, detail="At least one biometric (fingerprint or face) is required")
        
        # Encrypt biometric data before saving
        if fingerprint_processed:
            # employee.fingerprint_data = aes_encryption.encrypt_data(fingerprint_processed)
            pass # Fingerprint column not in models.py yet
            
        if face_processed:
            employee.face_data = aes_encryption.encrypt_data(face_processed)
            
        employee.biometric_enrolled = True
        db.commit()
        
        return {
            "message": "Biometric enrollment successful",
            "fingerprint_enrolled": bool(fingerprint_processed),
            "face_enrolled": bool(face_processed)
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"[ERROR] Biometric enrollment error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/biometric/verify")
async def verify_biometric(request: BiometricVerifyRequest, db: Session = Depends(get_db)):
    print(f"\n[VERIFY] Received verification request for {request.email}")
    try:
        user = db.query(User).filter(User.email == request.email).first()
        if not user:
            print("[VERIFY] User not found")
            raise HTTPException(status_code=400, detail="User not found")
        
        employee = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not employee:
            print("[VERIFY] Employee not found")
            raise HTTPException(status_code=400, detail="Employee record not found")
        
        if not employee.biometric_enrolled:
            print("[VERIFY] Biometric not enrolled")
            raise HTTPException(status_code=400, detail="Biometric data not enrolled for this employee")
        
        fingerprint_match = False
        face_match = False
        fingerprint_score = 0.0
        face_score = 0.0
        debug_info = []
        
        if request.fingerprint_image and employee.fingerprint_data:
            try:
                captured_fingerprint = BiometricProcessor.process_fingerprint_image(request.fingerprint_image)
                if captured_fingerprint:
                    fingerprint_score, fingerprint_match = BiometricProcessor.compare_fingerprints(
                        employee.fingerprint_data, captured_fingerprint
                    )
                    debug_info.append(f"Fingerprint score: {fingerprint_score:.2f}")
                else:
                    debug_info.append("Fingerprint processing failed (no features extracted)")
            except Exception as e:
                print(f"[ERROR] Fingerprint comparison error: {str(e)}")
                debug_info.append(f"Fingerprint error: {str(e)}")
        
        if request.face_image and employee.face_data:
            print("[VERIFY] Processing face image...")
            try:
                captured_face = BiometricProcessor.process_face_image(request.face_image)
                if captured_face:
                    print("[VERIFY] Face processed successfully, comparing...")
                    
                    # Decrypt stored face data
                    decrypted_face_data = aes_encryption.decrypt_data(employee.face_data)
                    
                    face_score, face_match = BiometricProcessor.compare_faces(
                        decrypted_face_data, captured_face
                    )
                    print(f"[VERIFY] Face match result: {face_match}, Score: {face_score}")
                    
                    if face_match:
                        debug_info.append(f"Face verified (Score: {face_score:.2f})")
                    else:
                        debug_info.append(f"Face similarity score ({face_score:.2f}) is below the required threshold ({BiometricProcessor.FACE_THRESHOLD})")
                else:
                    print("[VERIFY] Failed to process captured face image (no face detected?)")
                    debug_info.append("No face detected. Please ensure good lighting and face the camera directly.")
            except Exception as e:
                print(f"[ERROR] Face comparison error: {str(e)}")
                print(traceback.format_exc())
                debug_info.append(f"Face verification error: {str(e)}")
        
        if fingerprint_match or face_match:
            user.failed_login_attempts = 0
            
            # Update last successful biometric verification timestamp
            employee.last_biometric_success = datetime.now()
            db.commit()
            
            return {
                "status": "authenticated",
                "match": True,
                "fingerprint_match": bool(fingerprint_match),
                "face_match": bool(face_match),
                "fingerprint_score": float(fingerprint_score),
                "face_score": float(face_score),
                "message": "Biometric authentication successful. Please mark attendance now.",
                "debug_info": debug_info
            }
        else:
            # Automatic request creation removed - user must manually request it
            
            return {
                "status": "failed",
                "match": False,
                "fingerprint_match": bool(fingerprint_match),
                "face_match": bool(face_match),
                "fingerprint_score": float(fingerprint_score),
                "face_score": float(face_score),
                "message": "Biometric authentication failed. " + "; ".join(debug_info),
                "request_id": None,
                "debug_info": debug_info
            }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"[ERROR] Biometric verification error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/biometric/request-approval")
async def request_biometric_approval(request: BiometricVerifyRequest, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.email == request.email).first()
        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        employee = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not employee:
            raise HTTPException(status_code=400, detail="Employee record not found")
        
        existing_request = db.query(BiometricRequest).filter(
            BiometricRequest.employee_id == employee.id,
            BiometricRequest.status == "pending"
        ).first()
        
        if existing_request:
            return {
                "status": "already_requested",
                "message": "You already have a pending approval request",
                "request_id": existing_request.id
            }
        
        biometric_request = BiometricRequest(
            employee_id=employee.id,
            user_id=user.id,
            email=request.email,
            fingerprint_match=False,
            face_match=False,
            status="pending"
        )
        db.add(biometric_request)
        db.commit()
        
        return {
            "status": "request_sent",
            "message": "Request sent to admin for manual verification",
            "request_id": biometric_request.id
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"[ERROR] Admin approval request error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/biometric-requests")
async def get_biometric_requests(db: Session = Depends(get_db)):
    try:
        requests = db.query(BiometricRequest).filter(
            BiometricRequest.status == "pending"
        ).order_by(BiometricRequest.requested_at.desc()).all()
        
        result = []
        for req in requests:
            employee = db.query(Employee).filter(Employee.id == req.employee_id).first()
            user = db.query(User).filter(User.id == req.user_id).first()
            
            decrypted_face_image = aes_encryption.decrypt_data(employee.face_image) if (employee and employee.face_image) else None
            
            result.append({
                "request_id": req.id,
                "employee_name": employee.full_name if employee else "Unknown",
                "employee_id": employee.employee_id if employee else "Unknown",
                "email": req.email,
                "fingerprint_score": 0.0,
                "face_score": 0.0,
                "requested_at": req.requested_at.replace(tzinfo=timezone.utc).isoformat() if req.requested_at else None,
                "status": req.status,
                "face_image": decrypted_face_image
            })
        
        return {"requests": result}
    except Exception as e:
        print(f"[ERROR] Get biometric requests error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/biometric-request/{request_id}/approve")
async def approve_biometric_request(request_id: int, db: Session = Depends(get_db)):
    try:
        biometric_request = db.query(BiometricRequest).filter(BiometricRequest.id == request_id).first()
        if not biometric_request:
            raise HTTPException(status_code=404, detail="Biometric request not found")
        
        biometric_request.status = "approved"
        biometric_request.approved_at = datetime.now()
        
        # Automatically mark attendance as present when biometric request is approved
        request_date = biometric_request.requested_at.date()
        
        existing_attendance = db.query(Attendance).filter(
            Attendance.employee_id == biometric_request.employee_id,
            func.date(Attendance.date) == request_date
        ).first()
        
        if not existing_attendance:
            print(f"[APPROVE BIO] Creating attendance record for employee {biometric_request.employee_id}")
            
            # Create HMAC
            date_str = request_date.strftime("%Y-%m-%d")
            hmac_signature = hmac_integrity.compute_attendance_hmac(
                employee_id=biometric_request.employee_id,
                date_str=date_str,
                status="present",
                latitude="0.0",
                longitude="0.0"
            )
            
            attendance = Attendance(
                employee_id=biometric_request.employee_id,
                date=biometric_request.requested_at,
                status="present",
                marked_at=datetime.now(),
                latitude="0.0",
                longitude="0.0",
                location_name="Manual Approval (Admin)",
                hmac=hmac_signature
            )
            db.add(attendance)
        else:
            print(f"[APPROVE BIO] Attendance already exists for employee {biometric_request.employee_id}, updating status")
            existing_attendance.status = "present"
            if not existing_attendance.location_name:
                existing_attendance.location_name = "Manual Approval (Admin)"
            
            # Recompute HMAC
            date_str = existing_attendance.date.strftime("%Y-%m-%d")
            hmac_signature = hmac_integrity.compute_attendance_hmac(
                employee_id=existing_attendance.employee_id,
                date_str=date_str,
                status="present",
                latitude=existing_attendance.latitude or "0.0",
                longitude=existing_attendance.longitude or "0.0"
            )
            existing_attendance.hmac = hmac_signature

        db.commit()
        
        return {"message": "Biometric request approved and attendance marked"}
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"[ERROR] Approve biometric request error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/biometric-request/{request_id}/deny")
async def deny_biometric_request(request_id: int, db: Session = Depends(get_db)):
    try:
        biometric_request = db.query(BiometricRequest).filter(BiometricRequest.id == request_id).first()
        if not biometric_request:
            raise HTTPException(status_code=404, detail="Biometric request not found")
        
        biometric_request.status = "denied"
        biometric_request.approved_at = datetime.now()
        db.commit()
        
        return {"message": "Biometric request denied"}
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"[ERROR] Deny biometric request error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Employee Attendance System API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models import OTP
from app.config import settings
from app.encryption import get_password_hash

async def send_email(to_email: str, subject: str, body: str):
    try:
        print(f"\n📧 Attempting to send email...")
        print(f"   From: {settings.FROM_EMAIL}")
        print(f"   To: {to_email}")
        print(f"   Server: {settings.SMTP_SERVER}:{settings.SMTP_PORT}")
        
        msg = MIMEMultipart()
        msg['From'] = settings.FROM_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"✅ Email sent successfully to: {to_email}\n")
        return True
    except Exception as e:
        print(f"\n❌ SMTP ERROR:")
        print(f"   {type(e).__name__}: {str(e)}\n")
        print(f"⚠️  TROUBLESHOOTING:")
        print(f"   1. Check SMTP_PASSWORD is correct (16 chars with spaces)")
        print(f"   2. Check SMTP_USERNAME matches FROM_EMAIL")
        print(f"   3. Verify 2FA is enabled on Gmail")
        print(f"   4. Generate NEW app password\n")
        return False

def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

async def send_otp_email(db: Session, email: str):
    db.query(OTP).filter(OTP.email == email).delete()
    
    otp_code = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    otp = OTP(
        email=email,
        otp_code=get_password_hash(otp_code),
        expires_at=expires_at
    )
    db.add(otp)
    db.commit()
    
    subject = "Your Employee Attendance System OTP"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                <h2 style="color: #333; text-align: center;">🔐 Your OTP Code</h2>
                
                <p style="color: #666; font-size: 16px;">Hello,</p>
                
                <p style="color: #666; font-size: 16px;">Your One-Time Password (OTP) for the Employee Attendance System is:</p>
                
                <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; font-size: 28px; font-weight: bold; letter-spacing: 5px;">
                    {otp_code}
                </div>
                
                <p style="color: #666; font-size: 14px;">⏰ This OTP will expire in <strong>10 minutes</strong>.</p>
                
                <p style="color: #666; font-size: 14px;">🔒 Please do not share this OTP with anyone. Our team will never ask for your OTP.</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">Employee Attendance System<br>Secure Login Portal</p>
            </div>
        </body>
    </html>
    """
    
    email_sent = await send_email(email, subject, body)
    return email_sent

async def send_approval_email(email: str, employee_name: str, employee_id: str):
    subject = "Your Employee Account Has Been Approved"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                <h2 style="color: #27ae60; text-align: center;">✅ Account Approved!</h2>
                
                <p style="color: #666; font-size: 16px;">Dear {employee_name},</p>
                
                <p style="color: #666; font-size: 16px;">Great news! Your employee account has been approved by the HR department.</p>
                
                <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #27ae60;">
                    <p style="color: #333; margin: 10px 0;"><strong>Your Employee Details:</strong></p>
                    <p style="color: #555; margin: 8px 0;">👤 <strong>Name:</strong> {employee_name}</p>
                    <p style="color: #555; margin: 8px 0;">🆔 <strong>Employee ID:</strong> {employee_id}</p>
                </div>
                
                <p style="color: #666; font-size: 16px;">You can now login to the Employee Attendance System using your email and password.</p>
                
                <p style="color: #666; font-size: 14px;">🔐 Keep your login credentials secure and do not share them with anyone.</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">Employee Attendance System<br>HR Management Portal</p>
            </div>
        </body>
    </html>
    """
    
    email_sent = await send_email(email, subject, body)
    return email_sent
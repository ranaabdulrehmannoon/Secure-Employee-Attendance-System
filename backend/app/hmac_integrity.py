import hmac
import hashlib
import os
from dotenv import load_dotenv

load_dotenv()

class HMACIntegrity:
    def __init__(self):
        self.secret_key = os.getenv("HMAC_SECRET_KEY", "your-super-secret-hmac-key-change-in-production").encode()
    
    def compute_attendance_hmac(self, employee_id: int, date_str: str, status: str, latitude: str = "", longitude: str = "") -> str:
        """
        Compute HMAC-SHA256 for attendance record
        
        This prevents unauthorized modification of attendance data.
        If attacker changes status/date, HMAC becomes invalid.
        
        Args:
            employee_id: Employee ID
            date_str: Date in ISO format (2024-11-30)
            status: "present" or "absent"
            latitude: GPS latitude
            longitude: GPS longitude
        
        Returns:
            HMAC-SHA256 signature (hex format)
        """
        data_to_sign = f"{employee_id}|{date_str}|{status}|{latitude}|{longitude}".encode()
        
        signature = hmac.new(
            self.secret_key,
            data_to_sign,
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def verify_attendance_hmac(self, employee_id: int, date_str: str, status: str, stored_hmac: str, latitude: str = "", longitude: str = "") -> bool:
        """
        Verify if attendance record has been tampered with
        
        Args:
            employee_id: Employee ID
            date_str: Date in ISO format
            status: "present" or "absent"
            stored_hmac: HMAC from database
            latitude: GPS latitude
            longitude: GPS longitude
        
        Returns:
            True if HMAC matches (data not tampered), False otherwise
        """
        computed_hmac = self.compute_attendance_hmac(employee_id, date_str, status, latitude, longitude)
        
        return hmac.compare_digest(computed_hmac, stored_hmac)


hmac_integrity = HMACIntegrity()

import re

class PasswordValidator:
    """
    Enhanced Password Requirements:
    - Minimum 10 characters
    - Must include uppercase letters (A-Z)
    - Must include lowercase letters (a-z)
    - Must include special characters (!@#$%^&*...)
    - Must include numbers (0-9)
    """
    
    @staticmethod
    def validate(password: str) -> tuple[bool, str]:
        """Validate password against enhanced security guidelines"""
        if len(password) < 10:
            return False, "Password must be at least 10 characters long"
        
        if len(password) > 128:
            return False, "Password must not exceed 128 characters"
        
        if not re.search(r'[a-z]', password):
            return False, "Password must include lowercase letters (a-z)"
        
        if not re.search(r'[A-Z]', password):
            return False, "Password must include uppercase letters (A-Z)"
        
        if not re.search(r'[0-9]', password):
            return False, "Password must include numbers (0-9)"
        
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>?/\\|`~]', password):
            return False, "Password must include special characters (!@#$%^&*...)"
        
        return True, "Password is valid"
    
    @staticmethod
    def get_strength(password: str) -> str:
        """Return password strength rating"""
        score = 0
        
        if len(password) >= 8:
            score += 1
        if len(password) >= 12:
            score += 1
        if len(password) >= 16:
            score += 1
        if re.search(r'[a-z]', password):
            score += 1
        if re.search(r'[A-Z]', password):
            score += 1
        if re.search(r'[0-9]', password):
            score += 1
        if re.search(r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>?/\\|`~]', password):
            score += 1
        
        if score <= 2:
            return "weak"
        elif score <= 4:
            return "fair"
        elif score <= 6:
            return "good"
        else:
            return "strong"

password_validator = PasswordValidator()

from passlib.context import CryptContext
import hashlib

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_deterministic_hash(value):
    """Returns SHA-256 hash of the value for deterministic matching (e.g. CNIC)"""
    return hashlib.sha256(value.encode()).hexdigest()
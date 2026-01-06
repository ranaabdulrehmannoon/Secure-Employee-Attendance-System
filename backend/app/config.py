import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SECRET_KEY = os.getenv("SECRET_KEY")
    ALGORITHM = "HS256"
    DATABASE_URL = os.getenv("DATABASE_URL")
    
    SMTP_SERVER = os.getenv("SMTP_SERVER")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
    FROM_EMAIL = os.getenv("FROM_EMAIL")
    
    HTTPS_ENABLED = os.getenv("HTTPS_ENABLED", "true").lower() == "true"
    SSL_CERT_PATH = os.getenv("SSL_CERT_PATH", "certs/cert.pem")
    SSL_KEY_PATH = os.getenv("SSL_KEY_PATH", "certs/key.pem")

settings = Settings()
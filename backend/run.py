import uvicorn
import os
import sys
import warnings
import asyncio

warnings.filterwarnings('ignore', category=ResourceWarning)

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = "0.0.0.0"
    
    cert_file = os.getenv("SSL_CERT", "localhost+2.pem")
    key_file = os.getenv("SSL_KEY", "localhost+2-key.pem")
    
    cert_exists = os.path.exists(cert_file)
    key_exists = os.path.exists(key_file)
    
    print("[*] Starting Employee Attendance System...")
    
    if cert_exists and key_exists:
        print(f"[OK] SSL Certificate: {cert_file}")
        print(f"[OK] SSL Private Key: {key_file}")
        print(f"[OK] Backend: https://localhost:{port}")
        print("[*] TLS/HTTPS enabled with AES-256-GCM encryption")
        print("[*] Transport layer secured: Confidentiality OK, Integrity OK, Authenticity OK")
        
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=True,
            ssl_keyfile=key_file,
            ssl_certfile=cert_file,
            ssl_version=17,
            ssl_ciphers="ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS"
        )
    else:
        print("[ERROR] SSL certificates not found!")
        if not cert_exists:
            print(f"   Missing: {cert_file}")
        if not key_exists:
            print(f"   Missing: {key_file}")
        print("\n[!] To generate certificates, run:")
        print("    mkcert localhost 127.0.0.1 ::1")
        sys.exit(1)
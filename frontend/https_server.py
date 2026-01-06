import http.server
import ssl
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 443
CERT_FILE = "../backend/localhost+2.pem"
KEY_FILE = "../backend/localhost+2-key.pem"

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

def run_server():
    server_address = ('0.0.0.0', PORT)
    httpd = http.server.HTTPServer(server_address, MyHTTPRequestHandler)
    
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(CERT_FILE, KEY_FILE)
    
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    
    print(f"[*] Frontend HTTPS Server")
    print(f"[✓] URL: https://localhost:{PORT}")
    print(f"[✓] Serving from: {os.getcwd()}")
    print(f"[*] Press Ctrl+C to stop\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Server stopped")
        sys.exit(0)

if __name__ == "__main__":
    if not os.path.exists(CERT_FILE) or not os.path.exists(KEY_FILE):
        print(f"[✗] SSL certificates not found!")
        print(f"    Missing: {CERT_FILE} or {KEY_FILE}")
        print(f"\n[!] Make sure you're running this from the frontend directory")
        print(f"[!] SSL certificates should be in: ../backend/")
        sys.exit(1)
    
    run_server()

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import os
import base64

class RSAKeyExchange:
    def __init__(self):
        self.private_key = None
        self.public_key = None
        self.public_key_pem = None
        self.load_keys()
    
    def load_keys(self):
        key_path = os.path.join(os.path.dirname(__file__), '..', 'certs', 'rsa_private.pem')
        
        with open(key_path, 'rb') as f:
            self.private_key = serialization.load_pem_private_key(
                f.read(),
                password=None,
                backend=default_backend()
            )
        
        self.public_key = self.private_key.public_key()
        self.public_key_pem = self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode('utf-8')
    
    def get_public_key_base64(self) -> str:
        return base64.b64encode(self.public_key_pem.encode()).decode()
    
    def get_public_key_pem(self) -> str:
        return self.public_key_pem

rsa_key_exchange = RSAKeyExchange()

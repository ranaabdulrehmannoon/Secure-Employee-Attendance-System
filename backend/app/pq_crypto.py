import os
import base64
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend

class PostQuantumCrypto:
    def __init__(self, key_dir="certs"):
        self.key_dir = key_dir
        self.private_key = None
        self.public_key = None
        self._load_or_generate_keys()

    def _load_or_generate_keys(self):
        """Load RSA keys for encryption (RSA-4096 implementation)"""
        private_key_path = os.path.join(self.key_dir, "rsa_private.pem")
        public_key_path = os.path.join(self.key_dir, "rsa_public.pem")
        
        if os.path.exists(private_key_path) and os.path.exists(public_key_path):
            with open(private_key_path, "rb") as f:
                self.private_key = serialization.load_pem_private_key(
                    f.read(),
                    password=None,
                    backend=default_backend()
                )
            with open(public_key_path, "rb") as f:
                self.public_key = serialization.load_pem_public_key(
                    f.read(),
                    backend=default_backend()
                )
        else:
            self._generate_keys()
    
    def _generate_keys(self):
        """Generate RSA 4096-bit key pair for encryption"""
        os.makedirs(self.key_dir, exist_ok=True)
        
        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=4096,
            backend=default_backend()
        )
        self.public_key = self.private_key.public_key()
        
        private_pem = self.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        public_pem = self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        with open(os.path.join(self.key_dir, "rsa_private.pem"), "wb") as f:
            f.write(private_pem)
        
        with open(os.path.join(self.key_dir, "rsa_public.pem"), "wb") as f:
            f.write(public_pem)
    
    def get_public_key_pem(self):
        """Return public key in PEM format for client"""
        return self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode('utf-8')
    
    def encrypt_data(self, data: str) -> str:
        """Encrypt data using RSA-4096 (public key)"""
        if isinstance(data, str):
            data = data.encode('utf-8')
        
        encrypted = self.public_key.encrypt(
            data,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return base64.b64encode(encrypted).decode('utf-8')
    
    def decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt data using RSA-4096 (private key)"""
        if isinstance(encrypted_data, str):
            encrypted_data = base64.b64decode(encrypted_data.encode('utf-8'))
        
        decrypted = self.private_key.decrypt(
            encrypted_data,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return decrypted.decode('utf-8')

pq_crypto = PostQuantumCrypto()

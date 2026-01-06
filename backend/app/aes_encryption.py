from cryptography.fernet import Fernet
import os
import base64
from dotenv import load_dotenv

load_dotenv()

class AESEncryption:
    def __init__(self):
        aes_key = os.getenv("AES_KEY")
        
        if aes_key:
            self.cipher = Fernet(aes_key.encode())
        else:
            generated_key = Fernet.generate_key()
            self.cipher = Fernet(generated_key)
            print("⚠️  AES_KEY not set in .env")
            print(f"📌 Generated key: {generated_key.decode()}")
            print("Add this to your .env file:")
            print(f"AES_KEY={generated_key.decode()}")
    
    def encrypt_data(self, data: str) -> str:
        """
        Generic encryption for any string data
        """
        if not data:
            return data
        data_bytes = data.encode('utf-8')
        encrypted = self.cipher.encrypt(data_bytes)
        return encrypted.decode('utf-8')

    def decrypt_data(self, encrypted_data: str) -> str:
        """
        Generic decryption for any string data
        """
        if not encrypted_data:
            return encrypted_data
        try:
            encrypted_bytes = encrypted_data.encode('utf-8')
            decrypted = self.cipher.decrypt(encrypted_bytes)
            return decrypted.decode('utf-8')
        except Exception as e:
            print(f"Decryption failed: {str(e)}. Returning original data (Legacy support).")
            return encrypted_data

    def encrypt_cnic(self, cnic: str) -> str:
        """
        Encrypt CNIC using AES-256 (Fernet)
        
        Fernet uses AES-128 in CBC mode with HMAC authentication
        This ensures both confidentiality and integrity
        
        Args:
            cnic: Plain text CNIC number
        
        Returns:
            Encrypted CNIC (base64 encoded)
        """
        return self.encrypt_data(cnic)
    
    def decrypt_cnic(self, encrypted_cnic: str) -> str:
        """
        Decrypt CNIC using AES-256
        
        Args:
            encrypted_cnic: Encrypted CNIC from database
        
        Returns:
            Plain text CNIC number
        
        Raises:
            cryptography.fernet.InvalidToken: If decryption fails (data tampered)
        """
        try:
            return self.decrypt_data(encrypted_cnic)
        except Exception as e:
            raise ValueError(f"Failed to decrypt CNIC: {str(e)}")


aes_encryption = AESEncryption()

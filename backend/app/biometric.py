import cv2
import numpy as np
from PIL import Image
import base64
import io
from sklearn.metrics.pairwise import cosine_similarity
from typing import Tuple, Optional
import json

class BiometricProcessor:
    
    FACE_CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    FINGERPRINT_THRESHOLD = 0.85
    FACE_THRESHOLD = 0.60
    
    @staticmethod
    def process_face_image(image_data: str) -> Optional[str]:
        try:
            image_bytes = base64.b64decode(image_data.split(',')[1] if ',' in image_data else image_data)
            image = Image.open(io.BytesIO(image_bytes))
            img_array = np.array(image)
            
            if len(img_array.shape) == 3 and img_array.shape[2] == 4:
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
            elif len(img_array.shape) == 3 and img_array.shape[2] == 3:
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            
            gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
            face_cascade = cv2.CascadeClassifier(BiometricProcessor.FACE_CASCADE_PATH)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            
            if len(faces) == 0:
                return None
            
            x, y, w, h = faces[0]
            face_roi = img_array[y:y+h, x:x+w]
            
            face_features = BiometricProcessor._extract_face_features(face_roi)
            return json.dumps(face_features.tolist())
            
        except Exception as e:
            print(f"Error processing face image: {str(e)}")
            return None
    
    @staticmethod
    def _extract_face_features(face_image) -> np.ndarray:
        gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY) if len(face_image.shape) == 3 else face_image
        
        resized = cv2.resize(gray, (128, 128))
        normalized = (resized - resized.mean()) / (resized.std() + 1e-8)
        
        flattened = normalized.flatten()
        
        return flattened
    
    @staticmethod
    def process_fingerprint_image(image_data: str) -> Optional[str]:
        try:
            image_bytes = base64.b64decode(image_data.split(',')[1] if ',' in image_data else image_data)
            image = Image.open(io.BytesIO(image_bytes))
            img_array = np.array(image)
            
            if len(img_array.shape) == 3:
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            
            fingerprint_features = BiometricProcessor._extract_fingerprint_features(img_array)
            return json.dumps(fingerprint_features.tolist())
            
        except Exception as e:
            print(f"Error processing fingerprint image: {str(e)}")
            return None
    
    @staticmethod
    def _extract_fingerprint_features(image) -> np.ndarray:
        blurred = cv2.GaussianBlur(image, (5, 5), 0)
        edges = cv2.Canny(blurred, 100, 200)
        
        resized = cv2.resize(edges, (64, 64))
        normalized = (resized - resized.mean()) / (resized.std() + 1e-8)
        
        flattened = normalized.flatten()
        
        return flattened
    
    @staticmethod
    def compare_faces(face_data1: str, face_data2: str) -> Tuple[float, bool]:
        try:
            features1 = np.array(json.loads(face_data1))
            features2 = np.array(json.loads(face_data2))
            
            features1 = features1.reshape(1, -1)
            features2 = features2.reshape(1, -1)
            
            similarity = cosine_similarity(features1, features2)[0][0]
            
            is_match = similarity >= BiometricProcessor.FACE_THRESHOLD
            
            return float(similarity), is_match
            
        except Exception as e:
            print(f"Error comparing faces: {str(e)}")
            return 0.0, False
    
    @staticmethod
    def compare_fingerprints(fingerprint_data1: str, fingerprint_data2: str) -> Tuple[float, bool]:
        try:
            features1 = np.array(json.loads(fingerprint_data1))
            features2 = np.array(json.loads(fingerprint_data2))
            
            features1 = features1.reshape(1, -1)
            features2 = features2.reshape(1, -1)
            
            similarity = cosine_similarity(features1, features2)[0][0]
            
            is_match = similarity >= BiometricProcessor.FINGERPRINT_THRESHOLD
            
            return float(similarity), is_match
            
        except Exception as e:
            print(f"Error comparing fingerprints: {str(e)}")
            return 0.0, False
    
    @staticmethod
    def verify_biometric(stored_data: str, captured_data: str, biometric_type: str) -> Tuple[float, bool]:
        if biometric_type == "fingerprint":
            return BiometricProcessor.compare_fingerprints(stored_data, captured_data)
        elif biometric_type == "face":
            return BiometricProcessor.compare_faces(stored_data, captured_data)
        else:
            return 0.0, False

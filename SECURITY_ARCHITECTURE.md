# Employee Attendance System - Security & Architecture Documentation

## 1. Overview
This document provides a comprehensive explanation of the security features, cryptographic algorithms, and biometric verification mechanisms implemented in the Employee Attendance System. The system is designed with a "Security First" approach, ensuring data confidentiality, integrity, and authenticity.

---

## 2. Information Security Features

### 2.1. Data Encryption (Confidentiality)
We use **AES-256 (Advanced Encryption Standard)** to protect sensitive user data at rest.

*   **Algorithm**: AES-256-CBC (Cipher Block Chaining) via the `cryptography.fernet` library.
*   **Key Management**: A symmetric 256-bit key is generated and stored securely in the `.env` file (`AES_KEY`).
*   **Encrypted Fields**:
    *   **CNIC (National ID)**: Encrypted before storage to prevent identity theft.
    *   **Face Images**: Base64 encoded images are encrypted to protect user privacy.
    *   **Biometric Data**: Extracted facial features (embeddings) are encrypted to prevent biometric spoofing or replay attacks.

**How it works:**
1.  **Encryption**: `Cipher = AES_Encrypt(Key, PlainText)`
2.  **Decryption**: `PlainText = AES_Decrypt(Key, Cipher)`
3.  **Integrity**: Fernet also uses HMAC-SHA256 to ensure the encrypted data hasn't been tampered with.

### 2.2. Password Hashing (Authentication)
We use **Argon2**, the winner of the Password Hashing Competition, for storing user passwords.

*   **Algorithm**: Argon2id (Hybrid version resisting both side-channel and GPU cracking attacks).
*   **Library**: `passlib` with `argon2-cffi`.
*   **Why Argon2?**: Unlike older algorithms (MD5, SHA-256), Argon2 is memory-hard, making it computationally expensive for attackers to brute-force passwords using GPUs or ASICs.

**How it works:**
1.  User enters password.
2.  System generates a random **Salt**.
3.  `Hash = Argon2(Password + Salt, MemoryCost, TimeCost, Parallelism)`.
4.  The Hash and Salt are stored in the database.
5.  **Verification**: When logging in, the system re-computes the hash using the stored salt and compares it with the stored hash.

### 2.3. Data Integrity (HMAC)
We use **HMAC-SHA256 (Hash-based Message Authentication Code)** to ensure attendance records are not tampered with by database administrators or attackers.

*   **Algorithm**: HMAC-SHA256.
*   **Purpose**: To create a tamper-proof seal for every attendance record.
*   **Fields Protected**: `employee_id`, `date`, `status`, `latitude`, `longitude`.

**How it works:**
1.  **Signing**: When attendance is marked, a signature is generated:
    `Signature = HMAC(SecretKey, employee_id + date + status + lat + long)`
2.  **Storage**: The signature is stored in the `hmac` column.
3.  **Verification**: When fetching records, the system re-calculates the HMAC. If the calculated HMAC differs from the stored HMAC, the record is flagged as **TAMPERED**.

### 2.4. Secure Communication
*   **HTTPS/TLS**: The frontend communicates with the backend over HTTPS (when deployed) or secure local channels, preventing Man-in-the-Middle (MitM) attacks.
*   **CORS Policy**: Strict Cross-Origin Resource Sharing (CORS) policies are enforced to prevent unauthorized domains from accessing the API.

---

## 3. Biometric Verification System

The system uses facial recognition to verify employee identity during attendance marking.

### 3.1. Face Detection & Feature Extraction
We use **OpenCV** and **Haar Cascades** for detection and custom feature extraction logic.

1.  **Capture**: The frontend captures a live image from the user's webcam.
2.  **Preprocessing**:
    *   Convert image to Grayscale.
    *   Resize to standard dimensions (128x128).
    *   Normalize pixel values (Z-score normalization) to handle lighting variations.
3.  **Detection**: `HaarCascade_FrontalFace_Default.xml` is used to locate the face within the image.
4.  **Feature Extraction**:
    *   The face region is cropped.
    *   The pixel data is flattened into a 1D vector (embedding).
    *   This vector represents the unique "fingerprint" of the face.

### 3.2. Verification Process (Matching)
We use **Cosine Similarity** to compare the live face with the stored face.

1.  **Retrieval**: The system fetches the encrypted `face_data` from the database and decrypts it.
2.  **Comparison**:
    *   `Vector A`: Stored Face Features.
    *   `Vector B`: Live Captured Face Features.
    *   **Formula**: `Similarity = (A . B) / (||A|| * ||B||)`
3.  **Thresholding**:
    *   If `Similarity > 0.60` (60%), it is a **Match**.
    *   Otherwise, it is a **Mismatch**.

### 3.3. Workflow
1.  **Signup**: User captures face -> Features extracted -> Encrypted -> Stored.
2.  **Login/Attendance**: User captures face -> Features extracted -> Compared with Decrypted Stored Features -> Access Granted/Denied.

---

## 4. Summary of Technologies

| Feature | Technology / Algorithm | Purpose |
| :--- | :--- | :--- |
| **Password Storage** | **Argon2id** | Secure password hashing (Anti-Brute Force). |
| **Sensitive Data** | **AES-256-CBC** | Encrypting CNIC, Face Images, Biometrics. |
| **Record Integrity** | **HMAC-SHA256** | Detecting database tampering. |
| **Face Recognition** | **OpenCV + Cosine Similarity** | Biometric identity verification. |
| **API Security** | **JWT (JSON Web Tokens)** | Stateless authentication for API sessions. |
| **Input Validation** | **Pydantic** | Preventing injection and data corruption. |

---

## 5. How to Run Security Checks
*   **Integrity Check**: The system automatically checks HMAC signatures whenever attendance history is viewed. Tampered records are highlighted in Red.
*   **Encryption Check**: You can view the database directly; CNIC and Face Data will appear as random ciphertext strings, unreadable without the key.

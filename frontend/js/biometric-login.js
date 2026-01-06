let loginBiometricCapture = null;
let loginFingerprintDrawing = null;

function setupLoginBiometricUI() {
    const fingerprintBtn = document.getElementById('login-fingerprint-btn');
    const faceBtn = document.getElementById('login-face-btn');
    const fingerprintCaptureDiv = document.getElementById('login-fingerprint-capture');
    const faceCaptureDiv = document.getElementById('login-face-capture');
    const clearBtn = document.getElementById('login-clear-fingerprint-btn');
    const startCameraBtn = document.getElementById('login-start-camera-btn');
    const captureFaceBtn = document.getElementById('login-capture-face-btn');
    const faceVideo = document.getElementById('login-face-video');
    const verifyBtn = document.getElementById('verify-biometric-btn');
    const skipBtn = document.getElementById('skip-biometric-btn');

    if (fingerprintBtn) {
        fingerprintBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fingerprintCaptureDiv.style.display = 'block';
            faceCaptureDiv.style.display = 'none';
            if (loginBiometricCapture) loginBiometricCapture.stopCamera();
            
            if (!loginFingerprintDrawing) {
                const canvas = document.getElementById('login-fingerprint-canvas');
                loginFingerprintDrawing = new FingerprintDrawing(canvas);
            }
        });
    }

    if (faceBtn) {
        faceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fingerprintCaptureDiv.style.display = 'none';
            faceCaptureDiv.style.display = 'block';
            
            if (!loginBiometricCapture) {
                loginBiometricCapture = new BiometricCapture();
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginFingerprintDrawing) {
                loginFingerprintDrawing.clear();
            }
        });
    }

    if (startCameraBtn) {
        startCameraBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                if (!loginBiometricCapture) {
                    loginBiometricCapture = new BiometricCapture();
                }
                await loginBiometricCapture.initializeCamera(faceVideo);
                faceVideo.style.display = 'block';
                startCameraBtn.style.display = 'none';
                captureFaceBtn.style.display = 'inline-block';
            } catch (error) {
                alert('Failed to access camera: ' + error.message);
            }
        });
    }

    if (captureFaceBtn) {
        captureFaceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginBiometricCapture && faceVideo) {
                loginBiometricCapture.captureFace(faceVideo);
                if (loginBiometricCapture) loginBiometricCapture.stopCamera();
                faceVideo.style.display = 'none';
                startCameraBtn.style.display = 'inline-block';
                captureFaceBtn.style.display = 'none';
            }
        });
    }

    if (verifyBtn) {
        verifyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            verifyBiometricAndLogin();
        });
    }

    if (skipBtn) {
        skipBtn.addEventListener('click', (e) => {
            e.preventDefault();
            requestAdminApproval();
        });
    }
}

async function verifyBiometricAndLogin() {
    const email = document.getElementById('email').value;
    if (!email) {
        alert('Email is required');
        return;
    }

    try {
        const fingerprintDiv = document.getElementById('login-fingerprint-capture');
        const faceDiv = document.getElementById('login-face-capture');
        
        const verifyData = {
            email: email,
            fingerprint_image: '',
            face_image: ''
        };

        const isFingerprintMode = fingerprintDiv.style.display !== 'none';
        const isFaceMode = faceDiv.style.display !== 'none';

        if (isFingerprintMode) {
            if (!loginFingerprintDrawing || !loginFingerprintDrawing.hasDrawing()) {
                alert('Please draw your fingerprint pattern');
                return;
            }
            verifyData.fingerprint_image = loginFingerprintDrawing.canvas.toDataURL('image/png');
        } else if (isFaceMode) {
            if (!loginBiometricCapture || !loginBiometricCapture.getFaceData()) {
                alert('Please capture your face image');
                return;
            }
            verifyData.face_image = loginBiometricCapture.getFaceData();
        } else {
            alert('Please select a biometric method');
            return;
        }

        const response = await fetch(`${API_BASE}/api/biometric/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit',
            body: JSON.stringify(verifyData)
        });

        const result = await response.json();

        if (response.ok && result.status === 'authenticated') {
            alert('✅ Biometric verification successful! Completing login...');
            completeBiometricLogin();
        } else if (response.ok && result.status === 'pending_admin_approval') {
            alert('⚠️ Biometric verification could not authenticate. Your request has been sent to the admin for approval.');
            localStorage.setItem('biometric_request_id', result.request_id);
            resetBiometricUI();
        } else {
            alert('❌ Biometric verification failed: ' + (result.detail || result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Biometric verification error:', error);
        alert('❌ Error during biometric verification: ' + error.message);
    }
}

async function requestAdminApproval() {
    const email = document.getElementById('email').value;
    if (!email) {
        alert('Email is required');
        return;
    }

    try {
        const verifyData = {
            email: email,
            fingerprint_image: '',
            face_image: ''
        };

        const response = await fetch(`${API_BASE}/api/biometric/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit',
            body: JSON.stringify(verifyData)
        });

        const result = await response.json();

        if (response.ok && result.status === 'pending_admin_approval') {
            alert('✅ Your biometric authentication request has been sent to the admin for review. You will be notified once approved.');
            localStorage.setItem('biometric_request_id', result.request_id);
            resetBiometricUI();
        } else {
            alert('Error requesting admin approval. Please try again.');
        }
    } catch (error) {
        console.error('Admin approval request error:', error);
        alert('Error: ' + error.message);
    }
}

function resetBiometricUI() {
    document.getElementById('biometric-login-section').style.display = 'none';
    document.getElementById('login-fingerprint-capture').style.display = 'none';
    document.getElementById('login-face-capture').style.display = 'none';
    
    if (loginBiometricCapture) {
        loginBiometricCapture.stopCamera();
        loginBiometricCapture = null;
    }
    if (loginFingerprintDrawing) {
        loginFingerprintDrawing = null;
    }
}

function completeBiometricLogin() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.dispatchEvent(new Event('biometric-success'));
    }
}

function showBiometricLoginSection() {
    const section = document.getElementById('biometric-login-section');
    if (section) {
        section.style.display = 'block';
        setupLoginBiometricUI();
    }
}

let dashboardBiometricCapture = null;
let dashboardFingerprintDrawing = null;
let biometricVerified = false;

function initializeDashboardBiometricUI() {
    const verifyByFaceBtn = document.getElementById('verify-by-face-btn');
    // const verifyByFingerprintBtn = document.getElementById('verify-by-fingerprint-btn'); // Removed
    const requestAdminApprovalBtn = document.getElementById('request-admin-approval-btn');
    const closeModalBtn = document.getElementById('close-biometric-modal');
    const modal = document.getElementById('biometric-verification-modal');

    if (verifyByFaceBtn) {
        verifyByFaceBtn.addEventListener('click', () => showFaceVerificationModal());
    }

    // if (verifyByFingerprintBtn) {
    //     verifyByFingerprintBtn.addEventListener('click', () => showFingerprintVerificationModal());
    // }

    if (requestAdminApprovalBtn) {
        requestAdminApprovalBtn.addEventListener('click', () => showAdminApprovalModal());
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
            if (dashboardBiometricCapture) dashboardBiometricCapture.stopCamera();
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                if (dashboardBiometricCapture) dashboardBiometricCapture.stopCamera();
            }
        });
    }
}

function showFaceVerificationModal() {
    const modal = document.getElementById('biometric-verification-modal');
    const content = document.getElementById('biometric-modal-content');

    content.innerHTML = `
        <h3 style="color: var(--primary); margin-top: 0;">🤳 Face Verification</h3>
        <p style="color: rgba(224, 247, 250, 0.7); margin-bottom: 15px;">Position your face clearly in the camera frame. Make sure you're in good lighting.</p>
        
        <div style="text-align: center;">
            <button type="button" id="dashboard-start-camera-btn" class="mark-btn" style="margin-bottom: 15px;">
                <i class="fas fa-camera"></i> Enable Camera
            </button>
            <button type="button" id="dashboard-capture-face-btn" class="mark-btn" style="display: none; margin-bottom: 15px;">
                <i class="fas fa-camera"></i> Capture Face
            </button>
        </div>
        
        <video id="dashboard-face-video" width="100%" style="border: 2px solid var(--primary); border-radius: 8px; background: #000; display: none; margin: 15px 0; max-height: 300px;"></video>
        
        <div id="dashboard-face-preview" style="display: none; margin: 15px 0;">
            <p style="color: var(--primary); margin-bottom: 10px; font-weight: 600;">✓ Face captured successfully</p>
            <img id="dashboard-face-preview-img" style="width: 100%; border-radius: 8px; max-height: 250px; border: 2px solid var(--primary);">
        </div>
        
        <button type="button" id="verify-face-btn" class="mark-btn" style="width: 100%; margin-top: 20px; display: none;">
            <i class="fas fa-check"></i> Verify Face
        </button>
        
        <div id="dashboard-face-status" style="margin-top: 15px; padding: 12px; border-radius: 8px; display: none; text-align: center;"></div>
    `;

    if (modal) modal.style.display = 'flex';

    setupDashboardFaceCapture();
}

function setupDashboardFaceCapture() {
    const startCameraBtn = document.getElementById('dashboard-start-camera-btn');
    const captureFaceBtn = document.getElementById('dashboard-capture-face-btn');
    const verifyFaceBtn = document.getElementById('verify-face-btn');
    const faceVideo = document.getElementById('dashboard-face-video');
    const statusDiv = document.getElementById('dashboard-face-status');

    if (startCameraBtn) {
        startCameraBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                if (!dashboardBiometricCapture) {
                    dashboardBiometricCapture = new BiometricCapture();
                }
                await dashboardBiometricCapture.initializeCamera(faceVideo);
                if (faceVideo) faceVideo.style.display = 'block';
                if (startCameraBtn) startCameraBtn.style.display = 'none';
                if (captureFaceBtn) captureFaceBtn.style.display = 'inline-block';
            } catch (error) {
                showBiometricStatus('Failed to access camera: ' + error.message, 'error', statusDiv);
            }
        });
    }

    if (captureFaceBtn) {
        captureFaceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (dashboardBiometricCapture && faceVideo) {
                const faceData = dashboardBiometricCapture.captureFace(faceVideo);
                const preview = document.getElementById('dashboard-face-preview');
                const previewImg = document.getElementById('dashboard-face-preview-img');

                if (preview && previewImg) {
                    previewImg.src = faceData;
                    preview.style.display = 'block';
                    if (startCameraBtn) startCameraBtn.style.display = 'inline-block';
                    if (captureFaceBtn) captureFaceBtn.style.display = 'none';
                    if (verifyFaceBtn) verifyFaceBtn.style.display = 'inline-block';
                }

                if (dashboardBiometricCapture) dashboardBiometricCapture.stopCamera();
                if (faceVideo) faceVideo.style.display = 'none';
            }
        });
    }

    if (verifyFaceBtn) {
        verifyFaceBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await performFaceVerification(statusDiv);
        });
    }
}

async function performFaceVerification(statusDiv) {
    const preview = document.getElementById('dashboard-face-preview');
    const previewImg = document.getElementById('dashboard-face-preview-img');
    const faceData = previewImg ? previewImg.src : null;

    if (!faceData) {
        showBiometricStatus('No face image captured', 'error', statusDiv);
        return;
    }

    showBiometricStatus('Verifying face...', 'processing', statusDiv);

    try {
        const response = await fetch(`${API_BASE}/api/biometric/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                email: localStorage.getItem('email'),
                face_image: faceData,
                fingerprint_image: ""
            })
        });

        const data = await response.json();

        if (response.ok && data.match) {
            showBiometricStatus('Face verified successfully! Please enable location and mark attendance.', 'success', statusDiv);
            biometricVerified = true;
            localStorage.setItem('biometric_verified', 'true'); // Persist verification
            
            setTimeout(() => {
                document.getElementById('biometric-verification-modal').style.display = 'none';
                document.getElementById('biometric-verification-section').style.display = 'none';
                showDashboardContent();
                
                // Highlight the Mark Attendance button or show a hint
                const markBtn = document.getElementById('mark-attendance');
                if (markBtn) {
                    markBtn.classList.add('pulse-animation'); // You might want to add this CSS class
                }
            }, 2000);
        } else {
            console.log('❌ Biometric verification failed details:', data);
            const msg = data.message || 'Face verification failed. Try another method.';
            showBiometricStatus(msg, 'error', statusDiv);
        }
    } catch (error) {
        showBiometricStatus('Error during verification: ' + error.message, 'error', statusDiv);
    }
}

function showFingerprintVerificationModal() {
    const modal = document.getElementById('biometric-verification-modal');
    const content = document.getElementById('biometric-modal-content');

    content.innerHTML = `
        <h3 style="color: var(--secondary); margin-top: 0;">👆 Fingerprint Verification</h3>
        <p style="color: rgba(224, 247, 250, 0.7); margin-bottom: 15px;">Draw your fingerprint pattern on the canvas below.</p>
        
        <canvas id="dashboard-fingerprint-canvas" width="100%" height="200" style="border: 2px solid var(--secondary); border-radius: 8px; background: white; cursor: crosshair; display: block; margin: 15px 0;"></canvas>
        
        <button type="button" id="dashboard-clear-fingerprint-btn" class="mark-btn" style="width: 100%; margin-bottom: 10px; background-color: rgba(123, 44, 191, 0.2); border-color: var(--secondary); color: var(--secondary);">
            <i class="fas fa-redo"></i> Clear Canvas
        </button>
        
        <button type="button" id="verify-fingerprint-btn" class="mark-btn" style="width: 100%; margin-bottom: 10px;">
            <i class="fas fa-check"></i> Verify Fingerprint
        </button>
        
        <div id="dashboard-fingerprint-status" style="margin-top: 15px; padding: 12px; border-radius: 8px; display: none; text-align: center;"></div>
    `;

    if (modal) modal.style.display = 'flex';

    setupDashboardFingerprintCapture();
}

function setupDashboardFingerprintCapture() {
    const canvas = document.getElementById('dashboard-fingerprint-canvas');
    const clearBtn = document.getElementById('dashboard-clear-fingerprint-btn');
    const verifyBtn = document.getElementById('verify-fingerprint-btn');
    const statusDiv = document.getElementById('dashboard-fingerprint-status');

    if (canvas && !dashboardFingerprintDrawing) {
        dashboardFingerprintDrawing = new FingerprintDrawing(canvas);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (dashboardFingerprintDrawing) {
                dashboardFingerprintDrawing.clear();
            }
        });
    }

    if (verifyBtn) {
        verifyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await performFingerprintVerification(statusDiv);
        });
    }
}

async function performFingerprintVerification(statusDiv) {
    if (!dashboardFingerprintDrawing || !dashboardFingerprintDrawing.hasDrawing()) {
        showBiometricStatus('Please draw your fingerprint on the canvas', 'error', statusDiv);
        return;
    }

    showBiometricStatus('Verifying fingerprint...', 'processing', statusDiv);

    try {
        const fingerprintData = dashboardFingerprintDrawing.canvas.toDataURL('image/png');

        const response = await fetch(`${API_BASE}/api/biometric/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                email: localStorage.getItem('email'),
                face_image: "",
                fingerprint_image: fingerprintData
            })
        });

        const data = await response.json();

        if (response.ok && data.match) {
            showBiometricStatus('Fingerprint verified successfully!', 'success', statusDiv);
            biometricVerified = true;
            localStorage.setItem('biometric_verified', 'true'); // Persist verification
            setTimeout(() => {
                document.getElementById('biometric-verification-modal').style.display = 'none';
                document.getElementById('biometric-verification-section').style.display = 'none';
                showDashboardContent();
            }, 2000);
        } else {
            showBiometricStatus('Fingerprint verification failed. Try another method.', 'error', statusDiv);
        }
    } catch (error) {
        showBiometricStatus('Error during verification: ' + error.message, 'error', statusDiv);
    }
}

function showAdminApprovalModal() {
    const modal = document.getElementById('biometric-verification-modal');
    const content = document.getElementById('biometric-modal-content');

    content.innerHTML = `
        <h3 style="color: var(--warning); margin-top: 0;">📋 Request Admin Approval</h3>
        <p style="color: rgba(224, 247, 250, 0.7); margin-bottom: 15px;">Send a request to the administrator for manual verification and approval.</p>
        
        <div style="background: rgba(255, 190, 11, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid var(--warning); margin-bottom: 20px;">
            <p style="color: var(--warning); margin: 0; font-weight: 600;">⚠️ This will notify the admin for manual verification</p>
        </div>
        
        <button type="button" id="send-admin-request-btn" class="mark-btn" style="width: 100%; margin-bottom: 10px; background-color: rgba(255, 190, 11, 0.2); border-color: var(--warning); color: var(--warning);">
            <i class="fas fa-paper-plane"></i> Send Request to Admin
        </button>
        
        <button type="button" id="cancel-admin-request-btn" class="mark-btn" style="width: 100%; margin-bottom: 0; background-color: transparent; border-color: rgba(224, 247, 250, 0.3); color: rgba(224, 247, 250, 0.7);">
            Cancel
        </button>
        
        <div id="dashboard-admin-request-status" style="margin-top: 15px; padding: 12px; border-radius: 8px; display: none; text-align: center;"></div>
    `;

    if (modal) modal.style.display = 'flex';

    setupAdminApprovalUI();
}

function setupAdminApprovalUI() {
    const sendBtn = document.getElementById('send-admin-request-btn');
    const cancelBtn = document.getElementById('cancel-admin-request-btn');
    const statusDiv = document.getElementById('dashboard-admin-request-status');

    if (sendBtn) {
        sendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await sendAdminApprovalRequest(statusDiv);
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('biometric-verification-modal').style.display = 'none';
        });
    }
}

async function sendAdminApprovalRequest(statusDiv) {
    showBiometricStatus('Sending request to admin...', 'processing', statusDiv);

    try {
        const response = await fetch(`${API_BASE}/api/biometric/request-approval`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                email: localStorage.getItem('email')
            })
        });

        const data = await response.json();

        if (response.ok) {
            showBiometricStatus('Request sent successfully! Admin will review and approve your access.', 'success', statusDiv);
            biometricVerified = true;
            localStorage.setItem('biometric_verified', 'true'); // Persist verification (allow access after request)
            setTimeout(() => {
                document.getElementById('biometric-verification-modal').style.display = 'none';
                document.getElementById('biometric-verification-section').style.display = 'none';
                showDashboardContent();
            }, 2500);
        } else {
            showBiometricStatus('Failed to send request: ' + (data.detail || 'Unknown error'), 'error', statusDiv);
        }
    } catch (error) {
        showBiometricStatus('Error sending request: ' + error.message, 'error', statusDiv);
    }
}

function showBiometricStatus(message, type, container) {
    if (!container) return;

    container.textContent = message;
    container.style.display = 'block';

    if (type === 'success') {
        container.style.background = 'rgba(0, 255, 157, 0.15)';
        container.style.color = '#00ff9d';
        container.style.borderLeft = '4px solid #00ff9d';
    } else if (type === 'error') {
        container.style.background = 'rgba(255, 0, 110, 0.15)';
        container.style.color = '#ff006e';
        container.style.borderLeft = '4px solid #ff006e';
    } else if (type === 'processing') {
        container.style.background = 'rgba(255, 190, 11, 0.15)';
        container.style.color = '#ffbe0b';
        container.style.borderLeft = '4px solid #ffbe0b';
    }
}

function showDashboardContent() {
    const section = document.getElementById('attendance-section');
    if (section) {
        section.style.display = 'block';
    }
}

function checkBiometricVerificationNeeded() {
    // Check if user has already verified in this session
    const isVerified = localStorage.getItem('biometric_verified') === 'true';
    
    // Also check legacy flag for backward compatibility or fresh login
    const needsVerification = localStorage.getItem('needsBiometricVerification') === 'true';
    
    const biometricSection = document.getElementById('biometric-verification-section');
    const attendanceSection = document.getElementById('attendance-section');

    // If verified, show dashboard
    if (isVerified) {
        if (biometricSection) biometricSection.style.display = 'none';
        showDashboardContent();
        return;
    }

    // If not verified, show biometric section
    // We default to showing it if we are not verified
    if (biometricSection) {
        biometricSection.style.display = 'block';
        if (attendanceSection) attendanceSection.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkBiometricVerificationNeeded();
    initializeDashboardBiometricUI();
});

window.handleStartCamera = async function() {
    console.log('🎥 handleStartCamera() GLOBAL FUNCTION CALLED - STARTING CAMERA');
    const faceVideo = document.getElementById('face-video');
    const startCameraBtn = document.getElementById('start-camera-btn');
    const captureFaceBtn = document.getElementById('capture-face-btn');
    
    try {
        if (!biometricCapture) {
            biometricCapture = new BiometricCapture();
        }
        await biometricCapture.initializeCamera(faceVideo);
        
        if (faceVideo) {
            faceVideo.style.display = 'block';
            
            await new Promise((resolve) => {
                const checkVideo = setInterval(() => {
                    if (faceVideo.videoWidth > 0 && faceVideo.videoHeight > 0) {
                        clearInterval(checkVideo);
                        console.log('✅ Video is ready. Dimensions:', faceVideo.videoWidth, 'x', faceVideo.videoHeight);
                        showAlert('✅ Camera enabled! Position your face and click "Capture"', 'success');
                        resolve();
                    }
                }, 100);
                
                setTimeout(() => {
                    clearInterval(checkVideo);
                    resolve();
                }, 3000);
            });
        }
        
        if (startCameraBtn) startCameraBtn.style.display = 'none';
        if (captureFaceBtn) captureFaceBtn.style.display = 'inline-block';
    } catch (error) {
        showAlert('❌ Failed to access camera: ' + error.message, 'error');
        console.error('Camera error:', error);
    }
}

window.handleCaptureFace = function() {
    console.log('═══════════════════════════════════════');
    console.log('📸 handleCaptureFace() GLOBAL FUNCTION CALLED');
    console.log('═══════════════════════════════════════');
    
    const faceVideo = document.getElementById('face-video');
    const startCameraBtn = document.getElementById('start-camera-btn');
    const captureFaceBtn = document.getElementById('capture-face-btn');
    
    console.log('DEBUG INFO:');
    console.log('  biometricCapture exists:', biometricCapture ? '✓' : '✗');
    console.log('  faceVideo exists:', faceVideo ? '✓' : '✗');
    if (faceVideo) {
        console.log('  faceVideo.videoWidth:', faceVideo.videoWidth);
        console.log('  faceVideo.videoHeight:', faceVideo.videoHeight);
        console.log('  faceVideo.paused:', faceVideo.paused);
        console.log('  faceVideo.readyState:', faceVideo.readyState);
    }
    console.log('  capturedFaceData BEFORE:', window.capturedFaceData ? 'HAS DATA ✓' : 'NULL ✗');
    
    if (biometricCapture && faceVideo) {
        try {
            console.log('📸 CAPTURING FACE FROM VIDEO...');
            const faceData = biometricCapture.captureFace(faceVideo);
            console.log('📸 Returned from captureFace():', faceData ? 'HAS DATA ✓' : 'NULL ✗');
            console.log('📸 faceData length:', faceData ? faceData.length : 0);
            
            if (faceData && faceData.length > 100) {
                window.capturedFaceData = faceData;
                console.log('✅ SET GLOBAL capturedFaceData. Length:', window.capturedFaceData.length);
                
                // Also store in hidden input field for reliability
                let hiddenInput = document.getElementById('face-image-data');
                if (!hiddenInput) {
                    console.warn('⚠️ Hidden input #face-image-data missing during capture! Recreating...');
                    const form = document.getElementById('signup-form');
                    if (form) {
                        hiddenInput = document.createElement('input');
                        hiddenInput.type = 'hidden';
                        hiddenInput.id = 'face-image-data';
                        hiddenInput.name = 'face_image';
                        form.appendChild(hiddenInput);
                        console.log('✅ Recreated hidden input during capture');
                    } else {
                        console.error('❌ Could not find signup-form to recreate input!');
                    }
                }

                if (hiddenInput) {
                    hiddenInput.value = faceData;
                    // Force a change event just in case
                    hiddenInput.dispatchEvent(new Event('change'));
                    console.log('✅ Face data saved to hidden input field. Length:', hiddenInput.value.length);
                    
                    // Double check immediately
                    if (hiddenInput.value.length < 100) {
                        console.error('❌ CRITICAL: Hidden input value did not persist!');
                        hiddenInput.setAttribute('value', faceData); // Try attribute method
                    }
                }
                
                console.log('✅ capturedFaceData UPDATED. Size:', (faceData.length / 1024).toFixed(2) + ' KB');
                console.log('✅ Global capturedFaceData now:', window.capturedFaceData ? 'HAS DATA ✓' : 'NULL ✗');
                
                const facePreview = document.getElementById('face-preview');
                const facePreviewImg = document.getElementById('face-preview-img');
                
                if (facePreview && facePreviewImg) {
                    facePreviewImg.src = faceData;
                    facePreview.style.display = 'block';
                    console.log('✓ Face preview image displayed');
                }
                
                const submitBtn = document.getElementById('submit-btn');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    console.log('✓ Submit button enabled');
                }
                showAlert('✅ Face captured successfully! You can now submit your registration.', 'success');
            } else {
                console.error('❌ captureFace() returned NULL or empty');
                showAlert('❌ Failed to capture face - image is empty. Try again with better lighting.', 'error');
            }
        } catch (error) {
            console.error('❌ Error during face capture:', error.message);
            showAlert('❌ Error: ' + error.message, 'error');
        } finally {
            if (biometricCapture) {
                biometricCapture.stopCamera();
                console.log('✓ Camera stopped');
            }
            if (faceVideo) faceVideo.style.display = 'none';
            if (startCameraBtn) startCameraBtn.style.display = 'inline-block';
            if (captureFaceBtn) captureFaceBtn.style.display = 'none';
        }
    } else {
        console.error('❌ CANNOT CAPTURE - missing:', {
            biometricCapture: biometricCapture ? 'OK' : 'MISSING',
            faceVideo: faceVideo ? 'OK' : 'MISSING'
        });
        showAlert('❌ Camera not ready. Please click "Enable Camera" first.', 'error');
    }
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    if (password.length < 10) {
        return 'Password must be at least 10 characters long';
    }
    if (!/[a-z]/.test(password)) {
        return 'Password must include lowercase letters (a-z)';
    }
    if (!/[A-Z]/.test(password)) {
        return 'Password must include uppercase letters (A-Z)';
    }
    if (!/[0-9]/.test(password)) {
        return 'Password must include numbers (0-9)';
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};:'",./<>?\\|`~]/.test(password)) {
        return 'Password must include special characters (!@#$%^&*...)';
    }
    return null;
}

console.log('🔧 Employee Auth.js loaded successfully');

let biometricCapture = null;
window.capturedFaceData = null;

function showAlert(message, type) {
    const alertDiv = document.getElementById('alert');
    if (!alertDiv) {
        console.error('Alert container not found');
        alert(message);
        return;
    }
    
    alertDiv.textContent = message;
    alertDiv.style.display = 'block';
    
    if (type === 'error') {
        alertDiv.style.background = 'rgba(255, 69, 96, 0.12)';
        alertDiv.style.borderColor = '#FF4560';
        alertDiv.style.color = '#FF4560';
    } else {
        alertDiv.style.background = 'rgba(0, 209, 160, 0.12)';
        alertDiv.style.borderColor = '#00d1a0';
        alertDiv.style.color = '#00d1a0';
    }
    
    const timeout = type === 'success' ? 4000 : 5000;
    setTimeout(() => {
        if (alertDiv) alertDiv.style.display = 'none';
    }, timeout);
}

function setupBiometricListeners() {
    console.log('🔧 Setting up biometric listeners...');
    const startCameraBtn = document.getElementById('start-camera-btn');
    const captureFaceBtn = document.getElementById('capture-face-btn');
    const faceVideo = document.getElementById('face-video');

    console.log('  start-camera-btn:', startCameraBtn ? 'FOUND ✓' : 'NOT FOUND ✗');
    console.log('  capture-face-btn:', captureFaceBtn ? 'FOUND ✓' : 'NOT FOUND ✗');
    console.log('  face-video:', faceVideo ? 'FOUND ✓' : 'NOT FOUND ✗');

    if (startCameraBtn) {
        startCameraBtn.onclick = async function(e) {
            if (e) e.preventDefault();
            console.log('🎥 START CAMERA BUTTON CLICKED - HANDLER TRIGGERED');
            try {
                if (!biometricCapture) {
                    biometricCapture = new BiometricCapture();
                }
                await biometricCapture.initializeCamera(faceVideo);
                
                if (faceVideo) {
                    faceVideo.style.display = 'block';
                    
                    await new Promise((resolve) => {
                        const checkVideo = setInterval(() => {
                            if (faceVideo.videoWidth > 0 && faceVideo.videoHeight > 0) {
                                clearInterval(checkVideo);
                                console.log('✅ Video is ready. Dimensions:', faceVideo.videoWidth, 'x', faceVideo.videoHeight);
                                showAlert('✅ Camera enabled! Position your face and click "Capture"', 'success');
                                resolve();
                            }
                        }, 100);
                        
                        setTimeout(() => {
                            clearInterval(checkVideo);
                            resolve();
                        }, 3000);
                    });
                }
                
                if (startCameraBtn) startCameraBtn.style.display = 'none';
                if (captureFaceBtn) captureFaceBtn.style.display = 'inline-block';
            } catch (error) {
                showAlert('❌ Failed to access camera: ' + error.message, 'error');
                console.error('Camera error:', error);
            }
            return false;
        };
    }

    if (captureFaceBtn) {
        // Remove existing listeners to prevent duplicates
        const newCaptureBtn = captureFaceBtn.cloneNode(true);
        captureFaceBtn.parentNode.replaceChild(newCaptureBtn, captureFaceBtn);
        
        newCaptureBtn.onclick = function(e) {
            if (e) e.preventDefault();
            console.log('📸 FACE CAPTURE BUTTON CLICKED - HANDLER TRIGGERED');
            console.log('  biometricCapture exists:', biometricCapture ? '✓' : '✗');
            console.log('  faceVideo exists:', faceVideo ? '✓' : '✗');
            console.log('  faceVideo.videoWidth:', faceVideo?.videoWidth || 'undefined');
            console.log('  faceVideo.videoHeight:', faceVideo?.videoHeight || 'undefined');
            console.log('  capturedFaceData BEFORE capture:', window.capturedFaceData ? 'HAS DATA ✓' : 'NULL ✗');
            
            if (biometricCapture && faceVideo) {
                try {
                    console.log('📸 CAPTURING FACE FROM VIDEO...');
                    const faceData = biometricCapture.captureFace(faceVideo);
                    console.log('📸 Returned from captureFace():', faceData ? 'HAS DATA ✓' : 'NULL ✗');
                    console.log('📸 faceData length:', faceData ? faceData.length : 0);
                    
                    if (faceData && faceData.length > 100) {
                        window.capturedFaceData = faceData;
                        
                        // Also store in hidden input field for reliability
                        const hiddenInput = document.getElementById('face-image-data');
                        if (hiddenInput) {
                            hiddenInput.value = faceData;
                            // Force a change event just in case
                            hiddenInput.dispatchEvent(new Event('change'));
                            console.log('✅ Face data saved to hidden input field. Length:', hiddenInput.value.length);
                            
                            // Double check immediately
                            if (hiddenInput.value.length < 100) {
                                console.error('❌ CRITICAL: Hidden input value did not persist!');
                                hiddenInput.setAttribute('value', faceData); // Try attribute method
                            }
                        } else {
                            console.error('❌ Hidden input field #face-image-data not found!');
                        }
                        
                        console.log('✅ capturedFaceData UPDATED. Size:', (faceData.length / 1024).toFixed(2) + ' KB');
                        console.log('✅ Global capturedFaceData now:', window.capturedFaceData ? 'HAS DATA ✓' : 'NULL ✗');
                        
                        const facePreview = document.getElementById('face-preview');
                        const facePreviewImg = document.getElementById('face-preview-img');
                        
                        if (facePreview && facePreviewImg) {
                            facePreviewImg.src = faceData;
                            facePreview.style.display = 'block';
                            console.log('✓ Face preview image displayed');
                        }
                        
                        const submitBtn = document.getElementById('submit-btn');
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.style.opacity = '1';
                            submitBtn.style.cursor = 'pointer';
                            console.log('✓ Submit button enabled');
                        }
                        showAlert('✅ Face captured successfully! You can now submit your registration.', 'success');
                    } else {
                        console.error('❌ captureFace() returned NULL or empty');
                        showAlert('❌ Failed to capture face - image is empty. Try again with better lighting.', 'error');
                    }
                } catch (error) {
                    console.error('❌ Error during face capture:', error.message);
                    showAlert('❌ Error: ' + error.message, 'error');
                } finally {
                    if (biometricCapture) {
                        biometricCapture.stopCamera();
                        console.log('✓ Camera stopped');
                    }
                    if (faceVideo) faceVideo.style.display = 'none';
                    if (startCameraBtn) startCameraBtn.style.display = 'inline-block';
                    if (newCaptureBtn) newCaptureBtn.style.display = 'none';
                }
            } else {
                console.error('❌ CANNOT CAPTURE - missing:', {
                    biometricCapture: biometricCapture ? 'OK' : 'MISSING',
                    faceVideo: faceVideo ? 'OK' : 'MISSING'
                });
                showAlert('❌ Camera not ready. Please click "Enable Camera" first.', 'error');
            }
            return false;
        };
    }


}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 DOMContentLoaded: Checking for #face-image-data...');
    const checkInput = document.getElementById('face-image-data');
    console.log('🔍 DOMContentLoaded: #face-image-data found?', checkInput ? 'YES' : 'NO');
    if (checkInput) {
        console.log('🔍 DOMContentLoaded: #face-image-data parent:', checkInput.parentElement);
        console.log('🔍 DOMContentLoaded: #face-image-data value:', checkInput.value);
    } else {
        console.error('❌ DOMContentLoaded: #face-image-data NOT FOUND!');
        // Attempt to create it if missing
        const form = document.getElementById('signup-form');
        console.log('🔍 DOMContentLoaded: #signup-form found?', form ? 'YES' : 'NO');
        
        if (form) {
            console.log('⚠️ Attempting to recreate missing input...');
            const newInput = document.createElement('input');
            newInput.type = 'hidden';
            newInput.id = 'face-image-data';
            newInput.name = 'face_image';
            form.appendChild(newInput);
            console.log('✅ Recreated #face-image-data');
        } else {
            console.error('❌ CRITICAL: #signup-form ALSO NOT FOUND! DOM might be incomplete.');
        }
    }

    const loginSection = document.getElementById('login-section');
    const signupSection = document.getElementById('signup-section');
    const showSignup = document.getElementById('showSignupBtn');
    const showLogin = document.getElementById('backToLoginBtnLeft');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const requestOtpBtn = document.getElementById('request-otp');
    const alertContainer = document.getElementById('alert');

    function clearAlerts() {
        if (alertContainer) alertContainer.innerHTML = '';
    }

    function setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.innerHTML = '⏳ Loading...';
            button.disabled = true;
        } else {
            if (button.id === 'request-otp') {
                button.innerHTML = 'Send OTP to Email';
            } else if (button.type === 'submit') {
                const form = button.closest('form');
                if (form && form.id === 'login-form') {
                    button.textContent = 'Login to Dashboard';
                } else if (form && form.id === 'signup-form') {
                    button.textContent = 'Create Employee Account';
                }
            }
            button.disabled = false;
        }
    }

    if (showSignup) {
        showSignup.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🔧 Switching to signup section');
            if (loginSection) loginSection.classList.add('hidden');
            if (signupSection) signupSection.classList.remove('hidden');
            clearAlerts();
            setupBiometricListeners();
        });
    }

    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🔧 Switching to login section');
            if (signupSection) signupSection.classList.add('hidden');
            if (loginSection) loginSection.classList.remove('hidden');
            clearAlerts();
        });
    }

    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            if (e.target.closest('.back-btn').getAttribute('href') === 'role-select.html') {
                e.preventDefault();
                showAlert('↩️ Returning to role selection...', 'success');
                setTimeout(() => {
                    window.location.href = 'role-select.html';
                }, 500);
            }
        });
    }

    /* 
    // OTP handling is now done in employee-login.html inline script to avoid duplicate alerts
    if (requestOtpBtn) {
        console.log('✅ OTP button found! Setting up event listener...');
        requestOtpBtn.addEventListener('click', async () => {
            const email = document.getElementById('email').value;
            
            if (!email) {
                showAlert('❌ Please enter your email address first', 'error');
                return;
            }

            try {
                setButtonLoading(requestOtpBtn, true);
                
                const response = await fetch(`${API_BASE}/api/auth/request-otp?email=${encodeURIComponent(email)}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    mode: 'cors',
                    credentials: 'omit'
                });

                const data = await response.json();

                if (response.ok) {
                    showAlert('✅ OTP sent successfully! Check your email for the code.', 'success');
                    console.log(`🔐 OTP requested for: ${email}`);
                } else {
                    showAlert('❌ ' + (data.detail || 'Failed to send OTP. Please check your email.'), 'error');
                }
            } catch (error) {
                showAlert('❌ Cannot reach backend server. Make sure it is running on port 8000.', 'error');
                console.error('OTP Error:', error);
            } finally {
                setButtonLoading(requestOtpBtn, false);
            }
        });
    }
    */

    /*
    // Login form handling is now done in employee-login.html inline script to avoid duplicate requests
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🔧 Employee login form submitted');
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const securityAnswer = document.getElementById('security-answer').value;
            const otp = document.getElementById('otp').value;

            if (!email) {
                showAlert('❌ Please enter your email address', 'error');
                return;
            }

            if (!password) {
                showAlert('❌ Please enter your password', 'error');
                return;
            }

            if (!securityAnswer) {
                showAlert('❌ Please answer your security question', 'error');
                return;
            }

            if (!otp) {
                showAlert('❌ Please enter the OTP from your email', 'error');
                return;
            }

            const loginData = {
                email,
                password,
                security_answer: securityAnswer,
                otp
            };

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            
            try {
                setButtonLoading(submitBtn, true);
                
                const response = await fetch(`${API_BASE}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    mode: 'cors',
                    credentials: 'omit',
                    body: JSON.stringify(loginData)
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.access_token);
                    localStorage.setItem('role', data.role);
                    localStorage.setItem('email', loginData.email);
                    if (data.employee_id) {
                        localStorage.setItem('employee_id', data.employee_id);
                    }
                    
                    localStorage.setItem('needsBiometricVerification', 'true');
                    localStorage.removeItem('biometric_verified'); // Clear previous verification status
                    
                    showAlert('✅ Login successful! Proceeding to biometric verification...', 'success');
                    
                    setTimeout(() => {
                        window.location.href = 'employee_dashboard.html';
                    }, 1000);
                    
                } else {
                    console.error('🔧 Login failed:', data.detail);
                    const errorMsg = data.detail || 'Login failed';
                    if (errorMsg.toLowerCase().includes('password')) {
                        showAlert('❌ Invalid password. Please try again.', 'error');
                    } else if (errorMsg.toLowerCase().includes('security')) {
                        showAlert('❌ Incorrect security answer. Please try again.', 'error');
                    } else if (errorMsg.toLowerCase().includes('otp')) {
                        showAlert('❌ Invalid or expired OTP. Request a new one.', 'error');
                    } else if (errorMsg.toLowerCase().includes('not found') || errorMsg.toLowerCase().includes('approval')) {
                        showAlert('❌ Account not found or not approved yet. Contact HR.', 'error');
                    } else {
                        showAlert('❌ ' + errorMsg, 'error');
                    }
                }
            } catch (error) {
                console.error('🔧 Login network error:', error);
                showAlert('❌ Cannot reach backend server. Make sure it is running on port 8000.', 'error');
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }
    */

    const signupEmail = document.getElementById('signup-email');
    if (signupEmail) {
        signupEmail.addEventListener('input', (e) => {
            const email = e.target.value;
            const feedback = document.getElementById('email-feedback');
            const isValid = validateEmail(email);

            if (!feedback) return;

            if (email === '') {
                e.target.classList.remove('email-valid', 'email-invalid');
                feedback.classList.remove('show');
            } else if (isValid) {
                e.target.classList.remove('email-invalid');
                e.target.classList.add('email-valid');
                feedback.classList.add('show', 'valid');
                feedback.classList.remove('invalid');
                feedback.innerHTML = '<i class="fas fa-check-circle"></i> Valid email address';
            } else {
                e.target.classList.remove('email-valid');
                e.target.classList.add('email-invalid');
                feedback.classList.add('show', 'invalid');
                feedback.classList.remove('valid');
                feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> Invalid email format';
            }
        });
    }

    if (signupForm) {
        console.log('✅ Signup form found! Setting up event listener...');
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🔧 Signup form submitted');
            
            const fullName = document.getElementById('full-name').value;
            const email = document.getElementById('signup-email').value;
            const cnic = document.getElementById('cnic').value;
            const securityQuestion = document.getElementById('security-question').value;
            const securityAnswer = document.getElementById('security-answer-signup').value;
            const password = document.getElementById('signup-password').value;

            console.log('📝 Form data:', {fullName, email, cnic, securityQuestion, securityAnswer});

            if (!fullName) {
                showAlert('❌ Please enter your full name', 'error');
                return;
            }
            if (!email) {
                showAlert('❌ Please enter your email address', 'error');
                return;
            }
            if (!validateEmail(email)) {
                showAlert('❌ Please enter a valid email address', 'error');
                return;
            }
            if (!cnic) {
                showAlert('❌ Please enter your CNIC number', 'error');
                return;
            }
            if (!securityQuestion) {
                showAlert('❌ Please select a security question', 'error');
                return;
            }
            if (!securityAnswer) {
                showAlert('❌ Please answer your security question', 'error');
                return;
            }
            if (!password) {
                showAlert('❌ Please enter a password', 'error');
                return;
            }

            const passwordError = validatePassword(password);
            if (passwordError) {
                showAlert('❌ ' + passwordError, 'error');
                return;
            }

            console.log('🔍 CHECKING BIOMETRIC DATA AT FORM SUBMISSION:');
            
            // Try to get from hidden input first (most reliable)
            let hiddenInput = document.getElementById('face-image-data');
            
            // If missing, try to recreate it (though it won't have data unless we have global var)
            if (!hiddenInput) {
                console.warn('⚠️ Hidden input #face-image-data missing at submission! Recreating...');
                const form = document.getElementById('signup-form');
                if (form) {
                    hiddenInput = document.createElement('input');
                    hiddenInput.type = 'hidden';
                    hiddenInput.id = 'face-image-data';
                    hiddenInput.name = 'face_image';
                    form.appendChild(hiddenInput);
                }
            }

            let faceDataToUse = hiddenInput ? hiddenInput.value : null;
            
            console.log('🔍 DEBUG: Hidden input element:', hiddenInput);
            console.log('🔍 DEBUG: Hidden input value length:', hiddenInput ? hiddenInput.value.length : 'N/A');
            
            // Fallback: check if value is in attribute (sometimes .value doesn't sync with DOM attribute)
            if ((!faceDataToUse || faceDataToUse.length < 100) && hiddenInput) {
                 console.log('⚠️ Checking attribute value as fallback...');
                 faceDataToUse = hiddenInput.getAttribute('value');
            }

            if (faceDataToUse && faceDataToUse.length > 100) {
                console.log('✅ Found face data in hidden input field');
            } else {
                console.log('⚠️ No data in hidden input, checking global variable...');
                // If global variable has data, use it AND update the input
                if (window.capturedFaceData && window.capturedFaceData.length > 100) {
                    faceDataToUse = window.capturedFaceData;
                    if (hiddenInput) {
                        hiddenInput.value = faceDataToUse;
                        console.log('✅ Restored data to hidden input from global variable');
                    }
                } else {
                    faceDataToUse = window.capturedFaceData;
                }
            }

            console.log('  capturedFaceData value:', window.capturedFaceData);
            console.log('  capturedFaceData type:', typeof window.capturedFaceData);
            console.log('  capturedFaceData length:', window.capturedFaceData ? window.capturedFaceData.length : 'N/A');
            
            console.log('  faceDataToUse status:', faceDataToUse ? `HAS DATA (${(faceDataToUse.length / 1024).toFixed(2)} KB) ✓` : 'NULL ✗');
            
            if (!faceDataToUse) {
                console.error('❌❌❌ CRITICAL: Face capture missing at form submission!');
                console.error('  Did you click the Capture button and see the face preview?');
                showAlert('❌ Please capture your face image before submitting', 'error');
                document.querySelector('html').scrollTop = 0;
                return;
            }

            const formData = {
                full_name: fullName,
                email: email,
                cnic: cnic,
                security_question: securityQuestion,
                security_answer: securityAnswer,
                password: password,
                face_image: faceDataToUse,
                fingerprint_image: null
            };

            console.log('📊 Biometric data sizes:');
            console.log('  Face image:', faceDataToUse ? (faceDataToUse.length / 1024).toFixed(2) + ' KB' : 'missing');

            const submitBtn = signupForm.querySelector('button[type="submit"]');
            
            try {
                setButtonLoading(submitBtn, true);
                
                console.log('📤 Sending signup request with biometric data to:', `${API_BASE}/api/employee/signup`);
                
                const response = await fetch(`${API_BASE}/api/employee/signup`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    mode: 'cors',
                    credentials: 'omit',
                    body: JSON.stringify(formData)
                });

                const data = await response.json();
                
                console.log('📥 Response status:', response.status);
                console.log('📥 Response data:', data);
                if (Array.isArray(data.detail)) {
                    console.log('📥 Validation errors:', data.detail);
                    data.detail.forEach((err, i) => {
                        console.log(`  Error ${i+1}:`, err);
                    });
                }

                if (response.ok) {
                    console.log('✅ Signup successful with biometric enrollment!');
                    showSignupSuccess();
                } else {
                    console.error('❌ Signup failed:', data);
                    let errorMsg = 'Registration failed';
                    
                    if (data.detail) {
                        if (typeof data.detail === 'string') {
                            errorMsg = data.detail;
                        } else if (Array.isArray(data.detail)) {
                            errorMsg = data.detail.map(e => {
                                if (typeof e === 'string') return e;
                                return e.msg || e.detail || JSON.stringify(e);
                            }).join(', ');
                        } else if (typeof data.detail === 'object') {
                            errorMsg = JSON.stringify(data.detail);
                        }
                    }
                    
                    errorMsg = String(errorMsg);
                    
                    if (errorMsg.toLowerCase().includes('email')) {
                        showAlert('❌ This email is already registered. Please login instead.', 'error');
                    } else if (errorMsg.toLowerCase().includes('cnic')) {
                        showAlert('❌ This CNIC is already registered. Please login instead.', 'error');
                    } else if (errorMsg.toLowerCase().includes('biometric') || errorMsg.toLowerCase().includes('image')) {
                        showAlert('❌ Biometric processing failed. Please ensure clear face and fingerprint images.', 'error');
                    } else {
                        showAlert('❌ ' + errorMsg, 'error');
                    }
                }
            } catch (error) {
                console.error('🔧 Signup network error:', error);
                showAlert('❌ Cannot reach backend server. Make sure it is running on port 8000.', 'error');
            } finally {
                setButtonLoading(submitBtn, false);
            }
            
            function showSignupSuccess() {
                const successMsg = `✅ Registration Submitted Successfully!

Your face has been captured and your account is pending HR approval.
You will receive an email notification once approved.`;
                showAlert(successMsg, 'success');
                signupForm.reset();
                const hiddenInput = document.getElementById('face-image-data');
                if (hiddenInput) hiddenInput.value = '';
                window.capturedFaceData = null;
                
                const submitBtn = document.getElementById('submit-btn');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.style.opacity = '0.5';
                    submitBtn.style.cursor = 'not-allowed';
                }
                
                const facePreview = document.getElementById('face-preview');
                if (facePreview) facePreview.style.display = 'none';
                
                if (typeof capturedFaceDataLeft !== 'undefined') capturedFaceDataLeft = null;
                if (biometricCapture) biometricCapture.stopCamera();
                if (typeof biometricCaptureLeft !== 'undefined' && biometricCaptureLeft) biometricCaptureLeft.stopCamera();
                setTimeout(() => {
                    if (signupSection) signupSection.classList.add('hidden');
                    if (loginSection) loginSection.classList.remove('hidden');
                }, 3000);
            }
        });
    }

    async function testBackendConnection() {
        try {
            const response = await fetch(`${API_BASE}/`);
            if (!response.ok) {
                showAlert('Backend server is not responding. Please start it on port 8000.', 'error');
            }
        } catch (error) {
            showAlert('Cannot connect to backend server on port 8000.', 'error');
        }
    }

    window.addEventListener('load', () => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        
        if (token && role && role === 'employee') {
            showAlert('Welcome back! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'employee_dashboard.html';
            }, 1000);
        }
        
        testBackendConnection();
    });

    setTimeout(() => {
        console.log('🔧 FINAL SETUP: Re-checking button click handlers...');
        const captureBtn = document.getElementById('capture-face-btn');
        if (captureBtn) {
            console.log('Capture button element:', captureBtn);
            console.log('Capture button display:', captureBtn.style.display);
            console.log('Capture button disabled:', captureBtn.disabled);
            
            // Remove existing listeners to prevent duplicates
            const newCaptureBtn = captureBtn.cloneNode(true);
            captureBtn.parentNode.replaceChild(newCaptureBtn, captureBtn);
            
            newCaptureBtn.addEventListener('click', function(e) {
                console.log('🔴 CAPTURE BUTTON CLICK DETECTED VIA ADDEVENTLISTENER');
                e.preventDefault();
                e.stopPropagation();
                handleCaptureFace();
            }, true);
            
            console.log('✅ Added click listener with capture=true');
        }
    }, 500);

    console.log('🔧 Employee Auth.js initialization complete');
});

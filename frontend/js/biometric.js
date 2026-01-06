class BiometricCapture {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.stream = null;
        this.fingerprintData = null;
        this.faceData = null;
    }

    async initializeCamera(videoElement) {
        try {
            this.video = videoElement;
            const constraints = { 
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false 
            };
            
            console.log('🎥 Requesting camera access...');
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Camera stream obtained');
            
            this.video.srcObject = this.stream;
            console.log('✅ Stream assigned to video element');
            
            this.video.onloadedmetadata = () => {
                console.log('✅ Video metadata loaded');
                console.log('  Video dimensions:', this.video.videoWidth, 'x', this.video.videoHeight);
                this.video.play().catch(err => {
                    console.error('Error playing video:', err);
                });
            };
            
            this.video.onplay = () => {
                console.log('✅ Video is now playing');
            };
            
            this.video.onerror = (e) => {
                console.error('❌ Video error:', e);
            };
            
            return true;
        } catch (error) {
            console.error('Camera access denied:', error);
            throw new Error('Unable to access camera. Please grant permission and try again.');
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    captureFace(videoElement) {
        try {
            if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
                console.error('❌ Video not ready:', {
                    element: videoElement ? 'exists' : 'missing',
                    videoWidth: videoElement?.videoWidth || 0,
                    videoHeight: videoElement?.videoHeight || 0
                });
                throw new Error('Video not ready. Please ensure camera is initialized and playing.');
            }
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            
            ctx.drawImage(videoElement, 0, 0, videoElement.videoWidth, videoElement.videoHeight);
            this.faceData = canvas.toDataURL('image/jpeg', 0.9);
            
            if (!this.faceData || this.faceData.length < 100) {
                throw new Error('Captured image is empty or invalid');
            }
            
            return this.faceData;
        } catch (error) {
            console.error('Error capturing face:', error);
            throw new Error('Failed to capture face image: ' + error.message);
        }
    }

    captureFingerprint(canvasElement) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 400;
            canvas.height = 300;
            ctx.drawImage(canvasElement, 0, 0, 400, 300);
            this.fingerprintData = canvas.toDataURL('image/png');
            return this.fingerprintData;
        } catch (error) {
            console.error('Error capturing fingerprint:', error);
            throw new Error('Failed to capture fingerprint image');
        }
    }

    getFingerprintData() {
        return this.fingerprintData;
    }

    getFaceData() {
        return this.faceData;
    }

    clearData() {
        this.fingerprintData = null;
        this.faceData = null;
    }
}

class FingerprintDrawing {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        
        this.setupCanvas();
        this.attachEventListeners();
    }

    setupCanvas() {
        this.canvas.width = 400;
        this.canvas.height = 300;
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
    }

    attachEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', () => this.stopDrawing());
    }

    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        
        this.lastX = x;
        this.lastY = y;
        
        if (this.hasDrawing()) {
            console.log('✏️ Fingerprint drawing detected on canvas');
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        this.lastX = touch.clientX - rect.left;
        this.lastY = touch.clientY - rect.top;
    }

    handleTouchMove(e) {
        if (!this.isDrawing) return;
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        
        this.lastX = x;
        this.lastY = y;
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    clear() {
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    hasDrawing() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] === 255) {
                return true;
            }
        }
        return false;
    }
}

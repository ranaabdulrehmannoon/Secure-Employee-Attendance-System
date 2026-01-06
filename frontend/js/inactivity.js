console.log('[INIT] Inactivity timeout handler loading...');

const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
const WARNING_TIME = 2 * 60 * 1000;
let inactivityTimer = null;
let warningTimer = null;

function logout() {
    console.log('[LOGOUT] User logged out due to inactivity');
    localStorage.removeItem('token');
    localStorage.removeItem('employee_id');
    localStorage.removeItem('role');
    sessionStorage.clear();
    window.location.href = 'index.html';
}

function showInactivityWarning() {
    if (document.getElementById('inactivity-warning-modal')) {
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'inactivity-warning-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;

    const warningBox = document.createElement('div');
    warningBox.style.cssText = `
        background: linear-gradient(135deg, rgba(22, 28, 40, 0.95), rgba(26, 31, 46, 0.95));
        border: 2px solid rgba(255, 69, 96, 0.5);
        border-radius: 20px;
        padding: 2.5rem;
        max-width: 450px;
        text-align: center;
        backdrop-filter: blur(10px);
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5);
        color: #E0E6F0;
    `;

    const iconDiv = document.createElement('div');
    iconDiv.style.cssText = `
        font-size: 3rem;
        margin-bottom: 1.5rem;
        animation: pulse 1.5s ease-in-out infinite;
    `;
    iconDiv.innerHTML = '⏰';

    const titleDiv = document.createElement('h2');
    titleDiv.textContent = 'Inactivity Warning';
    titleDiv.style.cssText = `
        margin: 0 0 1rem 0;
        font-size: 1.8rem;
        color: #FF4560;
        font-weight: 600;
    `;

    const messageDiv = document.createElement('p');
    messageDiv.textContent = 'You have been inactive for 3 minutes. Your session will expire in 2 minutes.';
    messageDiv.style.cssText = `
        margin: 1rem 0 2rem 0;
        color: #AAB3C7;
        font-size: 1rem;
        line-height: 1.6;
    `;

    const timerDiv = document.createElement('div');
    timerDiv.id = 'inactivity-timer';
    timerDiv.style.cssText = `
        font-size: 2rem;
        font-weight: bold;
        color: #00D1A0;
        margin-bottom: 2rem;
        font-variant-numeric: tabular-nums;
    `;
    timerDiv.textContent = '02:00';

    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.cssText = `
        display: flex;
        gap: 1rem;
        justify-content: center;
    `;

    const stayBtn = document.createElement('button');
    stayBtn.textContent = 'Stay Logged In';
    stayBtn.style.cssText = `
        padding: 0.9rem 2rem;
        background: linear-gradient(135deg, #00D1A0, #009966);
        border: none;
        border-radius: 10px;
        color: white;
        font-weight: 600;
        cursor: pointer;
        font-size: 1rem;
        transition: all 0.3s ease;
    `;
    stayBtn.onmouseover = () => {
        stayBtn.style.transform = 'translateY(-3px)';
        stayBtn.style.boxShadow = '0 10px 25px rgba(0, 209, 160, 0.4)';
    };
    stayBtn.onmouseout = () => {
        stayBtn.style.transform = 'translateY(0)';
        stayBtn.style.boxShadow = 'none';
    };
    stayBtn.onclick = () => {
        document.body.removeChild(modal);
        resetInactivityTimer();
    };

    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Logout Now';
    logoutBtn.style.cssText = `
        padding: 0.9rem 2rem;
        background: rgba(255, 69, 96, 0.2);
        border: 2px solid rgba(255, 69, 96, 0.5);
        border-radius: 10px;
        color: #FF4560;
        font-weight: 600;
        cursor: pointer;
        font-size: 1rem;
        transition: all 0.3s ease;
    `;
    logoutBtn.onmouseover = () => {
        logoutBtn.style.transform = 'translateY(-3px)';
        logoutBtn.style.background = 'rgba(255, 69, 96, 0.3)';
    };
    logoutBtn.onmouseout = () => {
        logoutBtn.style.transform = 'translateY(0)';
        logoutBtn.style.background = 'rgba(255, 69, 96, 0.2)';
    };
    logoutBtn.onclick = () => logout();

    buttonsDiv.appendChild(stayBtn);
    buttonsDiv.appendChild(logoutBtn);

    warningBox.appendChild(iconDiv);
    warningBox.appendChild(titleDiv);
    warningBox.appendChild(messageDiv);
    warningBox.appendChild(timerDiv);
    warningBox.appendChild(buttonsDiv);
    modal.appendChild(warningBox);
    document.body.appendChild(modal);

    let secondsRemaining = 120;
    const timerElement = document.getElementById('inactivity-timer');
    
    const countdownInterval = setInterval(() => {
        secondsRemaining--;
        const minutes = Math.floor(secondsRemaining / 60);
        const seconds = secondsRemaining % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (secondsRemaining <= 0) {
            clearInterval(countdownInterval);
            logout();
        }
    }, 1000);
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimer);

    warningTimer = setTimeout(() => {
        console.log('[WARNING] User has been inactive for 3 minutes');
        showInactivityWarning();
    }, INACTIVITY_TIMEOUT - WARNING_TIME);

    inactivityTimer = setTimeout(() => {
        console.log('[LOGOUT] Inactivity timeout reached');
        logout();
    }, INACTIVITY_TIMEOUT);
}

function setupInactivityListener() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, true);
    });

    resetInactivityTimer();
}

document.addEventListener('DOMContentLoaded', setupInactivityListener);

console.log('[INIT] Inactivity timeout handler initialized - 5 minute timeout');

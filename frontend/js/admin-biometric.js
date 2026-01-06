let biometricRequests = [];

async function loadBiometricRequests() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/admin/biometric-requests`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch biometric requests');
        }

        biometricRequests = await response.json();
        displayBiometricRequests(biometricRequests.requests || []);
        updateBiometricBadge(biometricRequests.requests?.length || 0);
    } catch (error) {
        console.error('Error loading biometric requests:', error);
        showAlert('Failed to load biometric requests', 'error');
    }
}

function displayBiometricRequests(requests) {
    const tbody = document.getElementById('biometric-requests-body');
    const noRequests = document.getElementById('no-biometric-requests');
    
    if (!requests || requests.length === 0) {
        tbody.innerHTML = '';
        if (noRequests) noRequests.style.display = 'block';
        return;
    }

    if (noRequests) noRequests.style.display = 'none';
    
    tbody.innerHTML = requests.map(req => `
        <tr>
            <td>${req.employee_name}</td>
            <td>${req.employee_id}</td>
            <td>${req.email}</td>
            <td>
                ${req.face_image ? 
                    `<img src="${req.face_image}" alt="Employee Photo" style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%; border: 2px solid #4cc9f0; cursor: pointer;" onclick="window.open('${req.face_image}', '_blank')">` : 
                    '<span style="color: #888;"><i class="fas fa-user-slash"></i> No Photo</span>'
                }
            </td>
            <td><span style="color: ${req.face_match ? '#10b981' : '#888'};">
                <i class="fas fa-${req.face_match ? 'check-circle' : 'circle'}"></i> 
                ${req.face_match ? 'Matched' : 'Not Verified'}
            </span></td>
            <td>${new Date(req.requested_at).toLocaleString()}</td>
            <td>
                <button onclick="approveBiometricRequest(${req.request_id})" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 5px;">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button onclick="denyBiometricRequest(${req.request_id})" style="background: #ff4757; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                    <i class="fas fa-times"></i> Deny
                </button>
            </td>
        </tr>
    `).join('');
}

async function approveBiometricRequest(requestId) {
    if (!confirm('Approve this biometric authentication request?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/admin/biometric-request/${requestId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to approve biometric request');
        }

        showAlert('✅ Biometric request approved successfully', 'success');
        loadBiometricRequests();
    } catch (error) {
        console.error('Error approving biometric request:', error);
        showAlert('❌ Error approving request: ' + error.message, 'error');
    }
}

async function denyBiometricRequest(requestId) {
    if (!confirm('Deny this biometric authentication request?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/admin/biometric-request/${requestId}/deny`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to deny biometric request');
        }

        showAlert('✅ Biometric request denied', 'success');
        loadBiometricRequests();
    } catch (error) {
        console.error('Error denying biometric request:', error);
        showAlert('❌ Error denying request: ' + error.message, 'error');
    }
}

function updateBiometricBadge(count) {
    const badge = document.getElementById('biometric-badge');
    if (badge && count > 0) {
        badge.style.display = 'flex';
        badge.textContent = count;
    } else if (badge) {
        badge.style.display = 'none';
    }
}

function setupBiometricSectionHandlers() {
    const biometricBtn = document.getElementById('biometric-btn');
    const biometricSection = document.getElementById('biometric-section');
    const refreshBtn = document.getElementById('biometric-refresh-btn');

    if (biometricBtn) {
        biometricBtn.addEventListener('click', () => {
            document.getElementById('attendance-section').style.display = 'none';
            document.getElementById('mgmt-section').style.display = 'none';
            if (biometricSection) biometricSection.style.display = 'flex';
            loadBiometricRequests();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadBiometricRequests();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupBiometricSectionHandlers();
    loadBiometricRequests();
    setInterval(loadBiometricRequests, 30000);
});

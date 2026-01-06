const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

// Check authentication
if (!token || role !== 'hr') {
    alert('Access denied. Please login as HR.');
    window.location.href = 'index.html';
}

// Logout button handler
document.getElementById('logout-btn').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
        this.disabled = true;
        setTimeout(() => {
            localStorage.clear();
            window.location.href = 'index.html';
        }, 500);
    }
});

// Load pending approvals
async function loadPendingApprovals() {
    try {
        const response = await fetch(`${API_BASE}/api/hr/pending-approvals`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayPendingApprovals(data.pending_employees || []);
            updateStats(data);
        } else {
            throw new Error('Failed to load pending approvals');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load pending approvals', 'error');
    }
}

function maskSecurityQuestion(question) {
    const words = question.trim().split(/\s+/);
    if (words.length === 0) return question;
    return words[0] + '...........................';
}

let currentPendingEmployees = [];

// Display pending approvals
function displayPendingApprovals(employees) {
    currentPendingEmployees = employees;
    const tbody = document.getElementById('approvals-body');
    
    if (employees.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #cbd5e1;">
                    📭 No pending employee approvals
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = employees.map(emp => `
        <tr>
            <td>
                ${emp.face_image ? 
                    `<img src="${emp.face_image}" alt="Photo" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary); cursor: pointer;" onclick="viewImage('${emp.face_image}')">` : 
                    `<div style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; border: 2px solid var(--primary);"><i class="fas fa-user" style="color: var(--primary);"></i></div>`
                }
            </td>
            <td><i class="fas fa-user-circle" style="margin-right: 8px; color: var(--primary);"></i> ${emp.full_name}</td>
            <td style="color: #999;">${emp.email || 'N/A'}</td>
            <td style="font-family: monospace; color: #10b981; font-size: 1.1rem; letter-spacing: 1px; font-weight: 600;">${emp.cnic}</td>
            <td>${emp.department}</td>
            <td>${emp.position}</td>
            <td style="text-align: center;">
                <button class="approve-btn" onclick="showApprovalModal(${emp.id})" style="margin-bottom: 0; width: 100%;">
                    <i class="fas fa-check"></i> Approve
                </button>
            </td>
            <td style="text-align: center;">
                <button class="disapprove-btn" onclick="disapproveEmployee(${emp.id})" style="margin-bottom: 0; width: 100%;">
                    <i class="fas fa-times"></i> Disapprove
                </button>
            </td>
        </tr>
    `).join('');
    
    attachApproveListeners();
}

// Attach visual feedback to approve buttons
function attachApproveListeners() {
    document.querySelectorAll('.approve-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const row = this.closest('tr');
            const name = row.cells[0].textContent.replace(/.*\s/, '').trim();
            
            if (confirm(`Are you sure you want to approve ${name}?`)) {
                row.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1))';
                row.style.transition = 'all 0.5s ease';
                
                this.innerHTML = '<i class="fas fa-check-double"></i> Approved';
                this.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)';
                this.style.boxShadow = 'none';
                this.disabled = true;
                
                const pendingCount = document.getElementById('pending-approvals');
                const currentCount = parseInt(pendingCount.textContent);
                pendingCount.style.transform = 'scale(1.3)';
                pendingCount.style.color = 'var(--success)';
                
                setTimeout(() => {
                    pendingCount.textContent = currentCount - 1;
                    pendingCount.style.transform = 'scale(1)';
                    pendingCount.style.color = 'var(--light)';
                }, 300);
            }
        });
    });
}

let currentEmployeeId = null;

function showApprovalModal(employeeId) {
    currentEmployeeId = employeeId;
    document.getElementById('dept-input').value = '';
    document.getElementById('pos-input').value = '';
    
    // Find employee and show image
    const employee = currentPendingEmployees.find(e => e.id === employeeId);
    const imageContainer = document.getElementById('approval-employee-image-container');
    const imageElement = document.getElementById('approval-employee-image');
    
    if (employee && employee.face_image) {
        imageElement.src = employee.face_image;
        imageContainer.style.display = 'block';
    } else {
        imageContainer.style.display = 'none';
    }
    
    document.getElementById('approval-modal').style.display = 'block';
}

function closeApprovalModal() {
    document.getElementById('approval-modal').style.display = 'none';
    currentEmployeeId = null;
}

document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = document.getElementById('confirm-approve-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', approveEmployee);
    }
});

// Approve employee
async function approveEmployee() {
    const department = document.getElementById('dept-input').value.trim();
    const position = document.getElementById('pos-input').value.trim();
    
    if (!department || !position) {
        showAlert('❌ Please fill in both department and position', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/hr/approve-employee`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                employee_id: currentEmployeeId,
                department: department,
                position: position
            })
        });

        if (response.ok) {
            showAlert('✅ Employee approved successfully', 'success');
            closeApprovalModal();
            setTimeout(() => loadPendingApprovals(), 500);
        } else {
            const data = await response.json();
            showAlert(`❌ ${data.detail || 'Failed to approve employee'}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to approve employee', 'error');
    }
}

// Disapprove employee
async function disapproveEmployee(employeeId) {
    const row = event.target.closest('tr');
    const name = row.cells[0].textContent.replace(/.*\s/, '').trim();
    
    if (!confirm(`Are you sure you want to disapprove ${name}?\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/hr/disapprove-employee`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ employee_id: employeeId })
        });

        if (response.ok) {
            showAlert(`✅ ${name} has been disapproved`, 'success');
            row.style.opacity = '0.5';
            row.style.textDecoration = 'line-through';
            
            setTimeout(() => {
                row.style.animation = 'slideOut 0.5s ease forwards';
                setTimeout(() => loadPendingApprovals(), 500);
            }, 1000);
        } else {
            const data = await response.json();
            showAlert(`❌ ${data.detail || 'Failed to disapprove employee'}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to disapprove employee', 'error');
    }
}

// Update stats
function updateStats(data) {
    document.getElementById('total-employees').textContent = data.total_employees || 0;
    document.getElementById('pending-approvals').textContent = data.pending_count || 0;
}

// Show alert
function showAlert(message, type) {
    const alertContainer = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type === 'success' ? 'success' : 'refresh'}`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Initialize animations on page load
function initializeAnimations() {
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        setTimeout(() => {
            statusMessage.classList.add('fade-out');
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 500);
        }, 2000);
    }
    
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 300 * index);
    });
}

let allApprovedEmployees = [];

// Load all approved employees
async function loadApprovedEmployees() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/all-employees-stats`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            allApprovedEmployees = await response.json();
            displayApprovedEmployees(allApprovedEmployees);
        } else {
            throw new Error('Failed to load employees');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Display approved employees
function displayApprovedEmployees(employees) {
    const tbody = document.getElementById('employees-body');
    
    if (employees.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #cbd5e1;">
                    No approved employees found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = employees.map(emp => {
        const attendanceRateColor = emp.attendance_rate >= 80 ? '#10b981' : 
                                   emp.attendance_rate >= 60 ? '#f59e0b' : '#ef4444';
        
        return `
            <tr>
                <td><i class="fas fa-user-circle" style="margin-right: 8px; color: var(--primary);"></i> ${emp.full_name}</td>
                <td>${emp.employee_id}</td>
                <td>${emp.department}</td>
                <td>${emp.position}</td>
                <td style="font-size: 0.9rem; color: #999;">${emp.email || 'N/A'}</td>
                <td><span style="color: ${attendanceRateColor}; font-weight: 600;">${emp.attendance_rate}%</span></td>
                <td><span style="color: #10b981; font-weight: 600;">${emp.present_count}</span></td>
                <td><span style="color: #ef4444; font-weight: 600;">${emp.absent_count}</span></td>
                <td style="font-size: 0.9rem;">${emp.last_attendance}</td>
            </tr>
        `;
    }).join('');
}

// Search approved employees
function searchApprovedEmployees() {
    const searchTerm = document.getElementById('employee-search').value.toLowerCase();
    
    const filtered = allApprovedEmployees.filter(emp => {
        return emp.full_name.toLowerCase().includes(searchTerm) ||
               emp.employee_id.toLowerCase().includes(searchTerm) ||
               emp.department.toLowerCase().includes(searchTerm) ||
               emp.email.toLowerCase().includes(searchTerm);
    });
    
    displayApprovedEmployees(filtered);
}

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeAnimations();
    loadPendingApprovals();
    loadApprovedEmployees();
    
    // Add search listener
    const searchInput = document.getElementById('employee-search');
    if (searchInput) {
        searchInput.addEventListener('keyup', searchApprovedEmployees);
    }
    
    // Refresh data every 30 seconds
    setInterval(() => {
        loadPendingApprovals();
        loadApprovedEmployees();
    }, 30000);
});

// View image in modal
function viewImage(src) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    modal.style.display = "flex";
    modalImg.src = src;
    
    // Close modal when clicking outside the image
    modal.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    }
}

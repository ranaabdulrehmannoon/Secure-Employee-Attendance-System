console.log('[INIT] Employee.js loading...');
const token = localStorage.getItem('token');
const employeeId = localStorage.getItem('employee_id');
let userLocation = null;
let hasLocationPermission = false;
let map = null;
let locationMarker = null;

console.log('[INIT] token:', token ? 'EXISTS' : 'MISSING');
console.log('[INIT] employeeId:', employeeId ? employeeId : 'MISSING');

if (!token || !employeeId) {
    console.error('[ERROR] Missing token or employeeId - redirecting to login');
    window.location.href = 'index.html';
}

async function loadEmployeeInfo() {
    try {
        console.log('[DEBUG] Loading employee info...');
        console.log('[DEBUG] employeeId:', employeeId);
        console.log('[DEBUG] API_BASE:', API_BASE);
        
        const response = await fetch(`${API_BASE}/api/debug/all-employees`, {
            headers: {'Authorization': `Bearer ${token}`}
        });
        
        console.log('[DEBUG] Response status:', response.status);
        
        if (response.ok) {
            const employees = await response.json();
            console.log('[DEBUG] Employees received:', employees);
            
            // Ensure ID comparison is type-safe
            const targetId = parseInt(employeeId);
            const employee = employees.find(e => e.id === targetId);
            
            console.log('[DEBUG] Looking for employee ID:', targetId);
            console.log('[DEBUG] Found employee object:', employee);
            
            if (employee) {
                const nameEl = document.querySelector('.employee-name');
                console.log('[DEBUG] Name element:', nameEl);
                if (nameEl) {
                    nameEl.textContent = employee.full_name;
                    console.log('[DEBUG] Name set to:', employee.full_name);
                }
                const avatarEl = document.querySelector('.employee-avatar');
                console.log('[DEBUG] Avatar element found:', avatarEl);
                
                if (avatarEl) {
                    // Check both face_image and face_data as fallback
                    let faceImage = employee.face_image;
                    
                    // If face_image is missing/empty, try to use face_data if it looks like an image
                    if ((!faceImage || faceImage.length < 100) && employee.face_data && employee.face_data.startsWith('data:image')) {
                        console.log('[DEBUG] Using face_data as fallback image source');
                        faceImage = employee.face_data;
                    }

                    console.log('[DEBUG] Face image data type:', typeof faceImage);
                    console.log('[DEBUG] Face image length:', faceImage ? faceImage.length : 0);
                    if (faceImage) {
                        // Clean up base64 string - remove newlines and spaces
                        faceImage = faceImage.replace(/[\r\n\s]/g, '');
                        console.log('[DEBUG] Face image start:', faceImage.substring(0, 50));
                    }
                    
                    if (faceImage && faceImage.length > 100) {
                        console.log('[DEBUG] Attempting to set avatar image...');
                        
                        // Create a new image object to test loading
                        const img = new Image();
                        
                        img.onload = function() {
                            console.log('[DEBUG] ✅ Avatar image loaded successfully');
                            console.log('[DEBUG] Image dimensions:', img.width, 'x', img.height);
                            avatarEl.innerHTML = ''; // Clear initial
                            img.style.width = '100%';
                            img.style.height = '100%';
                            img.style.objectFit = 'cover';
                            img.style.borderRadius = '50%';
                            avatarEl.appendChild(img);
                        };
                        
                        img.onerror = function(e) {
                            console.error('[ERROR] ❌ Failed to load avatar image. Data might be corrupted.', e);
                            avatarEl.textContent = employee.full_name.charAt(0).toUpperCase();
                            // Visual indicator of error in debug mode
                            avatarEl.style.border = '2px solid red';
                        };
                        
                        // Set src AFTER setting callbacks
                        img.src = faceImage;
                    } else {
                        console.warn('[WARN] No valid face image found for employee');
                        avatarEl.textContent = employee.full_name.charAt(0).toUpperCase();
                    }
                }
            } else {
                console.log('[DEBUG] Employee not found in list. Looking for id:', parseInt(employeeId));
            }
        } else {
            console.error('[ERROR] Response not OK:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Failed to load employee info:', error);
    }
}

function requestLocationPermission() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                hasLocationPermission = true;
                updateLocationStatus();
                initializeMap();
                showAlert('✅ Location enabled successfully', 'success');
            },
            (error) => {
                hasLocationPermission = false;
                updateLocationStatus();
                showAlert('❌ Location access denied. Please enable location to mark attendance.', 'error');
                console.error('Geolocation error:', error);
            },
            {enableHighAccuracy: false, timeout: 5000, maximumAge: 0}
        );
    } else {
        showAlert('❌ Geolocation is not supported by your browser.', 'error');
    }
}

function updateLocationStatus() {
    const statusEl = document.getElementById('location-status');
    if (hasLocationPermission && userLocation) {
        statusEl.innerHTML = `✅ Location enabled (Accuracy: ${userLocation.accuracy.toFixed(0)}m)`;
        statusEl.style.color = '#27ae60';
    } else {
        statusEl.innerHTML = '❌ Location disabled - Please enable to mark attendance';
        statusEl.style.color = '#e74c3c';
    }
}

function isLocationValid(lat, lon) {
    const ALLOWED_LAT_MIN = 33.60;
    const ALLOWED_LAT_MAX = 33.70;
    const ALLOWED_LON_MIN = 72.95;
    const ALLOWED_LON_MAX = 73.25;
    
    console.log('[DEBUG] Location validation check:');
    console.log('  Your coords: Lat=' + lat + ', Lon=' + lon);
    console.log('  Allowed range: Lat=' + ALLOWED_LAT_MIN + '-' + ALLOWED_LAT_MAX + ', Lon=' + ALLOWED_LON_MIN + '-' + ALLOWED_LON_MAX);
    
    return lat >= ALLOWED_LAT_MIN && lat <= ALLOWED_LAT_MAX && 
           lon >= ALLOWED_LON_MIN && lon <= ALLOWED_LON_MAX;
}

function initializeMap() {
    const mapContainer = document.getElementById('map');
    
    if (!map && userLocation) {
        mapContainer.style.display = 'block';
        
        setTimeout(() => {
            map = L.map('map').setView([userLocation.latitude, userLocation.longitude], 17);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
                minZoom: 13
            }).addTo(map);
            
            const NUST_LAT = 33.643;
            const NUST_LON = 73.184;
            
            L.circle([NUST_LAT, NUST_LON], {
                color: '#00ff9d',
                fillColor: '#00ff9d',
                fillOpacity: 0.1,
                radius: 1000,
                weight: 2,
                dashArray: '5, 5'
            }).addTo(map).bindPopup('<b>✅ Attendance Zone (NUST H-12)</b><br>You must be here to mark attendance');
            
            L.marker([NUST_LAT, NUST_LON], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                }),
                title: 'NUST H-12 Islamabad - Attendance Zone'
            }).addTo(map).bindPopup('<b>✅ NUST H-12 Islamabad</b><br>Attendance Zone Center');
            
            const isValid = isLocationValid(userLocation.latitude, userLocation.longitude);
            const iconUrl = isValid ? 
                'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png' :
                'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
            
            locationMarker = L.marker([userLocation.latitude, userLocation.longitude], {
                icon: L.icon({
                    iconUrl: iconUrl,
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                }),
                title: 'Your Current Location'
            }).addTo(map);
            
            const statusText = isValid ? 
                '<b>✅ You are INSIDE attendance zone</b><br>Ready to mark attendance' :
                '<b>❌ You are OUTSIDE attendance zone</b><br>Move to NUST H-12 to mark attendance';
            locationMarker.bindPopup(statusText).openPopup();
            
            map.invalidateSize();
        }, 100);
    } else if (map && userLocation) {
        map.setView([userLocation.latitude, userLocation.longitude], 17);
        if (locationMarker) {
            locationMarker.setLatLng([userLocation.latitude, userLocation.longitude]);
            const isValid = isLocationValid(userLocation.latitude, userLocation.longitude);
            const statusText = isValid ? 
                '<b>✅ You are INSIDE attendance zone</b><br>Ready to mark attendance' :
                '<b>❌ You are OUTSIDE attendance zone</b><br>Move to NUST H-12 to mark attendance';
            locationMarker.setPopupContent(statusText);
        }
    }
}



// Load attendance data
async function loadAttendance() {
    try {
        console.log('[ATTENDANCE] Loading attendance for employee:', employeeId);
        const response = await fetch(`${API_BASE}/api/employee/my-attendance?employee_id=${employeeId}&t=${Date.now()}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        console.log('[ATTENDANCE] Response status:', response.status);

        if (response.ok) {
            const attendance = await response.json();
            console.log('[ATTENDANCE] Loaded records:', attendance.length);
            if (attendance.length > 0) {
                console.log('[ATTENDANCE] Latest record status:', attendance[0].status);
            }
            displayAttendance(attendance);
            updateStats(attendance);
        } else {
            const errorData = await response.text();
            console.error('[ATTENDANCE] Error response:', response.status, errorData);
            showAlert(`Failed to load attendance data: ${response.status}`, 'error');
        }
    } catch (error) {
        console.error('[ATTENDANCE] Fetch error:', error);
        showAlert('Failed to load attendance data: ' + error.message, 'error');
    }
}

function displayAttendance(attendance) {
    const tbody = document.getElementById('attendance-body');
    tbody.innerHTML = '';

    if (attendance.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: rgba(224, 247, 250, 0.5);">No attendance records found</td></tr>';
        return;
    }

    attendance.forEach(record => {
        const row = document.createElement('tr');
        let statusClass = 'absent';
        let statusText = 'Absent';
        
        if (record.status === 'present') {
            statusClass = 'present';
            statusText = 'Present';
        } else if (record.status === 'pending_approval') {
            statusClass = 'pending';
            statusText = 'Pending Approval';
        }
        
        row.innerHTML = `
            <td>${new Date(record.date).toLocaleDateString()}</td>
            <td><div class="${statusClass}">${statusText}</div></td>
            <td>${new Date(record.marked_at).toLocaleString()}</td>
            <td>${record.location_name || 'N/A'}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateStats(attendance) {
    const today = new Date().toDateString();
    const todayRecord = attendance.find(record => 
        new Date(record.date).toDateString() === today
    );
    
    const totalPresent = attendance.filter(record => record.status === 'present').length;
    const totalDays = attendance.length > 0 ? attendance.length : 1;
    const attendanceRate = Math.round((totalPresent / totalDays) * 100);
    
    const todayStatusEl = document.getElementById('today-status');
    if (todayStatusEl) {
        if (!todayRecord) {
            todayStatusEl.textContent = 'Not Marked';
            todayStatusEl.style.color = '#ffbe0b';
        } else if (todayRecord.status === 'present') {
            todayStatusEl.textContent = '✅ Present';
            todayStatusEl.style.color = '#00ff9d';
        } else if (todayRecord.status === 'pending_approval') {
            todayStatusEl.textContent = '⏳ Pending';
            todayStatusEl.style.color = '#ffbe0b';
        } else {
            todayStatusEl.textContent = '❌ Absent';
            todayStatusEl.style.color = '#ff006e';
        }
    }
    
    const todayProgressEl = document.getElementById('today-progress');
    if (todayProgressEl) {
        todayProgressEl.style.width = todayRecord ? '100%' : '0%';
    }
    
    const presentEl = document.getElementById('total-present');
    if (presentEl) presentEl.textContent = totalPresent;
    
    const presentProgressEl = document.getElementById('present-progress');
    if (presentProgressEl && totalDays > 0) {
        presentProgressEl.style.width = Math.round((totalPresent / totalDays) * 100) + '%';
    }
    
    const rateEl = document.getElementById('attendance-rate');
    if (rateEl) rateEl.textContent = attendanceRate + '%';
    
    const rateProgressEl = document.getElementById('rate-progress');
    if (rateProgressEl) {
        rateProgressEl.style.width = attendanceRate + '%';
    }
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function attachEventListeners() {
    console.log('[DEBUG] Attaching event listeners...');
    
    const enableLocationBtn = document.getElementById('enable-location');
    console.log('[DEBUG] Enable location button:', enableLocationBtn);
    if (enableLocationBtn) {
        enableLocationBtn.style.display = 'flex'; // Ensure it is visible
        enableLocationBtn.addEventListener('click', requestLocationPermission);
        console.log('[DEBUG] Enable location listener attached');
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    console.log('[DEBUG] Logout button:', logoutBtn);
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            console.log('[DEBUG] Logout clicked');
            localStorage.clear();
            window.location.href = 'index.html';
        });
        console.log('[DEBUG] Logout listener attached');
    }
    
    const markAttendanceBtn = document.getElementById('mark-attendance');
    console.log('[DEBUG] Mark attendance button:', markAttendanceBtn);
    if (markAttendanceBtn) {
        markAttendanceBtn.addEventListener('click', async () => {
            console.log('[DEBUG] Mark attendance clicked');
            if (!hasLocationPermission || !userLocation) {
                showAlert('❌ Please enable location first by clicking "Enable Location"', 'error');
                return;
            }

            if (!isLocationValid(userLocation.latitude, userLocation.longitude)) {
                showAlert('❌ You must be at NUST H-12 Islamabad to mark attendance', 'error');
                return;
            }

            console.log('📍 Current Location:', {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                accuracy: userLocation.accuracy
            });

            try {
                const button = document.getElementById('mark-attendance');
                button.disabled = true;
                button.textContent = '⏳ Marking...';

                const payloadData = {
                    employee_id: parseInt(employeeId),
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    location_name: "NUST H-12 Islamabad"
                };
                
                console.log('📤 Sending attendance payload:', payloadData);

                const response = await fetch(`${API_BASE}/api/employee/mark-attendance`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payloadData)
                });

                const data = await response.json();

                if (response.ok) {
                    if (data.message && data.message.includes("Verified by Biometrics")) {
                        showAlert('✅ Attendance Marked Successfully (Verified by Biometrics)', 'success');
                        button.textContent = '✅ Present';
                        button.style.background = '#27ae60';
                    } else {
                        // Show animated overlay for pending requests
                        document.getElementById('blur-overlay').classList.add('active');
                        button.textContent = '✅ Request Sent';
                        button.style.background = '#95a5a6';
                    }
                    
                    loadAttendance();
                } else {
                    showAlert('❌ ' + data.detail, 'error');
                    button.disabled = false;
                    button.textContent = 'Mark Present';
                    console.log('❌ Backend Response:', data);
                }
            } catch (error) {
                showAlert('❌ Failed to mark attendance - Check backend connection', 'error');
                console.error('Error:', error);
                const button = document.getElementById('mark-attendance');
                button.disabled = false;
                button.textContent = 'Mark Present';
            }
        });
        console.log('[DEBUG] Mark attendance listener attached');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded fired');
    console.log('[DEBUG] API_BASE:', typeof API_BASE !== 'undefined' ? API_BASE : 'UNDEFINED!');
    console.log('[DEBUG] token:', token ? 'EXISTS' : 'MISSING');
    console.log('[DEBUG] employeeId:', employeeId ? employeeId : 'MISSING');
    
    loadEmployeeInfo();
    updateLocationStatus();
    loadAttendance();
    setInterval(loadAttendance, 30000);
    
    setTimeout(() => {
        console.log('[DEBUG] Calling attachEventListeners after 500ms');
        attachEventListeners();
    }, 500);
});
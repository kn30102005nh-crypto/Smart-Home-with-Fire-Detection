// ==========================================
// MQTT + FIREBASE WEB CLIENT cho HCMUTE IoT Fire Alarm
// ==========================================

// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "https://tt-iot-427aa-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tt-iot-427aa",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
console.log('✅ Firebase initialized');

// ==================== MQTT CONFIG ====================
const MQTT_CONFIG = {
    host: 'broker.hivemq.com',
    port: 8000, // WebSocket port
    clientId: 'HCMUTE_Web_' + Math.random().toString(16).substr(2, 8),
    
    // Topics
    topics: {
        sensors: 'hcmute/fire/sensors',
        devices: 'hcmute/fire/devices',
        led: 'hcmute/fire/devices/led',
        speaker: 'hcmute/fire/devices/speaker',
        sos: 'hcmute/fire/devices/sos',
        status: 'hcmute/fire/status'
    }
};

let mqttClient = null;
let chart;
let chartData = { labels: [], temp: [], hum: [], smoke: [] };
let isUpdatingFromFirebase = false; // Flag để tránh loop

// ==========================================
// FIREBASE LISTENERS
// ==========================================

// Listen to SENSOR changes from Firebase
database.ref('sensors').limitToLast(1).on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const keys = Object.keys(data);
        const latestKey = keys[keys.length - 1];
        if (latestKey && data[latestKey]) {
            console.log('🔥 Firebase sensor update:', data[latestKey]);
            updateSensorUI(data[latestKey]);
        }
    }
}, (error) => {
    console.error('❌ Firebase sensors error:', error);
});

// ⚠️ QUAN TRỌNG: Listen to DEVICE changes from Firebase
database.ref('devices').on('value', (snapshot) => {
    const devices = snapshot.val();
    if (devices) {
        console.log('🎛️ Firebase devices update:', devices);
        isUpdatingFromFirebase = true;
        
        // Update UI switches to match Firebase
        if (typeof devices.led !== 'undefined') {
            const ledToggle = document.getElementById('toggle-led');
            if (ledToggle) ledToggle.checked = devices.led;
        }
        
        if (typeof devices.speaker !== 'undefined') {
            const speakerToggle = document.getElementById('toggle-speaker');
            if (speakerToggle) speakerToggle.checked = devices.speaker;
        }
        
        if (typeof devices.sos !== 'undefined') {
            const sosToggle = document.getElementById('toggle-sos');
            if (sosToggle) sosToggle.checked = devices.sos;
        }
        
        setTimeout(() => isUpdatingFromFirebase = false, 100);
    }
}, (error) => {
    console.error('❌ Firebase devices error:', error);
});

// Listen to HISTORY changes from Firebase
database.ref('history').limitToLast(50).on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        console.log('📋 Firebase history update');
        const historyArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })).sort((a, b) => b.timestamp - a.timestamp);
        
        displayFirebaseHistory(historyArray);
    }
}, (error) => {
    console.error('❌ Firebase history error:', error);
});

// ==========================================
// SAVE TO FIREBASE
// ==========================================
function saveSensorToFirebase(data) {
    const sensorData = {
        temperature: parseFloat(data.temperature) || 0,
        humidity: parseFloat(data.humidity) || 0,
        smoke: parseFloat(data.smoke) || 0,
        timestamp: data.timestamp || Date.now()
    };
    
    database.ref('sensors').push(sensorData)
        .then(() => console.log('✅ Saved sensor to Firebase'))
        .catch((error) => console.error('❌ Firebase save error:', error));
}

function saveDeviceToFirebase(device, state) {
    database.ref(`devices/${device}`).set(state)
        .then(() => {
            console.log(`✅ Firebase updated: ${device} = ${state}`);
        })
        .catch((error) => {
            console.error('❌ Firebase device update error:', error);
        });
}

function saveHistoryToFirebase(type, message) {
    database.ref('history').push({
        type: type,
        message: message,
        timestamp: Date.now()
    }).catch((error) => {
        console.error('❌ History save error:', error);
    });
}

// ==========================================
// MQTT CONNECTION
// ==========================================
function connectMQTT() {
    console.log('🔌 Đang kết nối MQTT...');
    
    // Sử dụng Paho MQTT client
    mqttClient = new Paho.MQTT.Client(
        MQTT_CONFIG.host,
        MQTT_CONFIG.port,
        MQTT_CONFIG.clientId
    );
    
    // Set callbacks
    mqttClient.onConnectionLost = onConnectionLost;
    mqttClient.onMessageArrived = onMessageArrived;
    
    // Connect options
    const options = {
        timeout: 10,
        onSuccess: onConnect,
        onFailure: onConnectionFailure,
        useSSL: false,
        keepAliveInterval: 60
    };
    
    mqttClient.connect(options);
}

function onConnect() {
    console.log('✅ MQTT Connected!');
    showNotification('Đã kết nối MQTT', 'success');
    
    // Subscribe to topics
    mqttClient.subscribe(MQTT_CONFIG.topics.sensors);
    mqttClient.subscribe(MQTT_CONFIG.topics.devices);
    mqttClient.subscribe(MQTT_CONFIG.topics.status);
    
    console.log('📡 Đã subscribe topics');
    updateConnectionStatus(true);
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.log('❌ MQTT Connection Lost: ' + responseObject.errorMessage);
        showNotification('Mất kết nối MQTT', 'error');
        updateConnectionStatus(false);
        
        // Auto reconnect sau 5s
        setTimeout(connectMQTT, 5000);
    }
}

function onConnectionFailure(error) {
    console.log('❌ MQTT Connection Failed: ' + error.errorMessage);
    showNotification('Không thể kết nối MQTT', 'error');
    updateConnectionStatus(false);
    
    // Retry sau 5s
    setTimeout(connectMQTT, 5000);
}

function onMessageArrived(message) {
    const topic = message.destinationName;
    const payload = message.payloadString;
    
    console.log('📨 MQTT Message:', topic, payload);
    
    try {
        const data = JSON.parse(payload);
        
        if (topic === MQTT_CONFIG.topics.sensors) {
            updateSensorUI(data);
            // Save to Firebase
            saveSensorToFirebase(data);
        } else if (topic === MQTT_CONFIG.topics.devices) {
            updateDeviceUI(data);
        } else if (topic === MQTT_CONFIG.topics.status) {
            console.log('📊 Status:', data);
        }
    } catch (e) {
        console.error('JSON Parse Error:', e);
    }
}

// ==========================================
// UI UPDATES
// ==========================================
function updateSensorUI(data) {
    // Update sensor values
    if(document.getElementById('tempValue')) {
        document.getElementById('tempValue').innerText = (data.temperature || 0).toFixed(1) + "°C";
    }
    if(document.getElementById('humValue')) {
        document.getElementById('humValue').innerText = (data.humidity || 0).toFixed(1) + "%";
    }
    if(document.getElementById('smokeValue')) {
        document.getElementById('smokeValue').innerText = (data.smoke || 0) + " PPM";
    }
    
    // Update fire status
    const statusEl = document.getElementById('fireStatus');
    if (statusEl) {
        const temp = parseFloat(data.temperature) || 0;
        const smoke = parseFloat(data.smoke) || 0;
        
        if (smoke > 800 || temp > 50 || data.flame) {
            statusEl.innerHTML = "🔥 NGUY HIỂM";
            statusEl.style.color = "#ef4444";
            
            // Save alert to history
            saveHistoryToFirebase('fire_alert', `NGUY HIỂM! Nhiệt độ: ${temp}°C, Khói: ${smoke} PPM`);
            showNotification('⚠️ CẢNH BÁO: Phát hiện cháy!', 'error');
        } else if (smoke > 500 || temp > 40) {
            statusEl.innerHTML = "⚠️ Cảnh báo";
            statusEl.style.color = "#fbbf24";
        } else {
            statusEl.innerHTML = "🛡️ An toàn";
            statusEl.style.color = "#34d399";
        }
    }
    
    // Update chart
    updateChart(data);
}

function updateDeviceUI(data) {
    if(document.getElementById('toggle-led')) {
        document.getElementById('toggle-led').checked = data.led;
    }
    if(document.getElementById('toggle-speaker')) {
        document.getElementById('toggle-speaker').checked = data.speaker;
    }
    if(document.getElementById('toggle-sos')) {
        document.getElementById('toggle-sos').checked = data.sos;
    }
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('mqttStatus');
    if (statusEl) {
        statusEl.innerHTML = connected ? 
            '🟢 MQTT Connected' : 
            '🔴 MQTT Disconnected';
        statusEl.style.color = connected ? '#34d399' : '#ef4444';
    }
}

// ==========================================
// CONTROL FUNCTIONS
// ==========================================
function toggleDevice(device) {
    // Bỏ qua nếu đang cập nhật từ Firebase để tránh loop
    if (isUpdatingFromFirebase) {
        console.log('⏭️ Skipping toggle (updating from Firebase)');
        return;
    }
    
    const cb = document.getElementById(`toggle-${device}`);
    if(!cb) return;
    
    const state = cb.checked;
    console.log(`🎛️ Toggling ${device}: ${state}`);
    
    // 1. Save to Firebase (primary source of truth)
    saveDeviceToFirebase(device, state);
    
    // 2. Send via MQTT (if connected)
    if(mqttClient && mqttClient.isConnected()) {
        const message = new Paho.MQTT.Message(JSON.stringify({
            [device]: state,
            timestamp: Date.now()
        }));
        message.destinationName = MQTT_CONFIG.topics[device];
        mqttClient.send(message);
        console.log(`📤 MQTT Sent: ${device} = ${state}`);
    } else {
        console.warn('⚠️ MQTT not connected, only Firebase updated');
    }
    
    // 3. Log history
    const deviceName = device === 'led' ? 'Đèn cảnh báo' : 
                      (device === 'speaker' ? 'Còi báo động' : 'Gọi cứu hỏa');
    const action = state ? 'BẬT' : 'TẮT';
    saveHistoryToFirebase('device_control', `${deviceName}: ${action}`);
    logHistory(`${deviceName} đã ${action}`, state ? 'danger' : 'success');
}

function emergencyStop() {
    if (confirm("⚠️ Xác nhận tắt TẤT CẢ thiết bị?")) {
        console.log('🚨 Emergency stop activated');
        
        const allOff = {
            led: false,
            speaker: false,
            sos: false
        };
        
        // 1. Save to Firebase
        database.ref('devices').set(allOff)
            .then(() => {
                console.log('✅ Emergency stop successful');
                
                // 2. Send via MQTT
                if(mqttClient && mqttClient.isConnected()) {
                    const message = new Paho.MQTT.Message(JSON.stringify(allOff));
                    message.destinationName = MQTT_CONFIG.topics.devices;
                    mqttClient.send(message);
                }
                
                // 3. Log
                saveHistoryToFirebase('emergency', '🛑 DỪNG KHẨN CẤP - Tất cả thiết bị đã TẮT');
                logHistory('🛑 DỪNG KHẨN CẤP HỆ THỐNG', 'danger');
                showNotification('🛑 Dừng khẩn cấp thành công', 'warning');
            })
            .catch((error) => {
                console.error('❌ Emergency stop error:', error);
                showNotification('Lỗi dừng khẩn cấp', 'error');
            });
    }
}

// ==========================================
// CHART FUNCTIONS
// ==========================================
function initChart() {
    const ctx = document.getElementById('sensorChart');
    if (!ctx) return;
    
    chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Nhiệt độ (°C)',
                    data: [],
                    borderColor: '#f87171',
                    backgroundColor: 'rgba(248,113,113,0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Độ ẩm (%)',
                    data: [],
                    borderColor: '#60a5fa',
                    backgroundColor: 'rgba(96,165,250,0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Khói (PPM)',
                    data: [],
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251,191,36,0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { 
                    labels: { color: '#94a3b8', font: { size: 12 } } 
                } 
            },
            scales: {
                x: { 
                    grid: { color: 'rgba(255,255,255,0.05)' }, 
                    ticks: { color: '#94a3b8', font: { size: 10 } } 
                },
                y: { 
                    grid: { color: 'rgba(255,255,255,0.05)' }, 
                    ticks: { color: '#94a3b8', font: { size: 10 } } 
                }
            }
        }
    });
}

function updateChart(data) {
    if (!chart) return;
    
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    
    // Keep only last 15 points
    if (chartData.labels.length > 15) {
        chartData.labels.shift();
        chartData.temp.shift();
        chartData.hum.shift();
        chartData.smoke.shift();
    }
    
    chartData.labels.push(time);
    chartData.temp.push(parseFloat(data.temperature) || 0);
    chartData.hum.push(parseFloat(data.humidity) || 0);
    chartData.smoke.push(parseFloat(data.smoke) || 0);
    
    chart.data.labels = chartData.labels;
    chart.data.datasets[0].data = chartData.temp;
    chart.data.datasets[1].data = chartData.hum;
    chart.data.datasets[2].data = chartData.smoke;
    chart.update('none'); // Update without animation
}

// ==========================================
// HISTORY DISPLAY
// ==========================================
function displayFirebaseHistory(historyArray) {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    if (historyArray.length === 0) {
        historyList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b;">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>Chưa có lịch sử hoạt động</p>
            </div>
        `;
        return;
    }
    
    historyList.innerHTML = historyArray.map(item => {
        const date = new Date(item.timestamp).toLocaleString('vi-VN');
        
        let icon = 'info-circle';
        let color = '#6366f1';
        let styleClass = 'h-info';
        
        if (item.type === 'fire_alert') {
            icon = 'fire';
            color = '#ef4444';
            styleClass = 'h-danger';
        } else if (item.type === 'device_control') {
            icon = 'toggle-on';
            color = '#10b981';
            styleClass = 'h-success';
        } else if (item.type === 'emergency') {
            icon = 'exclamation-triangle';
            color = '#fbbf24';
            styleClass = 'h-warning';
        }
        
        return `
            <div class="history-item ${styleClass}" style="animation: fadeIn 0.5s ease;">
                <div class="history-icon" style="background: ${color}20; color: ${color};">
                    <i class="fas fa-${icon}"></i>
                </div>
                <div class="history-content">
                    <span class="history-title">${item.message}</span>
                    <span class="history-time"><i class="far fa-clock"></i> ${date}</span>
                </div>
            </div>
        `;
    }).join('');
}

function logHistory(message, type = 'info') {
    const time = new Date().toLocaleString('vi-VN');
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    let icon = 'fa-info-circle';
    let styleClass = 'h-info';
    
    if (type === 'danger') {
        icon = 'fa-exclamation-triangle';
        styleClass = 'h-danger';
    } else if (type === 'success') {
        icon = 'fa-check-circle';
        styleClass = 'h-success';
    } else if (type === 'warning') {
        icon = 'fa-exclamation-triangle';
        styleClass = 'h-warning';
    }
    
    const div = document.createElement('div');
    div.className = `history-item ${styleClass}`;
    div.style.animation = 'fadeIn 0.5s ease';
    div.innerHTML = `
        <div class="history-icon"><i class="fas ${icon}"></i></div>
        <div class="history-content">
            <span class="history-title">${message}</span>
            <span class="history-time"><i class="far fa-clock"></i> ${time}</span>
        </div>
    `;
    
    historyList.insertBefore(div, historyList.firstChild);
}

function clearHistory() {
    if(confirm('⚠️ Xác nhận xóa toàn bộ lịch sử?')) {
        database.ref('history').remove()
            .then(() => {
                console.log('✅ History cleared');
                showNotification('Đã xóa lịch sử', 'success');
            })
            .catch((error) => {
                console.error('❌ Clear history error:', error);
                showNotification('Lỗi xóa lịch sử', 'error');
            });
    }
}

// ==========================================
// NOTIFICATION
// ==========================================
function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999;
        padding: 15px 25px; border-radius: 12px; color: white;
        font-weight: 600; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    notif.style.background = type === 'success' ? '#10b981' : 
                             type === 'error' ? '#ef4444' : 
                             type === 'warning' ? '#fbbf24' : '#3b82f6';
    notif.textContent = message;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// ==========================================
// NAVIGATION & OTHER UI FUNCTIONS
// ==========================================
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            const pageId = this.getAttribute('data-page');
            views.forEach(v => v.style.display = 'none');
            
            const viewMap = {
                'dashboard': 'dashboard-view',
                'lstm': 'lstm-view',
                'mqtt-monitor': 'mqtt-monitor-view',
                'history': 'history-view'
            };
            
            const viewId = viewMap[pageId];
            if (viewId) {
                const view = document.getElementById(viewId);
                if (view) view.style.display = 'block';
            }
        });
    });
}

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

function setupAvatarUpload() {
    const fileInput = document.getElementById('avatarInput');
    const modalAvatar = document.getElementById('modalAvatar');
    const headerAvatar = document.getElementById('headerAvatar');
    
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageUrl = e.target.result;
                    if (modalAvatar) modalAvatar.src = imageUrl;
                    if (headerAvatar) headerAvatar.src = imageUrl;
                }
                reader.readAsDataURL(file);
            }
        });
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.remove('show');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function saveProfile() {
    showNotification('✅ Đã cập nhật hồ sơ!', 'success');
    closeModal('profileModal');
}

function logout() {
    if (confirm("Đăng xuất khỏi hệ thống?")) {
        if (mqttClient && mqttClient.isConnected()) {
            mqttClient.disconnect();
        }
        firebase.auth().signOut().then(() => {
            window.location.href = 'login.html';
        });
    }
}

// ==========================================
// INITIALIZE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Khởi động MQTT + Firebase Web Client...');
    
    // Initialize chart
    initChart();
    
    // Add MQTT status indicator to header
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
        const statusDiv = document.createElement('div');
        statusDiv.innerHTML = '<span id="mqttStatus" style="margin-right: 20px; font-size: 0.85rem;">🔴 MQTT Disconnected</span>';
        headerRight.insertBefore(statusDiv, headerRight.firstChild);
    }
    
    // Connect MQTT
    connectMQTT();
    
    // Load initial device states from Firebase
    database.ref('devices').once('value').then((snapshot) => {
        const devices = snapshot.val();
        if (devices) {
            console.log('🎛️ Initial device states from Firebase:', devices);
            
            if (typeof devices.led !== 'undefined') {
                const led = document.getElementById('toggle-led');
                if (led) led.checked = devices.led;
            }
            if (typeof devices.speaker !== 'undefined') {
                const speaker = document.getElementById('toggle-speaker');
                if (speaker) speaker.checked = devices.speaker;
            }
            if (typeof devices.sos !== 'undefined') {
                const sos = document.getElementById('toggle-sos');
                if (sos) sos.checked = devices.sos;
            }
        }
    }).catch((error) => {
        console.error('❌ Load initial states error:', error);
    });
    
    // Setup navigation và các sự kiện khác
    setupNavigation();
    setupAvatarUpload();
    
    // Đóng dropdown khi click ngoài
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('userDropdown');
        const userAdmin = document.querySelector('.user-admin');
        if (dropdown && userAdmin && !userAdmin.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
    
    console.log('✅ Fire IoT System Ready');
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);
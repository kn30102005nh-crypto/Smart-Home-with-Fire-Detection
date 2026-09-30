// ==========================================
// 1. CẤU HÌNH & KẾT NỐI FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAvb_FDoSynGx59kNCGG59zMZgihk60ULk",
    authDomain: "tt-iot-427aa.firebaseapp.com",
    databaseURL: "https://tt-iot-427aa-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tt-iot-427aa",
    storageBucket: "tt-iot-427aa.firebasestorage.app",
    messagingSenderId: "199545600596",
    appId: "1:199545600596:web:a56b6559c413e7722e4bc1",
    measurementId: "G-842H2HYZCR"
};

let database, auth;
try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    auth = firebase.auth();
    console.log("✅ Firebase Connected!");
} catch (error) {
    console.error("❌ Firebase Error:", error);
}

let chart;
let chartData = { labels: [], temp: [], hum: [], smoke: [] };

// ==========================================
// 2. MAIN EXECUTION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    listenToSensors();
    listenToUsers();
    listenToHistory();
    setupNavigation();
    setupAvatarUpload();

    // Đóng Dropdown/Modal khi click ra ngoài
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('userDropdown');
        const userAdmin = document.querySelector('.user-admin');
        if (dropdown && userAdmin && !userAdmin.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
        if (e.target.classList.contains('modal-overlay')) {
            e.target.style.display = 'none';
        }
    });
});

// ==========================================
// 3. UI LOGIC (AVATAR & MODAL)
// ==========================================
function toggleUserMenu() {
    document.getElementById('userDropdown').classList.toggle('show');
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
    document.getElementById('userDropdown').classList.remove('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function setupAvatarUpload() {
    const fileInput = document.getElementById('avatarInput');
    const modalAvatar = document.getElementById('modalAvatar');
    const headerAvatar = document.getElementById('headerAvatar');

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imageUrl = e.target.result;
                modalAvatar.src = imageUrl;
                headerAvatar.src = imageUrl;
            }
            reader.readAsDataURL(file);
        }
    });
}

function saveProfile() {
    alert("✅ Đã cập nhật hồ sơ và ảnh đại diện!");
    closeModal('profileModal');
}

// ==========================================
// 4. NAVIGATION
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

            if (pageId === 'dashboard') document.getElementById('dashboard-view').style.display = 'block';
            else if (pageId === 'users') document.getElementById('users-view').style.display = 'block';
            else if (pageId === 'history') document.getElementById('history-view').style.display = 'block';
            else {
                alert('Chức năng đang phát triển!');
                document.getElementById('dashboard-view').style.display = 'block';
            }
        });
    });
}

function logout() {
    if (confirm("Đăng xuất khỏi hệ thống?")) auth.signOut().then(() => location.href = 'login.html');
}

// ==========================================
// 5. DASHBOARD LOGIC
// ==========================================
function listenToSensors() {
    database.ref('sensors').on('value', (snapshot) => {
        const data = snapshot.val() || {};
        if(document.getElementById('tempValue')) document.getElementById('tempValue').innerText = (data.temperature || 0) + "°C";
        if(document.getElementById('humValue')) document.getElementById('humValue').innerText = (data.humidity || 0) + "%";
        if(document.getElementById('smokeValue')) document.getElementById('smokeValue').innerText = (data.smoke || 0) + " PPM";
        
        const statusEl = document.getElementById('fireStatus');
        if (statusEl) {
            if (data.flame || data.smoke > 300 || data.temperature > 50) {
                statusEl.innerHTML = "🔥 NGUY HIỂM"; statusEl.style.color = "#ef4444";
            } else {
                statusEl.innerHTML = "🛡️ An toàn"; statusEl.style.color = "#34d399";
            }
        }
        updateChart(data);
    });

    database.ref('devices').on('value', (snapshot) => {
        const d = snapshot.val() || {};
        if(document.getElementById('toggle-led')) document.getElementById('toggle-led').checked = d.led;
        if(document.getElementById('toggle-speaker')) document.getElementById('toggle-speaker').checked = d.speaker;
        if(document.getElementById('toggle-sos')) document.getElementById('toggle-sos').checked = d.sos;
    });
}

function toggleDevice(device) {
    const cb = document.getElementById(`toggle-${device}`);
    if(cb) {
        const state = cb.checked;
        database.ref(`devices/${device}`).set(state);
        
        // Ghi log lịch sử khi bật tắt
        const deviceName = device === 'led' ? 'Đèn cảnh báo' : (device === 'speaker' ? 'Còi báo động' : 'Gọi cứu hỏa');
        const action = state ? 'đã được BẬT' : 'đã TẮT';
        const type = state ? 'danger' : 'success'; 
        logHistory(`${deviceName} ${action}`, type);
    }
}

function emergencyStop() {
    if (confirm("Tắt toàn bộ thiết bị?")) {
        database.ref('devices').update({ led: false, speaker: false, sos: false });
        logHistory('🛑 DỪNG KHẨN CẤP HỆ THỐNG', 'danger');
    }
}

// ==========================================
// 6. USER MANAGEMENT
// ==========================================
function listenToUsers() {
    database.ref('users').on('value', (snapshot) => {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        tbody.innerHTML = ''; 
        const data = snapshot.val();

        if (!data) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px;">Chưa có dữ liệu</td></tr>`;
            return;
        }
        Object.keys(data).forEach(key => renderUserRow(key, data[key]));
    });
}

function renderUserRow(id, user) {
    const tbody = document.getElementById('user-table-body');
    const color = user.color || "linear-gradient(135deg, #667eea, #764ba2)";
    const initial = user.name ? user.name.charAt(0).toUpperCase() : '?';
    
    const tr = document.createElement('tr');
    tr.style.animation = "fadeIn 0.5s ease";
    tr.innerHTML = `
        <td>
            <div class="user-profile">
                <div class="avatar-circle" style="background: ${color}; color: white;">${initial}</div>
                <div><div style="font-weight: 600;">${user.name}</div><div style="font-size: 12px; color: #94a3b8;">${user.email}</div></div>
            </div>
        </td>
        <td>${user.role}</td>
        <td>${user.date}</td>
        <td><span class="status-badge ${user.status === 'active' ? 'status-active' : 'status-offline'}">${user.status === 'active' ? 'Hoạt động' : 'Ngoại tuyến'}</span></td>
        <td><button class="action-btn" onclick="deleteUser('${id}')" style="color: #ef4444;"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
}

function openAddUserModal() {
    const name = prompt("Nhập tên thành viên:");
    if (name) {
        database.ref('users').push({
            name: name, email: `u${Date.now()}@hcmute.edu.vn`,
            role: "Thành viên", date: new Date().toLocaleDateString('vi-VN'),
            status: "active", color: getRandomGradient()
        });
    }
}

function deleteUser(id) {
    if (confirm("Xóa người dùng?")) database.ref('users/' + id).remove();
}

function getRandomGradient() {
    const g = ["linear-gradient(135deg, #FF6B6B, #556270)", "linear-gradient(135deg, #4ECDC4, #556270)", "linear-gradient(135deg, #a8c0ff, #3f2b96)"];
    return g[Math.floor(Math.random() * g.length)];
}

// ==========================================
// 7. CHART CONFIG
// ==========================================
function initChart() {
    const ctx = document.getElementById('sensorChart');
    if (!ctx) return;
    chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'Nhiệt độ', data: [], borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', fill: true, tension: 0.4 },
            { label: 'Độ ẩm', data: [], borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', fill: true, tension: 0.4 },
            { label: 'Khói', data: [], borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.1)', fill: true, tension: 0.4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } } }
        }
    });
}

function updateChart(data) {
    if (!chart) return;
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    if (chartData.labels.length > 15) { chartData.labels.shift(); chartData.temp.shift(); chartData.hum.shift(); chartData.smoke.shift(); }
    chartData.labels.push(time);
    chartData.temp.push(data.temperature || 0);
    chartData.hum.push(data.humidity || 0);
    chartData.smoke.push(data.smoke || 0);
    chart.data.labels = chartData.labels;
    chart.data.datasets[0].data = chartData.temp;
    chart.data.datasets[1].data = chartData.hum;
    chart.data.datasets[2].data = chartData.smoke;
    chart.update();
}

// ==========================================
// 8. HISTORY LOGIC
// ==========================================
function logHistory(message, type = 'info') {
    const time = new Date().toLocaleString('vi-VN');
    database.ref('history').push({
        message: message,
        time: time,
        type: type,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

function listenToHistory() {
    database.ref('history').limitToLast(20).on('value', (snapshot) => {
        const list = document.getElementById('history-list');
        if (!list) return;
        
        list.innerHTML = '';
        const data = snapshot.val();
        
        if (!data) {
            list.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">Chưa có lịch sử hoạt động</div>';
            return;
        }

        const items = Object.values(data).reverse();

        items.forEach(item => {
            let icon = 'fa-info-circle';
            let styleClass = 'h-info';

            if (item.type === 'danger') {
                icon = 'fa-exclamation-triangle';
                styleClass = 'h-danger';
            } else if (item.type === 'success') {
                icon = 'fa-check-circle';
                styleClass = 'h-success';
            }

            const div = document.createElement('div');
            div.className = `history-item ${styleClass}`;
            div.innerHTML = `
                <div class="history-icon"><i class="fas ${icon}"></i></div>
                <div class="history-content">
                    <span class="history-title">${item.message}</span>
                    <span class="history-time"><i class="far fa-clock"></i> ${item.time}</span>
                </div>
            `;
            list.appendChild(div);
        });
    });
}

function clearHistory() {
    if(confirm('Bạn chắc chắn muốn xóa toàn bộ lịch sử?')) {
        database.ref('history').remove();
    }
}
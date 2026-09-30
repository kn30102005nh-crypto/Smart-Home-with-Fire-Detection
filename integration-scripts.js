// ==========================================
// INTEGRATION SCRIPTS
// Kết nối MQTT, Firebase Data Manager và LSTM
// ==========================================

// ===== MQTT TRAFFIC MONITOR =====
let mqttPacketCount = {received: 0, sent: 0, totalSize: 0};

// Override onMessageArrived để log
if (typeof onMessageArrived !== 'undefined') {
    const originalOnMessage = onMessageArrived;
    window.onMessageArrived = function(message) {
        mqttPacketCount.received++;
        mqttPacketCount.totalSize += message.payloadString.length;
        
        logMqttPacket('RECEIVED', message.destinationName, message.payloadString);
        updateMqttStats();
        
        originalOnMessage(message);
    };
}

// Override toggleDevice để log sent packets
if (typeof toggleDevice !== 'undefined') {
    const originalToggleDevice = window.toggleDevice;
    window.toggleDevice = function(device) {
        mqttPacketCount.sent++;
        logMqttPacket('SENT', 'esp32/control/' + device, 'toggle');
        originalToggleDevice(device);
    };
}

function logMqttPacket(type, topic, payload) {
    const log = document.getElementById('mqttLog');
    if (!log) return;
    
    const time = new Date().toLocaleTimeString();
    const color = type === 'RECEIVED' ? '#34d399' : '#fbbf24';
    
    const entry = document.createElement('div');
    entry.style.cssText = `
        margin-bottom: 10px; 
        padding: 10px; 
        background: rgba(255,255,255,0.03); 
        border-left: 3px solid ${color};
        border-radius: 5px;
        font-size: 0.85rem;
    `;
    
    entry.innerHTML = `
        <div style="color: ${color}; font-weight: 600;">[${time}] ${type}</div>
        <div style="color: #94a3b8; margin-top: 5px;">Topic: ${topic}</div>
        <div style="color: #f8fafc; margin-top: 5px; word-break: break-all;">
            Payload (${payload.length} bytes): ${payload.substring(0, 200)}${payload.length > 200 ? '...' : ''}
        </div>
    `;
    
    log.insertBefore(entry, log.firstChild);
    
    // Keep only last 50 entries
    while (log.children.length > 50) {
        log.removeChild(log.lastChild);
    }
}

function updateMqttStats() {
    const totalEl = document.getElementById('totalPackets');
    const sentEl = document.getElementById('sentPackets');
    const avgEl = document.getElementById('avgSize');
    
    if (totalEl) totalEl.textContent = mqttPacketCount.received;
    if (sentEl) sentEl.textContent = mqttPacketCount.sent;
    
    const avgSize = mqttPacketCount.received > 0 ? 
        Math.round(mqttPacketCount.totalSize / mqttPacketCount.received) : 0;
    if (avgEl) avgEl.textContent = avgSize + ' B';
}

function clearMqttLog() {
    const log = document.getElementById('mqttLog');
    if (log) {
        log.innerHTML = '<div style="color: #34d399; margin-bottom: 10px;">🟢 MQTT Logger - Chờ dữ liệu...</div>';
    }
    mqttPacketCount = {received: 0, sent: 0, totalSize: 0};
    updateMqttStats();
}

// ===== DATA MANAGEMENT HANDLERS =====

async function loadFirebaseData() {
    const limit = parseInt(document.getElementById('dataLimitSelect').value);
    
    try {
        if (typeof addTrainingLog === 'function') {
            addTrainingLog(`🔄 Đang tải ${limit} mẫu từ Firebase...`);
        }
        
        const data = await fetchFirebaseData(limit);
        updateDataStats(data);
        
        if (typeof visualizeTrainingData === 'function') {
            visualizeTrainingData(data);
        }
        
        if (typeof addTrainingLog === 'function') {
            addTrainingLog(`✅ Đã tải thành công ${data.length} mẫu`);
        }
    } catch (error) {
        console.error('Error loading Firebase data:', error);
        if (typeof addTrainingLog === 'function') {
            addTrainingLog(`❌ Lỗi: ${error.message}`);
        }
        alert('Lỗi khi tải dữ liệu từ Firebase!');
    }
}

async function loadDataByTimeRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert('⚠️ Vui lòng chọn khoảng thời gian!');
        return;
    }
    
    try {
        if (typeof addTrainingLog === 'function') {
            addTrainingLog(`🔄 Đang lọc dữ liệu theo thời gian...`);
        }
        
        const data = await fetchDataByTimeRange(startDate, endDate);
        updateDataStats(data);
        
        if (typeof visualizeTrainingData === 'function') {
            visualizeTrainingData(data);
        }
        
        if (typeof addTrainingLog === 'function') {
            addTrainingLog(`✅ Đã tải ${data.length} mẫu trong khoảng thời gian`);
        }
    } catch (error) {
        console.error('Error loading data by time range:', error);
        if (typeof addTrainingLog === 'function') {
            addTrainingLog(`❌ Lỗi: ${error.message}`);
        }
        alert('Lỗi khi lọc dữ liệu: ' + error.message);
    }
}

async function loadLastNDaysData() {
    const days = parseInt(document.getElementById('daysSelect').value);
    
    try {
        if (typeof addTrainingLog === 'function') {
            addTrainingLog(`🔄 Đang tải dữ liệu ${days} ngày gần nhất...`);
        }
        
        const data = await fetchLastNDays(days);
        updateDataStats(data);
        
        if (typeof visualizeTrainingData === 'function') {
            visualizeTrainingData(data);
        }
        
        if (typeof addTrainingLog === 'function') {
            addTrainingLog(`✅ Đã tải ${data.length} mẫu từ ${days} ngày gần nhất`);
        }
    } catch (error) {
        console.error('Error loading last N days data:', error);
        if (typeof addTrainingLog === 'function') {
            addTrainingLog(`❌ Lỗi: ${error.message}`);
        }
        alert('Lỗi khi tải dữ liệu!');
    }
}

async function handleDataImport(input) {
    try {
        const data = await importTrainingData(input);
        updateDataStats(data);
        
        if (typeof visualizeTrainingData === 'function') {
            visualizeTrainingData(data);
        }
        
        alert(`✅ Đã import thành công ${data.length} mẫu!`);
    } catch (error) {
        console.error('Error importing data:', error);
        if (typeof addTrainingLog === 'function') {
            addTrainingLog(`❌ Lỗi import: ${error.message}`);
        }
        alert('Lỗi khi import dữ liệu: ' + error.message);
    }
}

function handleDataExport() {
    if (typeof cachedTrainingData === 'undefined' || !cachedTrainingData || cachedTrainingData.length === 0) {
        alert('⚠️ Chưa có dữ liệu để export! Hãy tải dữ liệu trước.');
        return;
    }
    
    if (typeof exportTrainingData === 'function') {
        exportTrainingData();
        alert('✅ Đã export dữ liệu thành công!');
    }
}

function updateDataStats(data) {
    if (!data || data.length === 0) return;
    
    const stats = calculateDataStats(data);
    
    const totalEl = document.getElementById('totalSamples');
    if (totalEl) totalEl.textContent = data.length;
    
    const hours = ((stats.timeRange.end - stats.timeRange.start) / (1000 * 60 * 60)).toFixed(1);
    const timeEl = document.getElementById('timeRange');
    if (timeEl) timeEl.textContent = `${hours} giờ`;
    
    const tempEl = document.getElementById('avgTemp');
    if (tempEl) tempEl.textContent = stats.temp.avg.toFixed(1) + '°C';
    
    const humEl = document.getElementById('avgHum');
    if (humEl) humEl.textContent = stats.hum.avg.toFixed(1) + '%';
    
    const smokeEl = document.getElementById('avgSmoke');
    if (smokeEl) smokeEl.textContent = stats.smoke.avg.toFixed(0) + ' PPM';
    
    const quality = checkDataQuality(data);
    const qualityEl = document.getElementById('dataQuality');
    if (qualityEl) {
        qualityEl.textContent = `${quality.score}/100`;
        qualityEl.style.color = quality.score >= 80 ? '#4ade80' : 
                               quality.score >= 60 ? '#fbbf24' : '#ef4444';
    }
}

function applyDataCleaning() {
    if (typeof cachedTrainingData === 'undefined' || !cachedTrainingData || cachedTrainingData.length === 0) {
        alert('⚠️ Chưa có dữ liệu để làm sạch!');
        return;
    }
    
    const removeOutliers = document.getElementById('removeOutliers').checked;
    const smoothing = document.getElementById('smoothData').checked;
    
    if (typeof addTrainingLog === 'function') {
        addTrainingLog('🧹 Đang làm sạch dữ liệu...');
    }
    
    const cleaned = cleanData(cachedTrainingData, {
        removeOutliers,
        smoothing
    });
    
    window.cachedTrainingData = cleaned;
    updateDataStats(cleaned);
    
    if (typeof visualizeTrainingData === 'function') {
        visualizeTrainingData(cleaned);
    }
    
    if (typeof addTrainingLog === 'function') {
        addTrainingLog(`✅ Đã làm sạch xong. Còn lại ${cleaned.length} mẫu`);
    }
    
    alert('✅ Đã làm sạch dữ liệu thành công!');
}

// ===== NAVIGATION =====

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            const pageId = this.getAttribute('data-page');
            views.forEach(v => v.style.display = 'none');
            
            if (pageId === 'dashboard') {
                document.getElementById('dashboard-view').style.display = 'block';
            }
            else if (pageId === 'lstm') {
                document.getElementById('lstm-view').style.display = 'block';
                // Khởi tạo LSTM view nếu chưa
                if (typeof initLSTMView === 'function') {
                    initLSTMView();
                }
            }
            else if (pageId === 'mqtt-monitor') {
                document.getElementById('mqtt-monitor-view').style.display = 'block';
            }
            else if (pageId === 'history') {
                document.getElementById('history-view').style.display = 'block';
            }
        });
    });
}

// ===== INITIALIZATION =====

window.addEventListener('load', () => {
    console.log('🚀 Khởi động Integration Scripts...');
    
    // Setup navigation
    setupNavigation();
    
    // Khởi tạo date inputs với giá trị mặc định
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const endDateInput = document.getElementById('endDate');
    const startDateInput = document.getElementById('startDate');
    
    if (endDateInput) endDateInput.value = now.toISOString().slice(0, 16);
    if (startDateInput) startDateInput.value = sevenDaysAgo.toISOString().slice(0, 16);
    
    console.log('✅ Integration Scripts đã sẵn sàng!');
    console.log('📡 MQTT + 🔥 Firebase + 🧠 LSTM = 🚀 IoT PCCC Thông minh');
});

// ===== GLOBAL ERROR HANDLER =====

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    if (typeof addTrainingLog === 'function') {
        addTrainingLog(`❌ Lỗi hệ thống: ${event.error.message}`);
    }
});

// ===== UTILITY FUNCTIONS =====

function showNotification(message, type = 'info') {
    // Simple notification system
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4ade80' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 14px;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Export cho global access
window.loadFirebaseData = loadFirebaseData;
window.loadDataByTimeRange = loadDataByTimeRange;
window.loadLastNDaysData = loadLastNDaysData;
window.handleDataImport = handleDataImport;
window.handleDataExport = handleDataExport;
window.applyDataCleaning = applyDataCleaning;
window.clearMqttLog = clearMqttLog;
window.showNotification = showNotification;

console.log('📦 Integration Scripts loaded successfully!');

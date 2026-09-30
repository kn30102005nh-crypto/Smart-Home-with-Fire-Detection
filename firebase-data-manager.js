// ==========================================
// FIREBASE DATA MANAGER FOR LSTM TRAINING
// Quản lý dữ liệu Firebase cho huấn luyện
// ==========================================

// ===== CẤU HÌNH LẤY DỮ LIỆU =====
const DATA_CONFIG = {
    minSamples: 50,          // Số mẫu tối thiểu
    maxSamples: 1000,        // Số mẫu tối đa
    defaultSamples: 200,     // Mặc định lấy 200 mẫu
    dataPath: 'sensors',     // Đường dẫn trong Firebase
    requiredFields: ['temperature', 'humidity', 'smoke', 'timestamp']
};

let cachedTrainingData = null;  // Cache dữ liệu đã tải
let dataStats = null;            // Thống kê dữ liệu

// ===== LẤY DỮ LIỆU TỪ FIREBASE =====
async function fetchFirebaseData(limitCount = DATA_CONFIG.defaultSamples, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            addTrainingLog(`📥 Đang tải ${limitCount} mẫu dữ liệu từ Firebase...`);
            
            const ref = database.ref(DATA_CONFIG.dataPath);
            
            // Có thể lọc theo thời gian nếu cần
            let query = ref;
            
            if (options.startTime && options.endTime) {
                addTrainingLog(`🕐 Lọc dữ liệu từ ${new Date(options.startTime).toLocaleString('vi-VN')} đến ${new Date(options.endTime).toLocaleString('vi-VN')}`);
                query = query.orderByChild('timestamp')
                            .startAt(options.startTime)
                            .endAt(options.endTime);
            } else {
                // Lấy dữ liệu mới nhất
                query = ref.limitToLast(limitCount);
            }
            
            query.once('value', (snapshot) => {
                const data = [];
                let validCount = 0;
                let invalidCount = 0;
                
                snapshot.forEach(child => {
                    const val = child.val();
                    
                    // Kiểm tra dữ liệu hợp lệ
                    if (isValidSensorData(val)) {
                        data.push({
                            temp: parseFloat(val.temperature) || 0,
                            hum: parseFloat(val.humidity) || 0,
                            smoke: parseFloat(val.smoke) || 0,
                            timestamp: val.timestamp || Date.now(),
                            key: child.key
                        });
                        validCount++;
                    } else {
                        invalidCount++;
                    }
                });
                
                // Sắp xếp theo timestamp
                data.sort((a, b) => a.timestamp - b.timestamp);
                
                addTrainingLog(`✅ Đã tải ${validCount} mẫu hợp lệ${invalidCount > 0 ? `, bỏ qua ${invalidCount} mẫu không hợp lệ` : ''}`);
                
                if (data.length === 0) {
                    addTrainingLog('⚠️ Không có dữ liệu hợp lệ trong Firebase!');
                    addTrainingLog('💡 Sử dụng dữ liệu mẫu để demo...');
                    resolve(generateSampleData(limitCount));
                } else {
                    // Tính thống kê
                    dataStats = calculateDataStats(data);
                    cachedTrainingData = data;
                    
                    addTrainingLog(`📊 Thống kê dữ liệu:`);
                    addTrainingLog(`   - Nhiệt độ: ${dataStats.temp.min.toFixed(1)}°C - ${dataStats.temp.max.toFixed(1)}°C (TB: ${dataStats.temp.avg.toFixed(1)}°C)`);
                    addTrainingLog(`   - Độ ẩm: ${dataStats.hum.min.toFixed(1)}% - ${dataStats.hum.max.toFixed(1)}% (TB: ${dataStats.hum.avg.toFixed(1)}%)`);
                    addTrainingLog(`   - Khói: ${dataStats.smoke.min.toFixed(0)} - ${dataStats.smoke.max.toFixed(0)} PPM (TB: ${dataStats.smoke.avg.toFixed(0)} PPM)`);
                    
                    // Kiểm tra khoảng thời gian
                    const timeRange = data[data.length - 1].timestamp - data[0].timestamp;
                    const hours = (timeRange / (1000 * 60 * 60)).toFixed(1);
                    addTrainingLog(`   - Khoảng thời gian: ${hours} giờ`);
                    
                    resolve(data);
                }
            }, (error) => {
                addTrainingLog(`❌ Lỗi khi tải dữ liệu: ${error.message}`);
                reject(error);
            });
            
        } catch (error) {
            addTrainingLog(`❌ Lỗi: ${error.message}`);
            reject(error);
        }
    });
}

// ===== KIỂM TRA DỮ LIỆU HỢP LỆ =====
function isValidSensorData(data) {
    if (!data) return false;
    
    // Kiểm tra các trường bắt buộc
    for (const field of DATA_CONFIG.requiredFields) {
        if (data[field] === undefined || data[field] === null) {
            return false;
        }
    }
    
    // Kiểm tra giá trị hợp lý
    const temp = parseFloat(data.temperature);
    const hum = parseFloat(data.humidity);
    const smoke = parseFloat(data.smoke);
    
    if (isNaN(temp) || isNaN(hum) || isNaN(smoke)) return false;
    if (temp < -50 || temp > 150) return false;        // Nhiệt độ hợp lý
    if (hum < 0 || hum > 100) return false;            // Độ ẩm 0-100%
    if (smoke < 0 || smoke > 10000) return false;      // Khói hợp lý
    
    return true;
}

// ===== TÍNH THỐNG KÊ DỮ LIỆU =====
function calculateDataStats(data) {
    if (!data || data.length === 0) return null;
    
    const temps = data.map(d => d.temp);
    const hums = data.map(d => d.hum);
    const smokes = data.map(d => d.smoke);
    
    return {
        count: data.length,
        temp: {
            min: Math.min(...temps),
            max: Math.max(...temps),
            avg: temps.reduce((a, b) => a + b, 0) / temps.length,
            std: calculateStdDev(temps)
        },
        hum: {
            min: Math.min(...hums),
            max: Math.max(...hums),
            avg: hums.reduce((a, b) => a + b, 0) / hums.length,
            std: calculateStdDev(hums)
        },
        smoke: {
            min: Math.min(...smokes),
            max: Math.max(...smokes),
            avg: smokes.reduce((a, b) => a + b, 0) / smokes.length,
            std: calculateStdDev(smokes)
        },
        timeRange: {
            start: data[0].timestamp,
            end: data[data.length - 1].timestamp,
            duration: data[data.length - 1].timestamp - data[0].timestamp
        }
    };
}

function calculateStdDev(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
}

// ===== TẠO DỮ LIỆU MẪU =====
function generateSampleData(count = 150) {
    console.log('🔧 Tạo dữ liệu mẫu với pattern thực tế...');
    
    const data = [];
    const now = Date.now();
    const baseTemp = 25;
    const baseHum = 60;
    const baseSmoke = 80;
    
    for (let i = 0; i < count; i++) {
        const t = i / 20;  // Thời gian chuẩn hóa
        const hourOfDay = ((now - (count - i) * 60000) / (1000 * 60 * 60)) % 24;
        
        // Pattern nhiệt độ: tăng vào ban ngày, giảm vào ban đêm
        const tempPattern = Math.sin(t) * 5 + 
                          Math.cos(t / 2) * 3 + 
                          Math.sin(hourOfDay / 24 * Math.PI * 2) * 4;
        
        // Pattern độ ẩm: nghịch với nhiệt độ
        const humPattern = Math.cos(t) * 10 + 
                         Math.sin(t / 3) * 5 - 
                         Math.sin(hourOfDay / 24 * Math.PI * 2) * 3;
        
        // Pattern khói: biến động ngẫu nhiên với trend nhỏ
        const smokePattern = Math.sin(t * 1.5) * 30 + 
                           Math.cos(t / 2.5) * 15;
        
        data.push({
            temp: baseTemp + tempPattern + (Math.random() - 0.5) * 2,
            hum: baseHum + humPattern + (Math.random() - 0.5) * 3,
            smoke: baseSmoke + smokePattern + (Math.random() - 0.5) * 10,
            timestamp: now - (count - i) * 60000,
            key: `sample_${i}`
        });
    }
    
    return data;
}

// ===== LẤY DỮ LIỆU THEO KHOẢNG THỜI GIAN =====
async function fetchDataByTimeRange(startDate, endDate) {
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    
    if (isNaN(startTime) || isNaN(endTime)) {
        throw new Error('Ngày không hợp lệ');
    }
    
    if (startTime >= endTime) {
        throw new Error('Ngày bắt đầu phải nhỏ hơn ngày kết thúc');
    }
    
    addTrainingLog(`📅 Lấy dữ liệu từ ${new Date(startTime).toLocaleString('vi-VN')} đến ${new Date(endTime).toLocaleString('vi-VN')}`);
    
    return await fetchFirebaseData(null, { startTime, endTime });
}

// ===== LẤY DỮ LIỆU CỦA N NGÀY GẦN NHẤT =====
async function fetchLastNDays(days = 7) {
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);
    
    addTrainingLog(`📅 Lấy dữ liệu ${days} ngày gần nhất`);
    
    return await fetchFirebaseData(null, { startTime, endTime });
}

// ===== XUẤT DỮ LIỆU RA FILE JSON =====
function exportTrainingData(data = cachedTrainingData) {
    if (!data || data.length === 0) {
        alert('⚠️ Không có dữ liệu để xuất!');
        return;
    }
    
    const exportData = {
        exported: new Date().toISOString(),
        count: data.length,
        stats: dataStats,
        data: data
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `lstm_training_data_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addTrainingLog(`💾 Đã xuất ${data.length} mẫu dữ liệu ra file JSON`);
}

// ===== NHẬP DỮ LIỆU TỪ FILE JSON =====
function importTrainingData(fileInput) {
    return new Promise((resolve, reject) => {
        const file = fileInput.files[0];
        if (!file) {
            reject(new Error('Không có file được chọn'));
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                
                if (!json.data || !Array.isArray(json.data)) {
                    throw new Error('Định dạng file không hợp lệ');
                }
                
                addTrainingLog(`📥 Đã nhập ${json.data.length} mẫu từ file`);
                cachedTrainingData = json.data;
                dataStats = json.stats || calculateDataStats(json.data);
                
                resolve(json.data);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Lỗi khi đọc file'));
        reader.readAsText(file);
    });
}

// ===== LẤY DỮ LIỆU CHO HUẤN LUYỆN (CẢI TIẾN) =====
async function collectTrainingData(options = {}) {
    const {
        useCache = true,
        limitCount = DATA_CONFIG.defaultSamples,
        startDate = null,
        endDate = null,
        lastNDays = null
    } = options;
    
    // Sử dụng cache nếu có và được phép
    if (useCache && cachedTrainingData && cachedTrainingData.length > 0) {
        addTrainingLog(`♻️ Sử dụng dữ liệu đã cache (${cachedTrainingData.length} mẫu)`);
        return cachedTrainingData;
    }
    
    // Lấy dữ liệu theo yêu cầu
    let data;
    
    if (startDate && endDate) {
        // Lấy theo khoảng thời gian
        data = await fetchDataByTimeRange(startDate, endDate);
    } else if (lastNDays) {
        // Lấy N ngày gần nhất
        data = await fetchLastNDays(lastNDays);
    } else {
        // Lấy số lượng mẫu mới nhất
        data = await fetchFirebaseData(limitCount);
    }
    
    return data;
}

// ===== VISUALIZE DỮ LIỆU TRƯỚC KHI TRAIN =====
function visualizeTrainingData(data) {
    if (!data || data.length === 0) return;
    
    addTrainingLog('📊 Hiển thị dữ liệu huấn luyện...');
    
    // Tạo biểu đồ xem trước dữ liệu
    const previewCanvas = document.getElementById('dataPreviewChart');
    if (!previewCanvas) return;
    
    const labels = data.map((d, i) => {
        if (i % Math.ceil(data.length / 20) === 0) {
            return new Date(d.timestamp).toLocaleString('vi-VN', { 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        return '';
    });
    
    new Chart(previewCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Nhiệt độ (°C)',
                    data: data.map(d => d.temp),
                    borderColor: '#f87171',
                    backgroundColor: 'rgba(248,113,113,0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Độ ẩm (%)',
                    data: data.map(d => d.hum),
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52,211,153,0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Khói (PPM)',
                    data: data.map(d => d.smoke),
                    borderColor: '#a78bfa',
                    backgroundColor: 'rgba(167,139,250,0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#94a3b8' } },
                title: {
                    display: true,
                    text: `Dữ liệu huấn luyện (${data.length} mẫu)`,
                    color: '#fff'
                }
            },
            scales: {
                x: { 
                    grid: { color: 'rgba(255,255,255,0.05)' }, 
                    ticks: { color: '#94a3b8' } 
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// ===== LÀM SẠCH DỮ LIỆU =====
function cleanData(data, options = {}) {
    const {
        removeOutliers = true,
        fillMissing = true,
        smoothing = false
    } = options;
    
    let cleaned = [...data];
    let removedCount = 0;
    
    // Loại bỏ outliers
    if (removeOutliers) {
        const stats = calculateDataStats(cleaned);
        
        cleaned = cleaned.filter(d => {
            const tempZ = Math.abs((d.temp - stats.temp.avg) / stats.temp.std);
            const humZ = Math.abs((d.hum - stats.hum.avg) / stats.hum.std);
            const smokeZ = Math.abs((d.smoke - stats.smoke.avg) / stats.smoke.std);
            
            // Loại bỏ nếu z-score > 3 (quá xa giá trị trung bình)
            if (tempZ > 3 || humZ > 3 || smokeZ > 3) {
                removedCount++;
                return false;
            }
            return true;
        });
        
        if (removedCount > 0) {
            addTrainingLog(`🧹 Đã loại bỏ ${removedCount} outliers`);
        }
    }
    
    // Smoothing (trung bình động)
    if (smoothing && cleaned.length > 5) {
        const windowSize = 3;
        const smoothed = [];
        
        for (let i = 0; i < cleaned.length; i++) {
            if (i < windowSize - 1) {
                smoothed.push(cleaned[i]);
            } else {
                const window = cleaned.slice(i - windowSize + 1, i + 1);
                smoothed.push({
                    temp: window.reduce((sum, d) => sum + d.temp, 0) / windowSize,
                    hum: window.reduce((sum, d) => sum + d.hum, 0) / windowSize,
                    smoke: window.reduce((sum, d) => sum + d.smoke, 0) / windowSize,
                    timestamp: cleaned[i].timestamp,
                    key: cleaned[i].key
                });
            }
        }
        
        cleaned = smoothed;
        addTrainingLog(`✨ Đã làm mượt dữ liệu (window size: ${windowSize})`);
    }
    
    return cleaned;
}

// ===== XÓA CACHE =====
function clearDataCache() {
    cachedTrainingData = null;
    dataStats = null;
    addTrainingLog('🗑️ Đã xóa cache dữ liệu');
}

// ===== KIỂM TRA CHẤT LƯỢNG DỮ LIỆU =====
function checkDataQuality(data) {
    if (!data || data.length === 0) {
        return { score: 0, issues: ['Không có dữ liệu'] };
    }
    
    const issues = [];
    let score = 100;
    
    // Kiểm tra số lượng
    if (data.length < DATA_CONFIG.minSamples) {
        issues.push(`Quá ít dữ liệu (cần ít nhất ${DATA_CONFIG.minSamples})`);
        score -= 30;
    }
    
    // Kiểm tra khoảng trống
    let gaps = 0;
    for (let i = 1; i < data.length; i++) {
        const timeDiff = data[i].timestamp - data[i-1].timestamp;
        if (timeDiff > 5 * 60 * 1000) { // Gap > 5 phút
            gaps++;
        }
    }
    
    if (gaps > data.length * 0.1) {
        issues.push(`Có ${gaps} khoảng trống lớn trong dữ liệu`);
        score -= 20;
    }
    
    // Kiểm tra độ biến động
    const stats = calculateDataStats(data);
    if (stats.temp.std < 0.5) {
        issues.push('Nhiệt độ ít biến động (có thể không đủ pattern)');
        score -= 15;
    }
    
    if (stats.hum.std < 1) {
        issues.push('Độ ẩm ít biến động');
        score -= 10;
    }
    
    return { score: Math.max(0, score), issues };
}

console.log('💾 Firebase Data Manager đã được tải!');

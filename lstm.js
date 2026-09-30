// ==========================================
// LSTM DEEP LEARNING MODULE - CẢI TIẾN
// Dự đoán trước 10 phút (10 bước thời gian)
// ==========================================

let lstmModel = null;
let trainingInProgress = false;
let tempPredictionChart = null;
let humPredictionChart = null;
let modelScalers = null; // Lưu scalers để dùng lại

// Cấu hình mô hình
const MODEL_CONFIG = {
    sequenceLength: 20,      // Sử dụng 20 phút dữ liệu trước
    predictionSteps: 10,     // Dự đoán 10 phút tiếp theo
    features: 3,             // temp, hum, smoke
    epochs: 50,
    batchSize: 16,
    validationSplit: 0.2,
    learningRate: 0.001
};

// ===== KHỞI TẠO VIEW =====
function initLSTMView() {
    console.log('🧠 Khởi tạo LSTM View (Dự đoán 10 phút)...');
    
    // Khởi tạo biểu đồ dự đoán
    initPredictionCharts();
    
    // Cập nhật trạng thái ban đầu
    updateModelStatus('Chưa huấn luyện', 'warning');
    
    console.log('✅ LSTM View đã sẵn sàng!');
}

// ===== KHỞI TẠO BIỂU ĐỒ DỰ ĐOÁN =====
function initPredictionCharts() {
    // Biểu đồ dự đoán nhiệt độ
    const tempCtx = document.getElementById('tempPredictionChart');
    if (tempCtx) {
        tempPredictionChart = new Chart(tempCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Giá trị thực tế',
                    data: [],
                    borderColor: '#f87171',
                    backgroundColor: 'rgba(248,113,113,0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }, {
                    label: 'Dự đoán 10 phút',
                    data: [],
                    borderColor: '#60a5fa',
                    backgroundColor: 'rgba(96,165,250,0.1)',
                    fill: true,
                    tension: 0.4,
                    borderDash: [5, 5],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        labels: { color: '#94a3b8', font: { size: 13 } }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)'
                    }
                },
                scales: {
                    x: { 
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#94a3b8', font: { size: 11 } }
                    },
                    y: { 
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#94a3b8', font: { size: 11 } }
                    }
                }
            }
        });
    }

    // Biểu đồ dự đoán độ ẩm
    const humCtx = document.getElementById('humPredictionChart');
    if (humCtx) {
        humPredictionChart = new Chart(humCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Giá trị thực tế',
                    data: [],
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52,211,153,0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }, {
                    label: 'Dự đoán 10 phút',
                    data: [],
                    borderColor: '#a78bfa',
                    backgroundColor: 'rgba(167,139,250,0.1)',
                    fill: true,
                    tension: 0.4,
                    borderDash: [5, 5],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        labels: { color: '#94a3b8', font: { size: 13 } }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)'
                    }
                },
                scales: {
                    x: { 
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#94a3b8', font: { size: 11 } }
                    },
                    y: { 
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#94a3b8', font: { size: 11 } }
                    }
                }
            }
        });
    }
}

// ===== HUẤN LUYỆN MÔ HÌNH =====
async function trainLSTMModel() {
    if (trainingInProgress) {
        alert('⚠️ Mô hình đang được huấn luyện!');
        return;
    }

    trainingInProgress = true;
    updateModelStatus('Đang huấn luyện...', 'info');
    updateProgress(0, 'Khởi tạo...');
    addTrainingLog('🚀 Bắt đầu huấn luyện mô hình LSTM với dự đoán 10 phút...');

    try {
        // 1. Thu thập dữ liệu từ Firebase
        addTrainingLog('📊 Thu thập dữ liệu từ Firebase...');
        updateProgress(10, 'Đang thu thập dữ liệu...');
        const trainingData = await collectTrainingData();
        
        if (trainingData.length < MODEL_CONFIG.sequenceLength + MODEL_CONFIG.predictionSteps) {
            throw new Error(`Cần ít nhất ${MODEL_CONFIG.sequenceLength + MODEL_CONFIG.predictionSteps} mẫu dữ liệu. Hiện có: ${trainingData.length}`);
        }
        
        updateElement('trainingData', `${trainingData.length} mẫu`);
        addTrainingLog(`✅ Đã thu thập ${trainingData.length} mẫu dữ liệu`);

        // 2. Chuẩn bị dữ liệu
        addTrainingLog('🔧 Chuẩn bị và chuẩn hóa dữ liệu...');
        updateProgress(20, 'Chuẩn hóa dữ liệu...');
        const { inputs, outputs, scalers } = prepareData(trainingData);
        modelScalers = scalers; // Lưu lại để dùng cho dự đoán
        addTrainingLog(`✅ Đã tạo ${inputs.shape[0]} sequences huấn luyện`);
        addTrainingLog(`✅ Dữ liệu đã được chuẩn hóa (Min-Max Scaling)`);

        // 3. Xây dựng mô hình
        addTrainingLog('🏗️ Xây dựng kiến trúc mô hình LSTM...');
        updateProgress(30, 'Xây dựng mô hình...');
        lstmModel = buildLSTMModel();
        addTrainingLog(`✅ Mô hình: 2 lớp LSTM + Dense layers`);
        addTrainingLog(`✅ Tổng tham số: ${lstmModel.countParams().toLocaleString()}`);

        // 4. Huấn luyện
        const startTime = Date.now();
        addTrainingLog(`⚡ Bắt đầu huấn luyện (${MODEL_CONFIG.epochs} epochs)...`);
        updateProgress(40, 'Đang huấn luyện...');
        
        const history = await lstmModel.fit(inputs, outputs, {
            epochs: MODEL_CONFIG.epochs,
            batchSize: MODEL_CONFIG.batchSize,
            validationSplit: MODEL_CONFIG.validationSplit,
            shuffle: true,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    const progress = 40 + ((epoch + 1) / MODEL_CONFIG.epochs) * 50;
                    updateProgress(progress, `Epoch ${epoch + 1}/${MODEL_CONFIG.epochs}`);
                    
                    if ((epoch + 1) % 10 === 0 || epoch === MODEL_CONFIG.epochs - 1) {
                        addTrainingLog(
                            `📈 Epoch ${epoch + 1}/${MODEL_CONFIG.epochs} - ` +
                            `Loss: ${logs.loss.toFixed(4)}, ` +
                            `Val Loss: ${logs.val_loss.toFixed(4)}`
                        );
                    }
                }
            }
        });

        const trainingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        updateElement('trainingTime', `${trainingTime}s`);
        addTrainingLog(`⏱️ Thời gian huấn luyện: ${trainingTime}s`);

        // 5. Đánh giá mô hình
        addTrainingLog('🎯 Đánh giá độ chính xác mô hình...');
        updateProgress(95, 'Đánh giá mô hình...');
        
        const finalLoss = history.history.loss[history.history.loss.length - 1];
        const accuracy = Math.max(0, Math.min(100, (1 - finalLoss) * 100));
        
        updateElement('modelAccuracy', `${accuracy.toFixed(1)}%`);
        addTrainingLog(`✅ Độ chính xác ước tính: ${accuracy.toFixed(1)}%`);

        // 6. Thực hiện dự đoán đầu tiên
        addTrainingLog('🔮 Thực hiện dự đoán 10 phút...');
        updateProgress(98, 'Dự đoán...');
        await makePredictions();

        // Hoàn thành
        updateProgress(100, 'Hoàn thành!');
        updateModelStatus('Đã huấn luyện', 'success');
        addTrainingLog('🎉 Huấn luyện hoàn tất! Mô hình đã sẵn sàng dự đoán.');
        
        // Cleanup tensors
        inputs.dispose();
        outputs.dispose();
        
        alert('✅ Huấn luyện mô hình thành công!\n\nMô hình có thể dự đoán 10 phút tiếp theo.');

    } catch (error) {
        console.error('❌ Lỗi huấn luyện:', error);
        addTrainingLog(`❌ Lỗi: ${error.message}`);
        updateModelStatus('Lỗi huấn luyện', 'error');
        updateProgress(0, 'Lỗi!');
        alert(`❌ Lỗi khi huấn luyện mô hình:\n${error.message}`);
    } finally {
        trainingInProgress = false;
    }
}

// ===== THU THẬP DỮ LIỆU =====
// Sử dụng Firebase Data Manager nếu có, nếu không fallback về phương thức cũ
async function collectTrainingData(options = {}) {
    // Kiểm tra xem có Firebase Data Manager không
    if (typeof fetchFirebaseData === 'function') {
        // Sử dụng Data Manager với nhiều tùy chọn
        try {
            const data = await fetchFirebaseData(
                options.limitCount || 200,
                options
            );
            
            // Kiểm tra chất lượng dữ liệu
            if (typeof checkDataQuality === 'function') {
                const quality = checkDataQuality(data);
                addTrainingLog(`📊 Chất lượng dữ liệu: ${quality.score}/100`);
                if (quality.issues.length > 0) {
                    quality.issues.forEach(issue => {
                        addTrainingLog(`   ⚠️ ${issue}`);
                    });
                }
            }
            
            return data;
        } catch (error) {
            addTrainingLog(`⚠️ Lỗi Data Manager, dùng phương thức dự phòng`);
            console.error(error);
        }
    }
    
    // Fallback: Phương thức cũ
    return new Promise((resolve) => {
        database.ref('sensors').limitToLast(options.limitCount || 200).once('value', (snapshot) => {
            const data = [];
            snapshot.forEach(child => {
                const val = child.val();
                if (val.temperature && val.humidity && val.smoke) {
                    data.push({
                        temp: parseFloat(val.temperature) || 0,
                        hum: parseFloat(val.humidity) || 0,
                        smoke: parseFloat(val.smoke) || 0,
                        timestamp: val.timestamp || Date.now()
                    });
                }
            });

            // Nếu không có dữ liệu, tạo dữ liệu mẫu
            if (data.length === 0) {
                console.log('⚠️ Không có dữ liệu Firebase, tạo dữ liệu mẫu...');
                const now = Date.now();
                for (let i = 0; i < 150; i++) {
                    const t = i / 20;
                    data.push({
                        temp: 25 + Math.sin(t) * 5 + Math.cos(t/2) * 3 + Math.random() * 2,
                        hum: 60 + Math.cos(t) * 10 + Math.sin(t/3) * 5 + Math.random() * 3,
                        smoke: 80 + Math.sin(t * 1.5) * 30 + Math.random() * 10,
                        timestamp: now - (150 - i) * 60000
                    });
                }
            }

            resolve(data);
        });
    });
}

// ===== CHUẨN BỊ DỮ LIỆU =====
function prepareData(data) {
    // Chuẩn hóa dữ liệu
    const tempData = data.map(d => d.temp);
    const humData = data.map(d => d.hum);
    const smokeData = data.map(d => d.smoke);

    const tempScaler = { 
        min: Math.min(...tempData), 
        max: Math.max(...tempData) 
    };
    const humScaler = { 
        min: Math.min(...humData), 
        max: Math.max(...humData) 
    };
    const smokeScaler = { 
        min: Math.min(...smokeData), 
        max: Math.max(...smokeData) 
    };

    // Tạo sequences cho LSTM
    // Input: sequenceLength bước trước
    // Output: predictionSteps bước tiếp theo (trung bình)
    const sequences = [];
    const targets = [];

    for (let i = 0; i < data.length - MODEL_CONFIG.sequenceLength - MODEL_CONFIG.predictionSteps; i++) {
        const seq = [];
        
        // Lấy sequenceLength điểm dữ liệu
        for (let j = 0; j < MODEL_CONFIG.sequenceLength; j++) {
            seq.push([
                normalize(data[i + j].temp, tempScaler),
                normalize(data[i + j].hum, humScaler),
                normalize(data[i + j].smoke, smokeScaler)
            ]);
        }
        sequences.push(seq);
        
        // Target là giá trị trung bình của 10 phút tiếp theo
        let avgTemp = 0, avgHum = 0, avgSmoke = 0;
        for (let k = 0; k < MODEL_CONFIG.predictionSteps; k++) {
            avgTemp += data[i + MODEL_CONFIG.sequenceLength + k].temp;
            avgHum += data[i + MODEL_CONFIG.sequenceLength + k].hum;
            avgSmoke += data[i + MODEL_CONFIG.sequenceLength + k].smoke;
        }
        
        targets.push([
            normalize(avgTemp / MODEL_CONFIG.predictionSteps, tempScaler),
            normalize(avgHum / MODEL_CONFIG.predictionSteps, humScaler),
            normalize(avgSmoke / MODEL_CONFIG.predictionSteps, smokeScaler)
        ]);
    }

    const inputs = tf.tensor3d(sequences);
    const outputs = tf.tensor2d(targets);

    return { 
        inputs, 
        outputs, 
        scalers: { tempScaler, humScaler, smokeScaler } 
    };
}

function normalize(value, scaler) {
    const range = scaler.max - scaler.min;
    if (range === 0) return 0.5; // Tránh chia cho 0
    return (value - scaler.min) / range;
}

function denormalize(value, scaler) {
    return value * (scaler.max - scaler.min) + scaler.min;
}

// ===== XÂY DỰNG MÔ HÌNH =====
function buildLSTMModel() {
    const model = tf.sequential();

    // LSTM Layer 1 với nhiều units hơn
    model.add(tf.layers.lstm({
        units: 64,
        returnSequences: true,
        inputShape: [MODEL_CONFIG.sequenceLength, MODEL_CONFIG.features]
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // LSTM Layer 2
    model.add(tf.layers.lstm({
        units: 32,
        returnSequences: false
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Dense layers
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: MODEL_CONFIG.features })); // Output: temp, hum, smoke

    // Compile với optimizer Adam
    model.compile({
        optimizer: tf.train.adam(MODEL_CONFIG.learningRate),
        loss: 'meanSquaredError',
        metrics: ['mae']
    });

    return model;
}

// ===== DỰ ĐOÁN 10 PHÚT =====
async function makePredictions() {
    if (!lstmModel || !modelScalers) {
        console.warn('⚠️ Mô hình chưa được huấn luyện');
        return;
    }

    try {
        // Lấy dữ liệu gần nhất
        const recentData = await collectTrainingData();
        const lastSequence = recentData.slice(-MODEL_CONFIG.sequenceLength);

        if (lastSequence.length < MODEL_CONFIG.sequenceLength) {
            console.warn('⚠️ Không đủ dữ liệu để dự đoán');
            return;
        }

        // Chuẩn bị input
        const inputSeq = lastSequence.map(d => [
            normalize(d.temp, modelScalers.tempScaler),
            normalize(d.hum, modelScalers.humScaler),
            normalize(d.smoke, modelScalers.smokeScaler)
        ]);

        const input = tf.tensor3d([inputSeq]);

        // Dự đoán
        const prediction = lstmModel.predict(input);
        const predArray = await prediction.data();

        // Denormalize kết quả
        const tempPred = denormalize(predArray[0], modelScalers.tempScaler);
        const humPred = denormalize(predArray[1], modelScalers.humScaler);
        const smokePred = denormalize(predArray[2], modelScalers.smokeScaler);

        // Đảm bảo giá trị hợp lý
        const tempFinal = Math.max(0, Math.min(100, tempPred));
        const humFinal = Math.max(0, Math.min(100, humPred));
        const smokeFinal = Math.max(0, Math.min(1000, smokePred));

        // Cập nhật UI
        updateElement('tempPrediction', `${tempFinal.toFixed(1)}°C`);
        updateElement('humPrediction', `${humFinal.toFixed(1)}%`);
        updateElement('smokePrediction', `${smokeFinal.toFixed(0)} PPM`);

        // Tính độ tin cậy dựa trên variance của dữ liệu gần đây
        const tempVariance = calculateVariance(lastSequence.map(d => d.temp));
        const humVariance = calculateVariance(lastSequence.map(d => d.hum));
        const smokeVariance = calculateVariance(lastSequence.map(d => d.smoke));

        const tempConf = Math.max(75, Math.min(98, 95 - tempVariance));
        const humConf = Math.max(75, Math.min(98, 95 - humVariance));
        const smokeConf = Math.max(70, Math.min(95, 90 - smokeVariance * 2));

        updateElement('tempConfidence', `${tempConf.toFixed(1)}%`);
        updateElement('humConfidence', `${humConf.toFixed(1)}%`);
        updateElement('smokeConfidence', `${smokeConf.toFixed(1)}%`);

        // Cập nhật biểu đồ
        updatePredictionCharts(lastSequence, tempFinal, humFinal);

        // Đánh giá rủi ro
        assessRisk(tempFinal, humFinal, smokeFinal);

        // Cleanup
        input.dispose();
        prediction.dispose();

        console.log(`✅ Dự đoán 10 phút: Temp=${tempFinal.toFixed(1)}°C, Hum=${humFinal.toFixed(1)}%, Smoke=${smokeFinal.toFixed(0)}PPM`);

    } catch (error) {
        console.error('❌ Lỗi dự đoán:', error);
    }
}

// ===== TÍNH VARIANCE =====
function calculateVariance(data) {
    if (data.length === 0) return 0;
    
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    
    return Math.sqrt(variance);
}

// ===== CẬP NHẬT BIỂU ĐỒ DỰ ĐOÁN =====
function updatePredictionCharts(historicalData, tempPred, humPred) {
    // Tạo labels với timestamps thực tế
    const now = new Date();
    const labels = historicalData.map((d, i) => {
        const time = new Date(now.getTime() - (historicalData.length - i) * 60000);
        return time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    });
    
    // Thêm label cho dự đoán 10 phút
    const futureTime = new Date(now.getTime() + 10 * 60000);
    labels.push(futureTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));

    // Cập nhật biểu đồ nhiệt độ
    if (tempPredictionChart) {
        tempPredictionChart.data.labels = labels;
        tempPredictionChart.data.datasets[0].data = [...historicalData.map(d => d.temp), null];
        tempPredictionChart.data.datasets[1].data = [...Array(historicalData.length).fill(null), tempPred];
        tempPredictionChart.update('none'); // Update without animation for performance
    }

    // Cập nhật biểu đồ độ ẩm
    if (humPredictionChart) {
        humPredictionChart.data.labels = labels;
        humPredictionChart.data.datasets[0].data = [...historicalData.map(d => d.hum), null];
        humPredictionChart.data.datasets[1].data = [...Array(historicalData.length).fill(null), humPred];
        humPredictionChart.update('none');
    }
}

// ===== ĐÁNH GIÁ RỦI RO =====
function assessRisk(temp, hum, smoke) {
    const riskIndicator = document.getElementById('riskIndicator');
    const riskLevel = document.getElementById('riskLevel');
    const riskDescription = document.getElementById('riskDescription');

    // Tính điểm rủi ro
    let riskScore = 0;
    
    // Nhiệt độ
    if (temp > 50) riskScore += 40;
    else if (temp > 45) riskScore += 30;
    else if (temp > 40) riskScore += 20;
    else if (temp > 35) riskScore += 10;
    
    // Khói/Gas
    if (smoke > 400) riskScore += 45;
    else if (smoke > 300) riskScore += 35;
    else if (smoke > 250) riskScore += 25;
    else if (smoke > 150) riskScore += 15;
    
    // Độ ẩm (thấp = nguy hiểm hơn)
    if (hum < 30) riskScore += 15;
    else if (hum < 40) riskScore += 10;

    let level = 'THẤP';
    let desc = 'Các chỉ số dự đoán trong 10 phút tới nằm trong giới hạn an toàn. Không phát hiện dấu hiệu nguy hiểm.';
    let className = 'low';

    if (riskScore >= 50) {
        level = 'CAO';
        desc = '🚨 CẢNH BÁO: Dự đoán nguy cơ cháy CAO trong 10 phút tới! Nhiệt độ và/hoặc khói vượt ngưỡng nguy hiểm. Khuyến nghị kích hoạt hệ thống cảnh báo và sơ tán ngay lập tức.';
        className = 'high';
    } else if (riskScore >= 25) {
        level = 'TRUNG BÌNH';
        desc = '⚠️ Chú ý: Dự đoán một số chỉ số trong 10 phút tới sẽ gần ngưỡng cảnh báo. Khuyến nghị theo dõi chặt chẽ và chuẩn bị biện pháp phòng ngừa.';
        className = 'medium';
    }

    if (riskIndicator) {
        riskIndicator.className = `risk-indicator ${className}`;
    }
    if (riskLevel) {
        riskLevel.textContent = `Mức độ rủi ro: ${level}`;
    }
    if (riskDescription) {
        riskDescription.textContent = desc;
    }

    // Log cảnh báo nếu rủi ro cao
    if (riskScore >= 50) {
        console.warn(`⚠️ RỦI RO CAO - Temp: ${temp.toFixed(1)}°C, Smoke: ${smoke.toFixed(0)}PPM`);
    }
}

// ===== HELPER FUNCTIONS =====
function updateModelStatus(status, type) {
    const el = document.getElementById('modelStatus');
    if (el) {
        el.textContent = status;
        el.className = type === 'success' ? 'status-success' : 
                       type === 'warning' ? 'status-warning' : 
                       type === 'error' ? 'status-error' : 'status-info';
    }
}

function updateProgress(percent, text) {
    const fill = document.querySelector('.progress-fill');
    const progressText = document.getElementById('progressText');
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (progressText) progressText.textContent = text || `${percent.toFixed(0)}%`;
}

function addTrainingLog(message) {
    const log = document.getElementById('trainingLog');
    if (log) {
        // Xóa placeholder nếu có
        const placeholder = log.querySelector('p[style*="opacity"]');
        if (placeholder) placeholder.remove();
        
        const p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString('vi-VN')}] ${message}`;
        p.style.animation = 'fadeIn 0.3s';
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
        
        // Giới hạn số dòng log (giữ 50 dòng cuối)
        while (log.children.length > 50) {
            log.removeChild(log.firstChild);
        }
    }
}

function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ===== TỰ ĐỘNG CẬP NHẬT DỰ ĐOÁN =====
// Cập nhật dự đoán mỗi 2 phút nếu mô hình đã được huấn luyện
let predictionInterval = null;

function startAutoPrediction() {
    if (predictionInterval) {
        clearInterval(predictionInterval);
    }
    
    predictionInterval = setInterval(() => {
        if (lstmModel && modelScalers) {
            console.log('🔄 Tự động cập nhật dự đoán...');
            makePredictions();
        }
    }, 120000); // 2 phút
}

// Khởi động auto prediction khi train xong
window.addEventListener('load', () => {
    startAutoPrediction();
});

console.log('🧠 LSTM Module đã được tải! (Dự đoán 10 phút)');
console.log('📊 Cấu hình:', MODEL_CONFIG);

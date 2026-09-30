# 🚀 Hướng dẫn Setup Hệ thống IoT PCCC với MQTT + LSTM

## 📦 Danh sách Files

Bạn cần các files sau:

### 1. HTML & CSS
- `index.html` - Giao diện chính (đã tích hợp MQTT + LSTM)
- `style.css` - Stylesheet chính
- `lstm-styles.css` - CSS bổ sung cho LSTM (tùy chọn)

### 2. JavaScript Core
- `app-mqtt.js` - MQTT client và dashboard
- `firebase-data-manager.js` - Quản lý dữ liệu Firebase
- `lstm.js` - Mô hình LSTM dự đoán 10 phút
- `integration-scripts.js` - Tích hợp tất cả modules

### 3. Optional Files
- `README_LSTM.md` - Tài liệu LSTM
- `INTEGRATION_GUIDE.md` - Hướng dẫn tích hợp
- `lstm-test.js` - Testing module

## 🔧 Cấu trúc thư mục

```
project/
├── index.html
├── style.css
├── lstm-styles.css (optional)
├── app-mqtt.js
├── firebase-data-manager.js
├── lstm.js
├── integration-scripts.js
└── docs/
    ├── README_LSTM.md
    └── INTEGRATION_GUIDE.md
```

## ⚙️ Setup từng bước

### Bước 1: Cấu hình Firebase

Thêm config Firebase vào file `app-mqtt.js`:

```javascript
// Firebase Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
```

### Bước 2: Cấu hình MQTT Broker

Trong `app-mqtt.js`, cấu hình MQTT:

```javascript
const MQTT_CONFIG = {
    broker: 'broker.hivemq.com',  // Hoặc broker của bạn
    port: 8000,                    // WebSocket port
    clientId: 'fire_iot_' + Date.now(),
    topics: {
        sensors: 'esp32/sensors',
        control: 'esp32/control/#'
    }
};
```

### Bước 3: Cấu trúc dữ liệu Firebase

Đảm bảo dữ liệu trong Firebase có cấu trúc:

```
your-database/
└── sensors/
    ├── -NfK1234567890/
    │   ├── temperature: 25.5
    │   ├── humidity: 60
    │   ├── smoke: 100
    │   └── timestamp: 1704384000000
    ├── -NfK1234567891/
    │   ├── temperature: 26.0
    │   ├── humidity: 62
    │   ├── smoke: 95
    │   └── timestamp: 1704384060000
    ...
```

### Bước 4: Khởi động hệ thống

1. **Mở index.html** trong trình duyệt
2. Hệ thống sẽ tự động kết nối MQTT
3. Dữ liệu real-time sẽ hiển thị trên dashboard

## 📊 Sử dụng tính năng LSTM

### 1. Tải dữ liệu

Có 3 cách tải dữ liệu:

**Cách 1: Số lượng mẫu**
- Mở tab "🧠 Học sâu"
- Chọn số mẫu (50-1000) trong dropdown
- Nhấn "Tải dữ liệu"

**Cách 2: Khoảng thời gian**
- Chọn ngày bắt đầu và kết thúc
- Nhấn "Lọc dữ liệu"

**Cách 3: N ngày gần nhất**
- Chọn số ngày (1-30)
- Nhấn "Tải dữ liệu"

### 2. Kiểm tra chất lượng

Sau khi tải, xem:
- **Thống kê**: Tổng mẫu, khoảng thời gian, giá trị TB
- **Chất lượng**: Điểm từ 0-100
  - ≥80: Tốt
  - 60-79: Khá
  - <60: Cần cải thiện
- **Biểu đồ**: Visualize dữ liệu

### 3. Làm sạch dữ liệu (tùy chọn)

- ✅ Loại bỏ outliers: Xóa giá trị ngoại lai
- ✅ Làm mượt: Trung bình động

Nhấn "Áp dụng" để làm sạch

### 4. Huấn luyện mô hình

1. Nhấn nút "Huấn luyện mô hình"
2. Theo dõi tiến trình:
   - Progress bar
   - Log chi tiết
   - Thời gian training
3. Chờ hoàn thành (30-60 giây)

### 5. Xem dự đoán

Sau khi train xong:
- **Dự đoán 10 phút**: Nhiệt độ, độ ẩm, khói
- **Độ tin cậy**: % accuracy
- **Biểu đồ**: So sánh thực tế vs dự đoán
- **Đánh giá rủi ro**: Thấp/Trung bình/Cao

### 6. Tự động cập nhật

Mô hình tự động dự đoán lại mỗi 2 phút

## 🔍 MQTT Monitor

### Sử dụng

1. Mở tab "📡 MQTT Monitor"
2. Xem real-time:
   - Log gói tin (RECEIVED/SENT)
   - Topic và payload
   - Thống kê (tổng, trung bình)

### Xóa log

Nhấn "Xóa log" để reset

## 💾 Import/Export dữ liệu

### Export

1. Tải dữ liệu vào hệ thống
2. Nhấn "Export JSON"
3. File tải về: `lstm_training_data_[timestamp].json`

### Import

1. Nhấn "Import JSON"
2. Chọn file đã export trước đó
3. Dữ liệu sẽ được load vào hệ thống

## 📈 Workflow khuyến nghị

```
1. Kết nối MQTT & Firebase
   ↓
2. Thu thập dữ liệu real-time (Dashboard)
   ↓
3. Chuyển sang tab "Học sâu"
   ↓
4. Tải dữ liệu (200-500 mẫu)
   ↓
5. Kiểm tra chất lượng
   ↓
6. Làm sạch nếu cần
   ↓
7. Huấn luyện mô hình
   ↓
8. Xem dự đoán 10 phút
   ↓
9. Export dữ liệu để backup
```

## 🐛 Troubleshooting

### Lỗi: MQTT không kết nối

**Nguyên nhân**: Broker sai hoặc port không đúng

**Giải pháp**:
```javascript
// Kiểm tra config trong app-mqtt.js
const MQTT_CONFIG = {
    broker: 'broker.hivemq.com',  // Public broker
    port: 8000,                    // WebSocket port
    ...
};
```

### Lỗi: Firebase không có dữ liệu

**Nguyên nhân**: 
- Config sai
- Database rules
- Đường dẫn sai

**Giải pháp**:
```javascript
// 1. Kiểm tra config
console.log(firebase.app().options);

// 2. Kiểm tra rules (Firebase Console)
{
  "rules": {
    "sensors": {
      ".read": true,
      ".write": true
    }
  }
}

// 3. Kiểm tra đường dẫn
// Trong firebase-data-manager.js
const DATA_CONFIG = {
    dataPath: 'sensors',  // Đảm bảo đúng
    ...
};
```

### Lỗi: TensorFlow.js không load

**Nguyên nhân**: CDN chậm hoặc bị chặn

**Giải pháp**:
```html
<!-- Thử CDN khác -->
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js"></script>

<!-- Hoặc -->
<script src="https://unpkg.com/@tensorflow/tfjs@4.11.0/dist/tf.min.js"></script>
```

### Lỗi: "Không đủ dữ liệu"

**Nguyên nhân**: Cần ít nhất 30 mẫu (sequenceLength + predictionSteps)

**Giải pháp**:
- Tải thêm dữ liệu
- Hoặc giảm `sequenceLength` trong `lstm.js`:
```javascript
const MODEL_CONFIG = {
    sequenceLength: 15,      // Giảm từ 20
    predictionSteps: 10,
    ...
};
```

### Lỗi: Training quá lâu

**Nguyên nhân**: Quá nhiều dữ liệu hoặc epochs cao

**Giải pháp**:
```javascript
// Trong lstm.js
const MODEL_CONFIG = {
    epochs: 30,              // Giảm từ 50
    batchSize: 32,           // Tăng từ 16
    ...
};
```

### Lỗi: Độ chính xác thấp

**Nguyên nhân**: 
- Dữ liệu kém chất lượng
- Quá ít dữ liệu
- Pattern không rõ ràng

**Giải pháp**:
1. Kiểm tra điểm chất lượng (≥60)
2. Làm sạch dữ liệu
3. Tải thêm dữ liệu (500+ mẫu)
4. Tăng epochs (70-100)

## 🎯 Tips & Tricks

### 1. Tối ưu hiệu suất

```javascript
// Giảm tần suất cập nhật dự đoán
// Trong lstm.js, cuối file
setInterval(() => {
    if (lstmModel && modelScalers) {
        makePredictions();
    }
}, 300000); // 5 phút thay vì 2 phút
```

### 2. Backup định kỳ

```javascript
// Tự động export mỗi ngày
setInterval(() => {
    if (cachedTrainingData && cachedTrainingData.length > 0) {
        exportTrainingData();
    }
}, 24 * 60 * 60 * 1000);  // 24 giờ
```

### 3. Cảnh báo rủi ro cao

```javascript
// Trong lstm.js, hàm assessRisk
if (riskScore >= 50) {
    // Gửi notification
    if (typeof showNotification === 'function') {
        showNotification('⚠️ Cảnh báo rủi ro CAO!', 'error');
    }
    
    // Kích hoạt cảnh báo
    if (typeof toggleDevice === 'function') {
        toggleDevice('speaker');
        toggleDevice('led');
    }
}
```

## 📱 Browser Support

Hỗ trợ các trình duyệt:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+

## 🔒 Security Notes

1. **Firebase Rules**: Giới hạn read/write
2. **MQTT Credentials**: Sử dụng username/password nếu có
3. **HTTPS**: Deploy với SSL certificate
4. **API Keys**: Không commit vào Git

## 📚 Tài liệu tham khảo

- [TensorFlow.js Guide](https://www.tensorflow.org/js/guide)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [Paho MQTT](https://www.eclipse.org/paho/)
- [Chart.js Documentation](https://www.chartjs.org/docs/)

## 🆘 Support

Nếu gặp vấn đề:

1. Kiểm tra Console (F12)
2. Xem Log trong "Tiến trình huấn luyện"
3. Kiểm tra MQTT Monitor
4. Review file INTEGRATION_GUIDE.md

## 📝 Changelog

### v2.0 (Current)
- ✅ Tích hợp LSTM dự đoán 10 phút
- ✅ Firebase Data Manager
- ✅ MQTT Monitor
- ✅ Data quality check
- ✅ Import/Export JSON

### v1.0 (Previous)
- Basic MQTT dashboard
- Real-time monitoring
- Device control

---

**Chúc bạn setup thành công! 🎉**

Nếu cần hỗ trợ, xem thêm:
- `README_LSTM.md` - Chi tiết về LSTM
- `INTEGRATION_GUIDE.md` - API reference

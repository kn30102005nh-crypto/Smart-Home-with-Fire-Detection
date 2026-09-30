# 📚 Hướng dẫn tích hợp Firebase Data Manager

## 🎯 Tổng quan
Hệ thống quản lý dữ liệu Firebase giúp bạn:
- ✅ Lấy dữ liệu cũ từ Firebase theo nhiều cách
- ✅ Lọc dữ liệu theo khoảng thời gian
- ✅ Import/Export dữ liệu dạng JSON
- ✅ Làm sạch và kiểm tra chất lượng dữ liệu
- ✅ Visualize dữ liệu trước khi train

## 📁 Files cần thiết

1. **firebase-data-manager.js** - Module quản lý dữ liệu
2. **data-management-ui.html** - Giao diện người dùng
3. **lstm.js** (đã cập nhật) - Tích hợp với data manager

## 🚀 Cách tích hợp

### Bước 1: Thêm script vào index.html

Thêm script **TRƯỚC** `lstm.js`:

```html
<!-- Firebase scripts -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js"></script>

<!-- Data Manager - THÊM DÒNG NÀY -->
<script src="firebase-data-manager.js"></script>

<!-- LSTM và App -->
<script src="app.js"></script>
<script src="lstm.js"></script>
```

### Bước 2: Thêm UI vào LSTM View

Mở file `data-management-ui.html` và copy toàn bộ nội dung.

Trong file `index.html`, tìm phần `<div id="lstm-view">` và thêm UI ngay sau phần header:

```html
<div id="lstm-view" class="view-section" style="display: none;">
    <div class="glass-panel">
        <div class="panel-header">
            <div>
                <h2>🧠 Học sâu - LSTM</h2>
                <p class="subtitle">Long Short-Term Memory cho dự đoán 10 phút</p>
            </div>
            <button class="btn-primary" onclick="trainLSTMModel()">
                <i class="fas fa-play"></i> Huấn luyện mô hình
            </button>
        </div>

        <!-- THÊM DATA MANAGEMENT UI VÀO ĐÂY -->
        [Paste nội dung từ data-management-ui.html]
        
        <div class="lstm-container">
            <!-- Phần LSTM hiện tại -->
            ...
        </div>
    </div>
</div>
```

### Bước 3: Kiểm tra cấu trúc Firebase

Đảm bảo dữ liệu trong Firebase có cấu trúc:

```javascript
sensors/
  ├─ key1/
  │   ├─ temperature: 25.5
  │   ├─ humidity: 60
  │   ├─ smoke: 100
  │   └─ timestamp: 1704384000000
  ├─ key2/
  │   ├─ temperature: 26.0
  │   ├─ humidity: 62
  │   ├─ smoke: 95
  │   └─ timestamp: 1704384060000
  ...
```

## 💡 Cách sử dụng

### 1. Tải dữ liệu từ Firebase

#### Cách 1: Tải N mẫu gần nhất
```javascript
// Tự động - chọn trong dropdown
// Hoặc dùng code:
const data = await fetchFirebaseData(200); // 200 mẫu gần nhất
```

#### Cách 2: Tải theo khoảng thời gian
```javascript
const data = await fetchDataByTimeRange(
    '2024-01-01T00:00',  // Từ ngày
    '2024-01-07T23:59'   // Đến ngày
);
```

#### Cách 3: Tải N ngày gần nhất
```javascript
const data = await fetchLastNDays(7);  // 7 ngày gần nhất
```

### 2. Kiểm tra chất lượng dữ liệu

```javascript
const quality = checkDataQuality(data);
console.log(`Chất lượng: ${quality.score}/100`);
console.log('Vấn đề:', quality.issues);
```

### 3. Làm sạch dữ liệu

```javascript
const cleaned = cleanData(data, {
    removeOutliers: true,   // Loại bỏ outliers
    smoothing: true         // Làm mượt dữ liệu
});
```

### 4. Export/Import dữ liệu

```javascript
// Export ra file JSON
exportTrainingData(data);

// Import từ file JSON
const imported = await importTrainingData(fileInput);
```

### 5. Huấn luyện với dữ liệu tùy chỉnh

```javascript
// Huấn luyện với số lượng mẫu cụ thể
await trainLSTMModel();  // Sẽ tự động dùng dữ liệu đã tải

// Hoặc cấu hình chi tiết:
const data = await collectTrainingData({
    limitCount: 500,
    useCache: false
});
```

## 📊 Các tính năng trong UI

### 1. Card "Tải từ Firebase"
- Chọn số lượng mẫu muốn tải (50-1000)
- Nút "Tải dữ liệu"

### 2. Card "Theo khoảng thời gian"
- Chọn ngày bắt đầu và kết thúc
- Lọc dữ liệu chính xác

### 3. Card "N ngày gần nhất"
- Nhanh chóng lấy dữ liệu gần đây
- Chọn 1, 3, 7, 14 hoặc 30 ngày

### 4. Card "Import/Export"
- Import dữ liệu từ file JSON
- Export để backup hoặc chia sẻ

### 5. Panel "Thống kê dữ liệu"
Hiển thị:
- Tổng số mẫu
- Khoảng thời gian
- Giá trị trung bình temp/hum/smoke
- Điểm chất lượng (0-100)

### 6. Biểu đồ "Xem trước dữ liệu"
- Hiển thị 3 đường: nhiệt độ, độ ẩm, khói
- Giúp kiểm tra pattern và xu hướng

### 7. Panel "Làm sạch dữ liệu"
- Loại bỏ outliers (giá trị ngoại lai)
- Làm mượt dữ liệu (moving average)

## 🔧 Cấu hình nâng cao

### Thay đổi đường dẫn Firebase

Trong `firebase-data-manager.js`:

```javascript
const DATA_CONFIG = {
    dataPath: 'sensors',  // Thay đổi nếu cần
    // ...
};
```

### Tùy chỉnh validation

```javascript
function isValidSensorData(data) {
    // Thêm logic validation của bạn
    if (temp < 0 || temp > 60) return false;
    // ...
}
```

### Thêm trường dữ liệu mới

```javascript
const DATA_CONFIG = {
    requiredFields: [
        'temperature', 
        'humidity', 
        'smoke', 
        'timestamp',
        'location'  // Thêm trường mới
    ]
};
```

## ⚠️ Lưu ý quan trọng

### 1. Thứ tự load script
```html
<!-- Đúng -->
firebase scripts → firebase-data-manager.js → lstm.js

<!-- Sai -->
lstm.js → firebase-data-manager.js  ❌
```

### 2. Cache dữ liệu
- Dữ liệu được cache sau khi tải lần đầu
- Dùng `clearDataCache()` để xóa cache
- Train lại sẽ dùng cache trừ khi `useCache: false`

### 3. Giới hạn Firebase
- Firebase có giới hạn số lượng request
- Đừng tải quá nhiều dữ liệu cùng lúc
- Khuyến nghị: 200-500 mẫu cho training

### 4. Chất lượng dữ liệu
- Score < 50: Dữ liệu kém, cần cải thiện
- Score 50-80: Chấp nhận được
- Score > 80: Tốt cho training

## 🐛 Xử lý lỗi thường gặp

### Lỗi: "Không có dữ liệu trong Firebase"
```javascript
// Giải pháp: Kiểm tra đường dẫn
console.log(DATA_CONFIG.dataPath);  // 'sensors'

// Kiểm tra Firebase Rules
// Đảm bảo có quyền đọc
```

### Lỗi: "Dữ liệu không hợp lệ"
```javascript
// Kiểm tra format dữ liệu
// Phải có: temperature, humidity, smoke, timestamp
```

### Lỗi: "Quá ít dữ liệu để train"
```javascript
// Cần ít nhất 30 mẫu (MODEL_CONFIG.sequenceLength + predictionSteps)
// Giải pháp: Tải thêm dữ liệu hoặc giảm sequenceLength
```

## 📈 Workflow khuyến nghị

```
1. Mở LSTM View
   ↓
2. Chọn "Tải từ Firebase" hoặc "N ngày gần nhất"
   ↓
3. Kiểm tra thống kê và biểu đồ
   ↓
4. Nếu cần, áp dụng "Làm sạch dữ liệu"
   ↓
5. Nhấn "Huấn luyện mô hình"
   ↓
6. Chờ training hoàn tất
   ↓
7. Xem kết quả dự đoán 10 phút
```

## 💾 Backup dữ liệu

Nên export dữ liệu định kỳ:

```javascript
// Tự động export mỗi tuần
setInterval(() => {
    if (cachedTrainingData) {
        exportTrainingData();
    }
}, 7 * 24 * 60 * 60 * 1000);  // 7 ngày
```

## 🔗 API Reference

### fetchFirebaseData(limitCount, options)
```javascript
await fetchFirebaseData(200, {
    startTime: 1704384000000,
    endTime: 1704470400000
});
```

### checkDataQuality(data)
```javascript
const quality = checkDataQuality(data);
// Returns: { score: 85, issues: [] }
```

### cleanData(data, options)
```javascript
const cleaned = cleanData(data, {
    removeOutliers: true,
    smoothing: true
});
```

### exportTrainingData(data)
```javascript
exportTrainingData(data);
// Downloads: lstm_training_data_[timestamp].json
```

### calculateDataStats(data)
```javascript
const stats = calculateDataStats(data);
// Returns: { temp: {...}, hum: {...}, smoke: {...} }
```

## 🎓 Ví dụ hoàn chỉnh

```javascript
// 1. Tải dữ liệu 7 ngày gần nhất
const data = await fetchLastNDays(7);

// 2. Kiểm tra chất lượng
const quality = checkDataQuality(data);
if (quality.score < 60) {
    console.warn('Dữ liệu chất lượng thấp!');
}

// 3. Làm sạch
const cleaned = cleanData(data, {
    removeOutliers: true,
    smoothing: true
});

// 4. Export để backup
exportTrainingData(cleaned);

// 5. Train model
await trainLSTMModel();

// 6. Kiểm tra kết quả
console.log('Model đã sẵn sàng dự đoán 10 phút!');
```

## 📞 Support

Nếu gặp vấn đề:
1. Kiểm tra Console (F12) để xem lỗi
2. Xác nhận Firebase đã connect
3. Kiểm tra format dữ liệu
4. Xem log trong "Tiến trình huấn luyện"

---

**Chúc bạn training thành công! 🚀**

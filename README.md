# FIRE-AIOT  
Hệ thống phát hiện và cảnh báo cháy thông minh ứng dụng IoT và Trí tuệ nhân tạo

## 1. Giới thiệu
FIRE-AIOT là hệ thống phát hiện và cảnh báo cháy sớm ứng dụng Internet of Things (IoT) kết hợp Trí tuệ nhân tạo (AI), nhằm giám sát môi trường, phát hiện nguy cơ cháy và đưa ra cảnh báo theo thời gian thực.

Hệ thống phù hợp triển khai trong:
- Nhà ở và căn hộ
- Ký túc xá, trường học
- Nhà xưởng, kho bãi
- Công trình công cộng

---

## 2. Mục tiêu
- Thu thập dữ liệu từ các cảm biến môi trường (khói, nhiệt độ, khí gas)
- Truyền dữ liệu theo thời gian thực thông qua giao thức MQTT
- Phân tích dữ liệu bằng mô hình AI (LSTM)
- Cảnh báo sớm nguy cơ cháy thông qua giao diện web
- Lưu trữ và quản lý dữ liệu trên nền tảng Firebase

---

## 3. Kiến trúc hệ thống
Cảm biến
↓
ESP32 / Arduino
↓ (MQTT)
NodeJS Backend
↓
Firebase
↓
Giao diện Web và mô hình AI

## 4. Công nghệ sử dụng

### 4.1. Phần cứng
- ESP32 / Arduino
- Cảm biến khói
- Cảm biến nhiệt độ
- Cảm biến khí gas

### 4.2. Phần mềm
- Node.js
- MQTT
- Firebase (Realtime Database / Firestore)
- HTML, CSS, JavaScript
- Mô hình AI LSTM
- Arduino IDE

## 5. Cấu trúc thư mục

## 4. Công nghệ sử dụng

### 4.1. Phần cứng
- ESP32 / Arduino
- Cảm biến khói
- Cảm biến nhiệt độ
- Cảm biến khí gas

### 4.2. Phần mềm
- Node.js
- MQTT
- Firebase (Realtime Database / Firestore)
- HTML, CSS, JavaScript
- Mô hình AI LSTM
- Arduino IDE

## 5. Cấu trúc thư mục
FIRE-AIOT/
├── Arduino/ Code cho Arduino / ESP32
├── HCMUTEFireIoT/ Module chính của hệ thống
├── app.js Backend NodeJS
├── app-mqtt.js Xử lý giao tiếp MQTT
├── firebase-data-manager.js Kết nối Firebase
├── lstm.js Mô hình AI LSTM
├── index.html Giao diện chính
├── login.html Trang đăng nhập
├── style.css Giao diện CSS
├── enhanced-styles.css
├── integration-scripts.js
├── SETUP_GUIDE.md Hướng dẫn cài đặt
├── INTEGRATION_GUIDE.md Hướng dẫn tích hợp
└── README.md Tài liệu mô tả dự án

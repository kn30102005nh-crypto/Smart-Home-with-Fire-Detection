#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <DHT.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ==========================================
// CẤU HÌNH WIFI
// ==========================================
#define WIFI_SSID "Ngan"
#define WIFI_PASSWORD "Ngan132013"

// ==========================================
// CẤU HÌNH FIREBASE
// ==========================================
#define API_KEY "AIzaSyAvb_FDoSynGx59kNCGG59zMZgihk60ULk"
#define DATABASE_URL "https://tt-iot-427aa-default-rtdb.asia-southeast1.firebasedatabase.app/"
#define USER_EMAIL "anhng@gmail.com"
#define USER_PASSWORD "123456"

// ==========================================
// CẤU HÌNH CHÂN CẢM BIẾN
// ==========================================
#define DHT_PIN 23           // DHT22 nối với GPIO 23
#define MQ2_PIN 35           // MQ-2 (Analog) nối với GPIO 35
#define DHT_TYPE DHT22       // Loại cảm biến DHT22

// ==========================================
// CẤU HÌNH CHÂN THIẾT BỊ ĐẦU RA
// ==========================================
#define LED_PIN 2            // LED cảnh báo (GPIO 2 - LED built-in)
#define BUZZER_PIN 4         // Còi báo động (GPIO 4)
#define RELAY_PIN 5          // Relay điều khiển (GPIO 5)

// ==========================================
// KHỞI TẠO ĐỐI TƯỢNG
// ==========================================
DHT dht(DHT_PIN, DHT_TYPE);
FirebaseData fbdo;
FirebaseData fbdoStream;  // Riêng cho stream
FirebaseAuth auth;
FirebaseConfig config;

// ==========================================
// BIẾN TOÀN CỤC
// ==========================================
unsigned long sendDataPrevMillis = 0;
bool signupOK = false;

// Trạng thái thiết bị
bool ledState = false;
bool speakerState = false;
bool sosState = false;

// ==========================================
// CALLBACK KHI CÓ THAY ĐỔI TỪ FIREBASE
// ==========================================
void streamCallback(FirebaseStream data) {
  String path = data.dataPath();
  
  if (path == "/led" || path == "/") {
    if (data.dataTypeEnum() == firebase_rtdb_data_type_boolean || data.dataTypeEnum() == firebase_rtdb_data_type_json) {
      bool newState = false;
      
      if (path == "/led") {
        newState = data.boolData();
      } else if (path == "/" && data.dataTypeEnum() == firebase_rtdb_data_type_json) {
        FirebaseJson *json = data.jsonObjectPtr();
        FirebaseJsonData result;
        json->get(result, "led");
        if (result.success) {
          newState = result.boolValue;
        }
      }
      
      if (newState != ledState) {
        ledState = newState;
        digitalWrite(LED_PIN, ledState ? HIGH : LOW);
        Serial.printf("💡 LED: %s (Stream)\n", ledState ? "BẬT" : "TẮT");
      }
    }
  }
  
  if (path == "/speaker" || path == "/") {
    if (data.dataTypeEnum() == firebase_rtdb_data_type_boolean || data.dataTypeEnum() == firebase_rtdb_data_type_json) {
      bool newState = false;
      
      if (path == "/speaker") {
        newState = data.boolData();
      } else if (path == "/" && data.dataTypeEnum() == firebase_rtdb_data_type_json) {
        FirebaseJson *json = data.jsonObjectPtr();
        FirebaseJsonData result;
        json->get(result, "speaker");
        if (result.success) {
          newState = result.boolValue;
        }
      }
      
      if (newState != speakerState) {
        speakerState = newState;
        digitalWrite(BUZZER_PIN, speakerState ? HIGH : LOW);
        Serial.printf("🔊 Còi: %s (Stream)\n", speakerState ? "BẬT" : "TẮT");
      }
    }
  }
  
  if (path == "/sos" || path == "/") {
    if (data.dataTypeEnum() == firebase_rtdb_data_type_boolean || data.dataTypeEnum() == firebase_rtdb_data_type_json) {
      bool newState = false;
      
      if (path == "/sos") {
        newState = data.boolData();
      } else if (path == "/" && data.dataTypeEnum() == firebase_rtdb_data_type_json) {
        FirebaseJson *json = data.jsonObjectPtr();
        FirebaseJsonData result;
        json->get(result, "sos");
        if (result.success) {
          newState = result.boolValue;
        }
      }
      
      if (newState != sosState) {
        sosState = newState;
        digitalWrite(RELAY_PIN, sosState ? HIGH : LOW);
        Serial.printf("🆘 SOS: %s (Stream)\n", sosState ? "BẬT" : "TẮT");
      }
    }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("⚠️ Stream timeout, đang kết nối lại...");
  }
}

// ==========================================
// HÀM SETUP - CHẠY 1 LẦN KHI KHỞI ĐỘNG
// ==========================================
void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("=============================");
  Serial.println("🔥 HCMUTE IoT Fire Alarm");
  Serial.println("=============================");
  
  // Cấu hình chân đầu ra
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  
  // Tắt tất cả thiết bị ban đầu
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(RELAY_PIN, LOW);
  
  // Khởi động cảm biến DHT22
  dht.begin();
  Serial.println("✅ DHT22 đã khởi động");
  
  // Kết nối WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("⏳ Đang kết nối WiFi");
  
  int wifiTimeout = 0;
  while (WiFi.status() != WL_CONNECTED && wifiTimeout < 20) {
    Serial.print(".");
    delay(500);
    wifiTimeout++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("✅ WiFi đã kết nối! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("❌ Không thể kết nối WiFi!");
    return;
  }

  // ==========================================
  // CẤU HÌNH FIREBASE
  // ==========================================
  
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  
  Serial.println("⏳ Đang kết nối Firebase Authentication...");
  
  if (Firebase.signUp(&config, &auth, USER_EMAIL, USER_PASSWORD)) {
    Serial.println("✅ Đăng ký user thành công!");
    signupOK = true;
  } else {
    String errorMsg = config.signer.signupError.message.c_str();
    Serial.printf("⚠️ Signup response: %s\n", errorMsg.c_str());
    
    if (errorMsg.indexOf("EMAIL_EXISTS") >= 0 || 
        errorMsg.indexOf("CREDENTIAL_TOO_OLD") >= 0 ||
        errorMsg.indexOf("email") >= 0) {
      Serial.println("ℹ️ User đã tồn tại, sẽ sử dụng credentials hiện tại");
      signupOK = true;
    } else {
      Serial.println("❌ Lỗi không xác định, nhưng vẫn tiếp tục...");
      signupOK = true;
    }
  }
  
  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  // Đợi Firebase ready
  Serial.println("⏳ Đang chờ Firebase sẵn sàng...");
  int fbTimeout = 0;
  while (!Firebase.ready() && fbTimeout < 30) {
    Serial.print(".");
    delay(500);
    fbTimeout++;
  }
  
  if (Firebase.ready()) {
    Serial.println();
    Serial.println("✅ Firebase đã sẵn sàng!");
    
    // ==========================================
    // BẬT FIREBASE STREAM - REALTIME UPDATES
    // ==========================================
    Serial.println("⏳ Đang thiết lập Stream cho devices...");
    
    if (!Firebase.RTDB.beginStream(&fbdoStream, "/devices")) {
      Serial.printf("❌ Stream failed: %s\n", fbdoStream.errorReason().c_str());
    } else {
      Serial.println("✅ Stream đã kích hoạt!");
      Firebase.RTDB.setStreamCallback(&fbdoStream, streamCallback, streamTimeoutCallback);
    }
    
    Serial.println("=============================");
  } else {
    Serial.println();
    Serial.println("❌ Firebase không thể kết nối!");
  }
}

// ==========================================
// HÀM LOOP - CHẠY LIÊN TỤC
// ==========================================
void loop() {
  if (!Firebase.ready()) {
    Serial.println("⚠️ Firebase chưa sẵn sàng, đang chờ...");
    delay(1000);
    return;
  }
  
  // GỬI DỮ LIỆU CẢM BIẾN (mỗi 2 giây)
  if (millis() - sendDataPrevMillis > 2000 || sendDataPrevMillis == 0) {
    sendDataPrevMillis = millis();
    
    // ĐỌC CẢM BIẾN
    float temp = dht.readTemperature();      
    float hum = dht.readHumidity();          
    int smokeRaw = analogRead(MQ2_PIN);      
    int smoke = map(smokeRaw, 0, 4095, 0, 1000);
    bool flame = (smoke > 400);              
    
    if (isnan(temp) || isnan(hum)) {
      Serial.println("❌ Lỗi đọc DHT22!");
      temp = 0;
      hum = 0;
    }
    
    // In ra Serial Monitor
    Serial.println("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    Serial.printf("🌡️  Nhiệt độ: %.1f °C\n", temp);
    Serial.printf("💧 Độ ẩm: %.1f %%\n", hum);
    Serial.printf("💨 Khói: %d PPM (raw: %d)\n", smoke, smokeRaw);
    Serial.printf("🔥 Lửa: %s\n", flame ? "PHÁT HIỆN ⚠️" : "Không");
    
    // GỬI DỮ LIỆU LÊN FIREBASE
    Firebase.RTDB.setFloat(&fbdo, "sensors/temperature", temp);
    Firebase.RTDB.setFloat(&fbdo, "sensors/humidity", hum);
    Firebase.RTDB.setInt(&fbdo, "sensors/smoke", smoke);
    Firebase.RTDB.setBool(&fbdo, "sensors/flame", flame);
    
    // TỰ ĐỘNG CẢNH BÁO KHI NGUY HIỂM
    if (temp > 50 || smoke > 300 || flame) {
      Serial.println("\n🚨 ═══ CẢNH BÁO NGUY HIỂM ═══ 🚨");
      digitalWrite(LED_PIN, HIGH);
      digitalWrite(BUZZER_PIN, HIGH);
      
      Firebase.RTDB.setBool(&fbdo, "devices/led", true);
      Firebase.RTDB.setBool(&fbdo, "devices/speaker", true);
    }
  }
  
  // Stream sẽ tự động nhận updates, không cần polling
}
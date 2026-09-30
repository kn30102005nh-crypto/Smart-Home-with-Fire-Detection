// ==========================================
// DEBUG ESP32 - IN ĐẦY ĐỦ THÔNG TIN
// ==========================================

#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ==========================================
// WIFI CONFIG
// ==========================================
#define WIFI_SSID "Ngan"
#define WIFI_PASSWORD "Ngan132013"

// ==========================================
// MQTT CONFIG
// ==========================================
#define MQTT_SERVER "broker.hivemq.com"
#define MQTT_PORT 1883
#define MQTT_CLIENT_ID "HCMUTE_ESP32_Fire_Alarm"

#define TOPIC_SENSORS "hcmute/fire/sensors"
#define TOPIC_DEVICES "hcmute/fire/devices"
#define TOPIC_LED "hcmute/fire/devices/led"
#define TOPIC_SPEAKER "hcmute/fire/devices/speaker"
#define TOPIC_SOS "hcmute/fire/devices/sos"
#define TOPIC_STATUS "hcmute/fire/status"

// ==========================================
// SENSOR PINS
// ==========================================
#define DHT_PIN 23
#define MQ2_PIN 35
#define FLAME_PIN 34
#define DHT_TYPE DHT22

// ==========================================
// OUTPUT PINS
// ==========================================
#define LED_PIN 2
#define BUZZER_PIN 4
#define RELAY_PIN 5

// ==========================================
// THRESHOLDS
// ==========================================
#define TEMP_THRESHOLD 50
#define SMOKE_THRESHOLD 300

// ==========================================
// OBJECTS
// ==========================================
DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ==========================================
// GLOBAL VARIABLES
// ==========================================
unsigned long lastSensorUpdate = 0;
unsigned long lastMqttReconnect = 0;
unsigned long lastDebugPrint = 0;
const long sensorInterval = 5000;
const long mqttReconnectInterval = 5000;
const long debugInterval = 3000;  // In debug mỗi 3s

bool ledState = false;
bool speakerState = false;
bool sosState = false;
bool previousDangerState = false;

// ==========================================
// IN THÔNG TIN NETWORK CHI TIẾT
// ==========================================
void printNetworkInfo() {
  Serial.println("\n╔════════════════════════════════════════════╗");
  Serial.println("║     THÔNG TIN NETWORK ESP32                ║");
  Serial.println("╠════════════════════════════════════════════╣");
  
  // WiFi Info
  Serial.print("║ 📶 SSID: ");
  Serial.println(WiFi.SSID());
  
  Serial.print("║ 🔒 IP Address: ");
  Serial.println(WiFi.localIP());  // ⭐⭐⭐ ĐÂY LÀ IP BẠN CẦN! ⭐⭐⭐
  
  Serial.print("║ 🌐 Gateway: ");
  Serial.println(WiFi.gatewayIP());
  
  Serial.print("║ 🎭 Subnet Mask: ");
  Serial.println(WiFi.subnetMask());
  
  Serial.print("║ 📡 MAC Address: ");
  Serial.println(WiFi.macAddress());
  
  Serial.print("║ 📶 Signal Strength (RSSI): ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  
  if (WiFi.RSSI() > -50) {
    Serial.println("║    → ✅ Tín hiệu XUẤT SẮC");
  } else if (WiFi.RSSI() > -60) {
    Serial.println("║    → ✅ Tín hiệu TỐT");
  } else if (WiFi.RSSI() > -70) {
    Serial.println("║    → ⚠️  Tín hiệu TRUNG BÌNH");
  } else {
    Serial.println("║    → ❌ Tín hiệu YẾU - có thể mất gói tin!");
  }
  
  // DNS Check
  Serial.println("║                                            ║");
  Serial.print("║ 🔍 DNS Lookup: ");
  Serial.print(MQTT_SERVER);
  IPAddress brokerIP;
  if (WiFi.hostByName(MQTT_SERVER, brokerIP)) {
    Serial.print(" → ");
    Serial.println(brokerIP);
  } else {
    Serial.println(" → ❌ FAILED!");
  }
  
  Serial.println("╚════════════════════════════════════════════╝\n");
  
  // ⭐⭐⭐ IN TO VÀ RÕ RÀNG IP CỦA ESP32 ⭐⭐⭐
  Serial.println("\n");
  Serial.println("╔═══════════════════════════════════════════════════╗");
  Serial.println("║          ⭐⭐⭐ LƯU Ý QUAN TRỌNG ⭐⭐⭐             ║");
  Serial.println("╠═══════════════════════════════════════════════════╣");
  Serial.print("║  IP CỦA ESP32 LÀ: ");
  Serial.print(WiFi.localIP());
  Serial.println("                   ║");
  Serial.println("║                                                   ║");
  Serial.println("║  → Dùng IP này để filter trong Wireshark:        ║");
  Serial.print("║    ip.addr == ");
  Serial.print(WiFi.localIP());
  Serial.println("                      ║");
  Serial.println("╚═══════════════════════════════════════════════════╝\n");
}

// ==========================================
// IN TRẠNG THÁI HỆ THỐNG
// ==========================================
void printSystemStatus() {
  Serial.println("\n┌─────────────────── STATUS ───────────────────┐");
  Serial.printf("│ ⏰ Uptime: %lu giây\n", millis() / 1000);
  Serial.printf("│ 📶 WiFi: %s (RSSI: %d dBm)\n", 
                WiFi.status() == WL_CONNECTED ? "✅ Connected" : "❌ Disconnected",
                WiFi.RSSI());
  Serial.printf("│ 📡 MQTT: %s\n", 
                mqttClient.connected() ? "✅ Connected" : "❌ Disconnected");
  
  if (mqttClient.connected()) {
    Serial.printf("│    └─ Broker IP: ");
    Serial.println(espClient.remoteIP());
  }
  
  Serial.printf("│ 💡 LED: %s\n", ledState ? "ON" : "OFF");
  Serial.printf("│ 🔊 Speaker: %s\n", speakerState ? "ON" : "OFF");
  Serial.printf("│ 🆘 SOS: %s\n", sosState ? "ON" : "OFF");
  Serial.println("└──────────────────────────────────────────────┘\n");
}

// ==========================================
// MQTT CALLBACK
// ==========================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("📨 Nhận MQTT từ broker: ");
  Serial.println(espClient.remoteIP());
  Serial.print("   Topic: ");
  Serial.println(topic);
  Serial.print("   Payload: ");
  
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  Serial.println();
  
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.print("❌ JSON Parse Error: ");
    Serial.println(error.c_str());
    return;
  }
  
  if (String(topic) == TOPIC_LED || String(topic) == TOPIC_DEVICES) {
    if (doc.containsKey("led")) {
      ledState = doc["led"];
      digitalWrite(LED_PIN, ledState ? HIGH : LOW);
      Serial.printf("💡 LED: %s\n", ledState ? "ON" : "OFF");
    }
  }
  
  if (String(topic) == TOPIC_SPEAKER || String(topic) == TOPIC_DEVICES) {
    if (doc.containsKey("speaker")) {
      speakerState = doc["speaker"];
      digitalWrite(BUZZER_PIN, speakerState ? LOW : HIGH);
      Serial.printf("🔊 Speaker: %s\n", speakerState ? "ON" : "OFF");
    }
  }
  
  if (String(topic) == TOPIC_SOS || String(topic) == TOPIC_DEVICES) {
    if (doc.containsKey("sos")) {
      sosState = doc["sos"];
      digitalWrite(RELAY_PIN, sosState ? HIGH : LOW);
      Serial.printf("🆘 SOS: %s\n", sosState ? "ON" : "OFF");
    }
  }
}

// ==========================================
// CONNECT TO MQTT
// ==========================================
void connectMQTT() {
  if (millis() - lastMqttReconnect < mqttReconnectInterval) {
    return;
  }
  lastMqttReconnect = millis();
  
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║      ĐANG KẾT NỐI MQTT BROKER          ║");
  Serial.println("╠════════════════════════════════════════╣");
  Serial.print("║ Server: ");
  Serial.println(MQTT_SERVER);
  Serial.print("║ Port: ");
  Serial.println(MQTT_PORT);
  
  mqttClient.disconnect();
  delay(100);
  
  int attempts = 0;
  while (!mqttClient.connected() && attempts < 3) {
    attempts++;
    Serial.printf("║ 🔄 Lần thử %d/3...\n", attempts);
    
    String clientId = MQTT_CLIENT_ID;
    clientId += "_";
    clientId += String(random(0xffff), HEX);
    
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("║ ✅ MQTT CONNECTED!");
      Serial.print("║ 📍 Broker IP: ");
      Serial.println(espClient.remoteIP());
      Serial.println("╠════════════════════════════════════════╣");
      
      // Subscribe
      bool sub1 = mqttClient.subscribe(TOPIC_DEVICES);
      bool sub2 = mqttClient.subscribe(TOPIC_LED);
      bool sub3 = mqttClient.subscribe(TOPIC_SPEAKER);
      bool sub4 = mqttClient.subscribe(TOPIC_SOS);
      
      Serial.printf("║ 📡 Subscribe Results:\n");
      Serial.printf("║    Devices: %s\n", sub1 ? "✅" : "❌");
      Serial.printf("║    LED: %s\n", sub2 ? "✅" : "❌");
      Serial.printf("║    Speaker: %s\n", sub3 ? "✅" : "❌");
      Serial.printf("║    SOS: %s\n", sub4 ? "✅" : "❌");
      Serial.println("╚════════════════════════════════════════╝\n");
      
      // Publish status
      String status = "{\"status\":\"online\",\"device\":\"ESP32_Fire_Alarm\",\"ip\":\"" + 
                      WiFi.localIP().toString() + "\"}";
      mqttClient.publish(TOPIC_STATUS, status.c_str());
      
      return;
      
    } else {
      Serial.print("║ ❌ FAILED, rc=");
      Serial.print(mqttClient.state());
      Serial.print(" → ");
      
      switch(mqttClient.state()) {
        case -4: Serial.println("TIMEOUT"); break;
        case -3: Serial.println("CONNECTION_LOST"); break;
        case -2: Serial.println("CONNECT_FAILED"); break;
        case -1: Serial.println("DISCONNECTED"); break;
        case  1: Serial.println("BAD_PROTOCOL"); break;
        case  2: Serial.println("BAD_CLIENT_ID"); break;
        case  3: Serial.println("UNAVAILABLE"); break;
        case  4: Serial.println("BAD_CREDENTIALS"); break;
        case  5: Serial.println("UNAUTHORIZED"); break;
        default: Serial.println("UNKNOWN"); break;
      }
      
      delay(2000);
    }
  }
  
  if (!mqttClient.connected()) {
    Serial.println("║ ⚠️  MQTT connection FAILED!");
    Serial.println("╚════════════════════════════════════════╝\n");
  }
}

// ==========================================
// PUBLISH SENSOR DATA
// ==========================================
void publishSensorData(float temp, float hum, int smoke, bool flame) {
  if (!mqttClient.connected()) {
    Serial.println("⚠️  Không thể publish - MQTT chưa kết nối");
    return;
  }
  
  StaticJsonDocument<256> doc;
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["smoke"] = smoke;
  doc["flame"] = flame;
  doc["timestamp"] = millis();
  
  bool isDangerous = (temp > TEMP_THRESHOLD) || (smoke > SMOKE_THRESHOLD) || flame;
  doc["dangerous"] = isDangerous;
  
  String output;
  serializeJson(doc, output);
  
  Serial.println("\n┌──────── PUBLISHING SENSOR DATA ────────┐");
  Serial.print("│ Topic: ");
  Serial.println(TOPIC_SENSORS);
  Serial.print("│ Payload: ");
  Serial.println(output);
  Serial.print("│ Size: ");
  Serial.print(output.length());
  Serial.println(" bytes");
  
  if (mqttClient.publish(TOPIC_SENSORS, output.c_str())) {
    Serial.println("│ Status: ✅ PUBLISHED!");
    Serial.println("│");
    Serial.println("│ ⭐ BẮT GÓI TIN NÀY TRONG WIRESHARK:");
    Serial.print("│    Filter: mqtt.topic == \"");
    Serial.print(TOPIC_SENSORS);
    Serial.println("\"");
    Serial.print("│    hoặc: ip.addr == ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("│ Status: ❌ PUBLISH FAILED!");
    Serial.print("│ MQTT State: ");
    Serial.println(mqttClient.state());
  }
  Serial.println("└────────────────────────────────────────┘\n");
}

// ==========================================
// PUBLISH DEVICE STATE
// ==========================================
void publishDeviceState() {
  if (!mqttClient.connected()) return;
  
  StaticJsonDocument<256> doc;
  doc["led"] = ledState;
  doc["speaker"] = speakerState;
  doc["sos"] = sosState;
  doc["timestamp"] = millis();
  
  String output;
  serializeJson(doc, output);
  
  Serial.println("📤 Publishing device state...");
  mqttClient.publish(TOPIC_DEVICES, output.c_str());
}

// ==========================================
// CHECK DANGER & AUTO CONTROL
// ==========================================
void checkDangerAndControl(float temp, int smoke, bool flameDetected) {
  bool isDangerous = (temp > TEMP_THRESHOLD) || 
                     (smoke > SMOKE_THRESHOLD) || 
                     flameDetected;
  
  if (isDangerous && !previousDangerState) {
    Serial.println("\n🚨 ╔═══════════════════════════════════╗");
    Serial.println("    PHÁT HIỆN NGUY HIỂM - BẬT CẢNH BÁO");
    Serial.println("╚═══════════════════════════════════╝ 🚨\n");
    
    ledState = true;
    speakerState = true;
    sosState = true;
    
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(RELAY_PIN, HIGH);
    
    publishDeviceState();
    previousDangerState = true;
  }
  else if (!isDangerous && previousDangerState) {
    Serial.println("\n✅ ╔═══════════════════════════════════╗");
    Serial.println("    TRẠNG THÁI AN TOÀN - TẮT THIẾT BỊ");
    Serial.println("╚═══════════════════════════════════╝ ✅\n");
    
    ledState = false;
    speakerState = false;
    sosState = false;
    
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(RELAY_PIN, LOW);
    
    publishDeviceState();
    previousDangerState = false;
  }
}

// ==========================================
// SETUP
// ==========================================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n\n");
  Serial.println("╔═══════════════════════════════════════════╗");
  Serial.println("║                                           ║");
  Serial.println("║       🔥 HCMUTE IoT Fire Alarm 🔥        ║");
  Serial.println("║          MQTT Protocol Version            ║");
  Serial.println("║                                           ║");
  Serial.println("╚═══════════════════════════════════════════╝\n");
  
  // GPIO Config
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(FLAME_PIN, INPUT);
  
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, HIGH);
  digitalWrite(RELAY_PIN, LOW);
  
  Serial.println("✅ GPIO đã cấu hình");
  
  // DHT Init
  dht.begin();
  Serial.println("✅ DHT22 đã khởi động");
  
  // WiFi Connect
  Serial.println("\n┌────────────────────────────────────┐");
  Serial.println("│      ĐANG KẾT NỐI WIFI             │");
  Serial.println("└────────────────────────────────────┘");
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("⏳ Connecting");
  
  int wifiTimeout = 0;
  while (WiFi.status() != WL_CONNECTED && wifiTimeout < 30) {
    Serial.print(".");
    delay(500);
    wifiTimeout++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" ✅ CONNECTED!\n");
    
    // ⭐ IN ĐẦY ĐỦ THÔNG TIN NETWORK
    printNetworkInfo();
    
  } else {
    Serial.println("\n❌ Không thể kết nối WiFi!");
    Serial.println("🔄 Khởi động lại ESP32...");
    delay(3000);
    ESP.restart();
    return;
  }
  
  // MQTT Setup
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(1024);
  mqttClient.setKeepAlive(60);
  mqttClient.setSocketTimeout(30);
  
  // Kết nối MQTT
  connectMQTT();
  
  Serial.println("\n╔═══════════════════════════════════════════╗");
  Serial.println("║     ✅ HỆ THỐNG SẴN SÀNG! ✅             ║");
  Serial.println("╚═══════════════════════════════════════════╝\n");
  
  delay(1000);
}

// ==========================================
// LOOP
// ==========================================
void loop() {
  // Maintain MQTT connection
  if (!mqttClient.connected()) {
    Serial.println("⚠️  MQTT disconnected, đang kết nối lại...");
    connectMQTT();
  }
  mqttClient.loop();
  
  // Print system status mỗi 3 giây
  if (millis() - lastDebugPrint > debugInterval) {
    lastDebugPrint = millis();
    printSystemStatus();
  }
  
  // Send sensor data
  if (millis() - lastSensorUpdate > sensorInterval) {
    lastSensorUpdate = millis();
    
    // Read sensors
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    int smokeRaw = analogRead(MQ2_PIN);
    int smoke = map(smokeRaw, 0, 4095, 0, 1000);
    int flameValue = digitalRead(FLAME_PIN);
    bool flameDetected = (flameValue == LOW);
    
    if (isnan(temp) || isnan(hum)) {
      Serial.println("❌ Lỗi đọc DHT22!");
      temp = 0;
      hum = 0;
    }
    
    // Print sensor values
    Serial.println("\n╔══════════ SENSOR DATA ══════════╗");
    Serial.printf("║ 🌡️  Nhiệt độ: %.1f °C", temp);
    if (temp > TEMP_THRESHOLD) Serial.print(" ⚠️");
    Serial.println();
    Serial.printf("║ 💧 Độ ẩm: %.1f %%\n", hum);
    Serial.printf("║ 💨 Khói: %d PPM (raw: %d)", smoke, smokeRaw);
    if (smoke > SMOKE_THRESHOLD) Serial.print(" ⚠️");
    Serial.println();
    Serial.printf("║ 🔥 Lửa: %s\n", flameDetected ? "PHÁT HIỆN ⚠️" : "Bình thường");
    Serial.println("╚═════════════════════════════════╝");
    
    // Publish to MQTT
    if (mqttClient.connected()) {
      publishSensorData(temp, hum, smoke, flameDetected);
    } else {
      Serial.println("⚠️  Không thể gửi - MQTT chưa kết nối");
    }
    
    // Check danger
    checkDangerAndControl(temp, smoke, flameDetected);
  }
  
  // WiFi reconnect
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  WiFi mất kết nối, đang thử kết nối lại...");
    WiFi.reconnect();
    delay(1000);
  }
  
  delay(10);
}
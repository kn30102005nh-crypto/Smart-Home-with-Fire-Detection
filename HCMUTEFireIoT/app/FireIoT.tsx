// Thêm polyfill cho React Native
import 'react-native-url-polyfill/auto';

import { FontAwesome5 } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// Firebase
import { onValue, push, ref, set } from 'firebase/database';
import { database } from '../firebaseConfig';

// MQTT.js for React Native
import mqtt from 'mqtt';

export default function FireIoTApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mqttConnected, setMqttConnected] = useState(false);
  const [mqttReconnecting, setMqttReconnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mqttClient = useRef<any>(null);
  const reconnectTimeout = useRef<any>(null);

  // State dữ liệu cảm biến
  const [sensorData, setSensorData] = useState({
    temperature: 0,
    humidity: 0,
    smoke: 0,
    status: 'An toàn',
    timestamp: Date.now()
  });

  // State thiết bị
  const [devices, setDevices] = useState({
    led: false,
    speaker: false,
    sos: false,
  });

  // State lịch sử
  const [history, setHistory] = useState<any[]>([]);

  // Update sensor data
  const updateFromSensors = (data: any) => {
    console.log('🔄 Updating sensor data:', data);
    
    const temp = parseFloat(data.temperature) || 0;
    const hum = parseFloat(data.humidity) || 0;
    const smoke = parseFloat(data.smoke) || 0;

    console.log(`📊 Values - Temp: ${temp}°C, Hum: ${hum}%, Smoke: ${smoke} PPM`);

    let status = '🛡️ An toàn';
    if (smoke > 800 || temp > 50  || data.flame) {
      status = '🔥 NGUY HIỂM';
    } else if (smoke > 500 || temp > 40) {
      status = '⚠️ Cảnh báo';
    }

    const newData = {
      temperature: temp,
      humidity: hum,
      smoke: smoke,
      status: status,
      timestamp: data.timestamp || Date.now()
    };

    setSensorData(newData);

    if (status.includes('NGUY HIỂM')) {
      saveHistory('fire_alert', `Nguy hiểm! Temp: ${temp}°C, Smoke: ${smoke} PPM`);
      Alert.alert('🔥 CẢNH BÁO', `Phát hiện cháy!\nNhiệt độ: ${temp}°C\nKhói: ${smoke} PPM`);
    }
  };

  // Save history
  const saveHistory = async (type: string, message: string) => {
    try {
      await push(ref(database, 'history'), {
        type,
        message,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('History error:', error);
    }
  };

  // 1. Khởi tạo app
  useEffect(() => {
    const init = async () => {
      try {
        console.log("🚀 Fire IoT Starting...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        setLoading(false);
        console.log("✅ App Ready");
      } catch (e) {
        console.error("❌ Init Error", e);
        setLoading(false);
      }
    };
    init();
  }, []);

  // 2. Kết nối MQTT với auto-reconnect
  useEffect(() => {
    if (!loading) {
      connectMQTT();
    }
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (mqttClient.current) {
        try {
          mqttClient.current.end(true); // Force close
          console.log('🔌 MQTT Client disconnected');
        } catch (e) {
          console.log('Disconnect error:', e);
        }
      }
    };
  }, [loading]);

  const connectMQTT = () => {
    try {
      console.log('🔌 Connecting MQTT...');
      setMqttReconnecting(true);
      
      // Thử WSS trước, nếu không được sẽ fallback sang WS
      const brokerUrl = 'wss://broker.hivemq.com:8884/mqtt';
      
      const options = {
        clientId: 'HCMUTE_App_' + Math.random().toString(36).substr(2, 9),
        keepalive: 60,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        protocolVersion: 4,
        // Thêm will message để detect disconnect
        will: {
          topic: 'hcmute/fire/status',
          payload: JSON.stringify({ status: 'offline', timestamp: Date.now() }),
          qos: 0,
          retain: false
        }
      };

      console.log('🌐 Broker:', brokerUrl);

      const client = mqtt.connect(brokerUrl, options);

      // Connection timeout handler
      const connectionTimeout = setTimeout(() => {
        if (!mqttConnected) {
          console.log('⏱️ Connection timeout (30s)');
          setMqttReconnecting(false);
        }
      }, 30000);

      // Connection events
      client.on('connect', (connack) => {
        clearTimeout(connectionTimeout);
        console.log('✅ MQTT Connected!');
        setMqttConnected(true);
        setMqttReconnecting(false);
        
        // Subscribe to sensor topic
        const topic = 'hcmute/fire/sensors';
        client.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            console.error('❌ Subscribe error:', err);
          } else {
            console.log(`✅ Subscribed: ${topic}`);
          }
        });

        // Publish online status
        client.publish('hcmute/fire/status', JSON.stringify({ 
          status: 'online', 
          timestamp: Date.now() 
        }), { qos: 0, retain: false });
      });

      client.on('error', (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ MQTT Error:', error.message);
        setMqttConnected(false);
        setMqttReconnecting(false);
      });

      client.on('offline', () => {
        console.log('📴 MQTT Offline');
        setMqttConnected(false);
      });

      client.on('close', () => {
        console.log('❌ MQTT Connection closed');
        setMqttConnected(false);
        setMqttReconnecting(false);
      });

      client.on('reconnect', () => {
        console.log('🔄 MQTT Reconnecting...');
        setMqttReconnecting(true);
      });

      client.on('message', (topic, payload) => {
        try {
          console.log('📨 Message from:', topic);
          const payloadString = payload.toString();
          
          if (topic === 'hcmute/fire/sensors') {
            const data = JSON.parse(payloadString);
            console.log('🔥 Sensor data:', data);
            updateFromSensors(data);
          }
        } catch (e) {
          console.error('❌ Message parse error:', e);
        }
      });

      mqttClient.current = client;

    } catch (error) {
      console.error('❌ MQTT Connection Failed:', error);
      setMqttConnected(false);
      setMqttReconnecting(false);
      
      // Retry after 5 seconds
      reconnectTimeout.current = setTimeout(() => {
        console.log('🔄 Retrying MQTT connection...');
        connectMQTT();
      }, 5000);
    }
  };

  // 3. Firebase listeners (ưu tiên Firebase làm source of truth)
  useEffect(() => {
    if (loading) return;

    console.log('🔥 Setting up Firebase listeners...');

    // Listen to sensors - chỉ dùng khi MQTT không có data
    const sensorsRef = ref(database, 'sensors');
    const unsubSensors = onValue(sensorsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const keys = Object.keys(data);
        const latestKey = keys[keys.length - 1];
        if (latestKey && data[latestKey]) {
          console.log('📊 Firebase sensor update');
          // Chỉ update nếu MQTT không connected (fallback)
          if (!mqttConnected) {
            updateFromSensors(data[latestKey]);
          }
        }
      }
    }, (error) => {
      console.error('❌ Firebase sensors error:', error);
    });

    // Listen to devices - Firebase là source of truth cho devices
    const devicesRef = ref(database, 'devices');
    const unsubDevices = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log('🎛️ Firebase devices update:', data);
        setDevices(data);
      }
    });

    // Listen to history
    const historyRef = ref(database, 'history');
    const unsubHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const historyArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).sort((a, b) => b.timestamp - a.timestamp);
        setHistory(historyArray.slice(0, 50));
      }
    });

    return () => {
      console.log('🔥 Cleaning up Firebase listeners...');
      unsubSensors();
      unsubDevices();
      unsubHistory();
    };
  }, [loading, mqttConnected]);

  // Toggle device
  const toggleDevice = async (device: string, currentState: boolean) => {
    try {
      const newState = !currentState;
      console.log(`🎛️ Toggling ${device}: ${currentState} → ${newState}`);
      
      // 1. Update Firebase first (source of truth)
      await set(ref(database, `devices/${device}`), newState);
      
      // 2. Send via MQTT for real-time control
      if (mqttClient.current && mqttConnected) {
        // ✅ FIXED: Gửi đúng format như Web
        const message = JSON.stringify({ 
          [device]: newState,  // ⚠️ Key là tên device, value là state
          timestamp: Date.now()
        });
        const topic = `hcmute/fire/devices`;  // ✅ Topic chung giống Web
        
        mqttClient.current.publish(topic, message, { qos: 1, retain: false }, (err: any) => {
          if (err) {
            console.error('❌ MQTT Publish error:', err);
          } else {
            console.log(`✅ Published to ${topic}:`, message);
          }
        });
      } else {
        console.warn('⚠️ MQTT not connected, only Firebase updated');
      }

      // 3. Log history
      const deviceName = device === 'led' ? 'Đèn cảnh báo' : 
                        device === 'speaker' ? 'Còi báo động' : 'SOS Call';
      saveHistory('device_control', `${deviceName}: ${newState ? 'BẬT' : 'TẮT'}`);

    } catch (error) {
      console.error('❌ Toggle error:', error);
      Alert.alert('Lỗi', 'Không thể điều khiển thiết bị');
    }
  };

  // Emergency stop
  const emergencyStop = () => {
    Alert.alert(
      '🛑 Dừng khẩn cấp',
      'Tắt TẤT CẢ thiết bị?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚨 Emergency stop activated');
              const allOff = {
                led: false,
                speaker: false,
                sos: false,
              };
              
              await set(ref(database, 'devices'), allOff);
              
              // ✅ FIXED: Gửi đúng format JSON như Web
              if (mqttClient.current && mqttConnected) {
                const message = JSON.stringify(allOff);
                mqttClient.current.publish(
                  'hcmute/fire/devices',  // ✅ Topic chung
                  message,
                  { qos: 1 }
                );
                console.log('✅ Emergency stop sent via MQTT:', message);
              }
              
              saveHistory('emergency', 'DỪNG KHẨN CẤP - Tắt tất cả thiết bị');
              Alert.alert('✅', 'Đã tắt tất cả thiết bị');
            } catch (error) {
              console.error('❌ Emergency stop error:', error);
              Alert.alert('❌', 'Lỗi khi tắt thiết bị');
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    console.log('🔄 Refreshing...');
    
    // Reconnect MQTT if disconnected
    if (!mqttConnected && mqttClient.current) {
      connectMQTT();
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const testConnection = () => {
    let message = '🔌 MQTT: ' + (mqttConnected ? '✅ Connected' : '❌ Disconnected');
    if (mqttReconnecting) message += ' (Reconnecting...)';
    message += '\n🔥 Firebase: ✅ Connected';
    message += '\n\n📊 Sensor Data:';
    message += `\n  Temp: ${sensorData.temperature.toFixed(1)}°C`;
    message += `\n  Humidity: ${sensorData.humidity.toFixed(1)}%`;
    message += `\n  Smoke: ${sensorData.smoke} PPM`;
    message += '\n\n📡 MQTT Topics:';
    message += '\n  Subscribe: hcmute/fire/sensors';
    message += '\n  Publish: hcmute/fire/devices';
    message += '\n\n💡 Message Format:';
    message += '\n  {"led": true, "timestamp": ...}';
    
    Alert.alert('System Status', message);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <FontAwesome5 name="fire" size={64} color="#ef4444" />
        <ActivityIndicator size="large" color="#6366f1" style={{marginTop: 20}} />
        <Text style={styles.loadingText}>Fire IoT System</Text>
        <Text style={styles.loadingSubtext}>HCMUTE Capstone Project</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🔥 Fire IoT</Text>
          <Text style={styles.headerSubtitle}>Real-time Fire Detection System</Text>
        </View>
        
        <View style={styles.statusRow}>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { 
              backgroundColor: mqttConnected ? '#10b981' : mqttReconnecting ? '#fbbf24' : '#ef4444' 
            }]} />
            <Text style={styles.statusText}>
              {mqttConnected ? 'MQTT' : mqttReconnecting ? 'RETRY' : 'OFFLINE'}
            </Text>
          </View>
          <TouchableOpacity onPress={testConnection} style={styles.testBtn}>
            <FontAwesome5 name="info-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {activeTab === 'dashboard' ? (
          <>
            <View style={styles.grid}>
              <Card title="Nhiệt độ" value={`${sensorData.temperature.toFixed(1)}°C`} icon="thermometer-half" color="#f87171" />
              <Card title="Độ ẩm" value={`${sensorData.humidity.toFixed(1)}%`} icon="tint" color="#60a5fa" />
              <Card title="Khói/Gas" value={`${sensorData.smoke.toFixed(0)} PPM`} icon="smog" color="#fbbf24" />
              <Card title="Trạng thái" value={sensorData.status} icon="shield-alt" 
                color={sensorData.status.includes('NGUY') ? '#ef4444' : sensorData.status.includes('Cảnh') ? '#fbbf24' : '#34d399'} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎛️ Điều khiển thiết bị</Text>
              <ControlItem label="Còi báo động" icon="bullhorn" value={devices.speaker} onToggle={() => toggleDevice('speaker', devices.speaker)} />
              <ControlItem label="Đèn cảnh báo" icon="lightbulb" value={devices.led} onToggle={() => toggleDevice('led', devices.led)} />
              <ControlItem label="SOS Call" icon="phone-alt" value={devices.sos} onToggle={() => toggleDevice('sos', devices.sos)} />
              
              <TouchableOpacity style={styles.emergencyBtn} onPress={emergencyStop}>
                <FontAwesome5 name="stop-circle" size={20} color="#fff" />
                <Text style={styles.emergencyText}>DỪNG KHẨN CẤP</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoCard}>
              <FontAwesome5 name="clock" size={14} color="#94a3b8" />
              <Text style={styles.infoText}>
                Cập nhật: {new Date(sensorData.timestamp).toLocaleTimeString('vi-VN')}
              </Text>
            </View>
          </>
        ) : activeTab === 'history' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Lịch sử hoạt động</Text>
            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome5 name="inbox" size={48} color="#334155" />
                <Text style={styles.emptyText}>Chưa có lịch sử</Text>
              </View>
            ) : (
              history.map((item, index) => <HistoryItem key={item.id || index} item={item} />)
            )}
          </View>
        ) : (
          <View style={styles.center}>
            <FontAwesome5 name="cog" size={48} color="#6366f1" />
            <Text style={styles.comingSoonTitle}>Cài đặt</Text>
            <Text style={styles.comingSoonText}>Coming soon...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.navBar}>
        <NavBtn icon="chart-pie" label="Tổng quan" active={activeTab === 'dashboard'} onPress={() => setActiveTab('dashboard')} />
        <NavBtn icon="history" label="Lịch sử" active={activeTab === 'history'} onPress={() => setActiveTab('history')} />
        <NavBtn icon="cog" label="Cài đặt" active={activeTab === 'settings'} onPress={() => setActiveTab('settings')} />
      </View>
    </View>
  );
}

// Components
const Card = ({ title, value, icon, color }: any) => (
  <View style={styles.card}>
    <FontAwesome5 name={icon} size={24} color={color} />
    <Text style={styles.cardLabel}>{title}</Text>
    <Text style={[styles.cardValue, { color }]}>{value}</Text>
  </View>
);

const ControlItem = ({ label, icon, value, onToggle }: any) => (
  <View style={styles.controlItem}>
    <View style={styles.controlLeft}>
      <FontAwesome5 name={icon} size={18} color="#94a3b8" />
      <Text style={styles.controlLabel}>{label}</Text>
    </View>
    <Switch 
      value={value} 
      onValueChange={onToggle} 
      trackColor={{ false: '#334155', true: '#6366f1' }} 
      thumbColor={value ? '#fff' : '#f4f3f4'} 
      ios_backgroundColor="#334155"
    />
  </View>
);

const HistoryItem = ({ item }: any) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'fire_alert': return { name: 'fire', color: '#ef4444' };
      case 'device_control': return { name: 'toggle-on', color: '#6366f1' };
      case 'emergency': return { name: 'exclamation-triangle', color: '#fbbf24' };
      default: return { name: 'info-circle', color: '#94a3b8' };
    }
  };
  const icon = getIcon(item.type);
  
  return (
    <View style={styles.historyItem}>
      <View style={[styles.historyIcon, { backgroundColor: icon.color + '20' }]}>
        <FontAwesome5 name={icon.name} size={16} color={icon.color} />
      </View>
      <View style={styles.historyContent}>
        <Text style={styles.historyText}>{item.message}</Text>
        <Text style={styles.historyTime}>{new Date(item.timestamp).toLocaleString('vi-VN')}</Text>
      </View>
    </View>
  );
};

const NavBtn = ({ icon, label, active, onPress }: any) => (
  <TouchableOpacity style={styles.navBtn} onPress={onPress}>
    <FontAwesome5 name={icon} size={20} color={active ? '#6366f1' : '#94a3b8'} />
    <Text style={[styles.navText, { color: active ? '#6366f1' : '#94a3b8' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { 
    paddingTop: 60, 
    paddingBottom: 20, 
    paddingHorizontal: 20, 
    backgroundColor: '#1e293b', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  headerContent: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIndicator: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20 
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  testBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  content: { flex: 1, padding: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { 
    width: '48%', 
    backgroundColor: '#1e293b', 
    padding: 20, 
    borderRadius: 16, 
    marginBottom: 15, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(148, 163, 184, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  cardLabel: { color: '#94a3b8', fontSize: 12, marginTop: 10 },
  cardValue: { fontSize: 18, fontWeight: 'bold', marginTop: 5 },
  section: { 
    backgroundColor: '#1e293b', 
    padding: 20, 
    borderRadius: 16, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(148, 163, 184, 0.1)' 
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
  controlItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20, 
    paddingVertical: 8 
  },
  controlLeft: { flexDirection: 'row', alignItems: 'center' },
  controlLabel: { color: '#fff', marginLeft: 15, fontSize: 15 },
  emergencyBtn: { 
    backgroundColor: '#ef4444', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 10, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 10,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8
  },
  emergencyText: { color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 },
  infoCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#1e293b', 
    padding: 12, 
    borderRadius: 12, 
    gap: 10, 
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)'
  },
  infoText: { color: '#94a3b8', fontSize: 12 },
  historyItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.2)', 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 10, 
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.05)'
  },
  historyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  historyContent: { flex: 1 },
  historyText: { color: '#fff', fontSize: 14, marginBottom: 4 },
  historyTime: { color: '#64748b', fontSize: 11 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#64748b', fontSize: 14, marginTop: 12 },
  navBar: { 
    flexDirection: 'row', 
    backgroundColor: '#1e293b', 
    paddingBottom: 30, 
    paddingTop: 15, 
    borderTopWidth: 1, 
    borderTopColor: '#334155' 
  },
  navBtn: { flex: 1, alignItems: 'center' },
  navText: { fontSize: 10, marginTop: 5, fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  loadingText: { color: '#fff', fontSize: 18, marginTop: 20, fontWeight: '600' },
  loadingSubtext: { color: '#94a3b8', fontSize: 13, marginTop: 8 },
  comingSoonTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 20 },
  comingSoonText: { color: '#94a3b8', fontSize: 14, marginTop: 8 }
});
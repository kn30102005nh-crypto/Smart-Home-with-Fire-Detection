// Firebase Configuration for React Native
// File: firebaseConfig.ts hoặc firebaseConfig.js
// Đặt ở thư mục gốc project

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase config - GIỐNG HỆT config web
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
const database = getDatabase(app);

// Export
export { app, database };


console.log('✅ Firebase initialized for React Native');
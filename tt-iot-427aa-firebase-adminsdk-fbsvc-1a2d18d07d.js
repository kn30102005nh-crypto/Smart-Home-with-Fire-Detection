 // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
  import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
  import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
  const analytics = getAnalytics(app);
  const auth = getAuth(app);
  const db = getFirestore(app);

  export {auth, db};
  
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDx1zmerwuXi5_jkEIKkIg8il6DTlJiemE",
    authDomain: "lightseed-online.firebaseapp.com",
    projectId: "lightseed-online",
    storageBucket: "lightseed-online.appspot.com",
    messagingSenderId: "592001211370",
    appId: "1:592001211370:web:4f6f6e3e7e4942fa087093",
    measurementId: "G-C135Y66W5G"
  };

  const app = initializeApp(firebaseConfig);
  export const db = getFirestore(app);

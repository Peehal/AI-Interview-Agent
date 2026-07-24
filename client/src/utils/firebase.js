
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "aivoiceinterview-2c40a.firebaseapp.com",
  projectId: "aivoiceinterview-2c40a",
  storageBucket: "aivoiceinterview-2c40a.firebasestorage.app",
  messagingSenderId: "874195966399",
  appId: "1:874195966399:web:ef7e256633ef12871ae90a"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider()

export {auth , provider}
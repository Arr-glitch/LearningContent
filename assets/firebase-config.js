// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBJfpytCRSfrV8JhGGGWGyCH3sa3B83j0M",
  authDomain: "english--content-book.firebaseapp.com",
  projectId: "english--content-book",
  storageBucket: "english--content-book.firebasestorage.app",
  messagingSenderId: "110614867380",
  appId: "1:110614867380:web:2335bde59c925b02b4d6e1",
  measurementId: "G-CC8DCB0ZQE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
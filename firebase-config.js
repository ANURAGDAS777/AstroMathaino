// Firebase Configuration - Using your credentials
const firebaseConfig = {
  apiKey: "AIzaSyCnW5Yha7-nsxPaoaS8IlhUToyNttKR-rM",
  authDomain: "astromathiano.firebaseapp.com",
  projectId: "astromathiano",
  storageBucket: "astromathiano.firebasestorage.app",
  messagingSenderId: "228998169217",
  appId: "1:228998169217:web:a50d3105af9e06e1740380",
  measurementId: "G-942JD73M65"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence
db.enablePersistence().catch((err) => {
  if (err.code === "failed-precondition") {
    console.log("Persistence failed - multiple tabs open");
  } else if (err.code === "unimplemented") {
    console.log("Persistence not supported in this browser");
  }
});
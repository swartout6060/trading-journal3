const firebaseConfig = {
  apiKey: "AIzaSyCQbygS4BRyJW-p7kQJhMqvbLFmNVke3XI",
  authDomain: "svj-trades.firebaseapp.com",
  projectId: "svj-trades",
  storageBucket: "svj-trades.firebasestorage.app",
  messagingSenderId: "511942129638",
  appId: "1:511942129638:web:f3b9bbed440d16cd7c8827",
  measurementId: "G-WEXNFN0FWX"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

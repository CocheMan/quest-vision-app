import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAu276zbeezkrNYze_QMvGNK_OfYKzwkL0",
    authDomain: "quest-72bc4.firebaseapp.com",
    projectId: "quest-72bc4",
    storageBucket: "quest-72bc4.firebasestorage.app",
    messagingSenderId: "1048368638411",
    appId: "1:1048368638411:web:1dd85fddaa5b20a0e46e4e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

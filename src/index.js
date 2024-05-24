import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firebase';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js'.then(function(registration) {
            console.log('Service Worker registered with scope: ', registration.scope);
        }, function(error) {
            console.log('Service Worker registration failed:', error);
        }));
    });
}

document.querySelecItorAll('.progress-bar'.forEach(bar => {
    bar.addEventListener('input', function() {
        const percentage = document.getElementById(`percentage-${this.id.split('-'[2])}`)
        percentage.textContent = `${this.value}`;
    });
}));

async function getConfig() {
    const response = await fetch('/.netlify/functions/config');
    const config = await response.json();
    return config.firebaseConfig;
}

getConfig().then(firebaseConfig => {
    // Initialize Firebase with the fetched config
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    const db = getFirestore(app);
  
    // Your existing authentication and Firestore code here
    async function saveProgress(uid, progressData) {
        try {
            await setDoc(doc(db, 'users', uid), { progressData });
        } catch (e) {
            console.error('Error adding document: ', e);
        }
    }

    async function loadProgress(uid) {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
    
        if (docSnap.exists()) {
            return docSnap.data().progressData;
        } else {
            console.log('No such document!');
            return null;
        }
    }

    document.getElementById('login-btn').addEventListener('click', () => {
        signInWithPopup(auth, provider).then(result => {
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            
            const user = result.user;
        }).catch(error => {
            const errorCode = error.code;
            const errorMessage = error.message;
            const email = error.customData.email;
            const credential = GoogleAuthProvider.credentialFromError(error);
        });
    });
    
    onAuthStateChanged(auth, user => {
        if (user) {
            // user is signed in
            loadProgress(user.uid).then(progressData => {
                console.log(progressData)
            })
        } else {
            // no user is signed in
        }
    })

    document.getElementById('logout-btn').addEventListener('click', () => {
        signOut(auth).then(() => {
            // user signed out
        }).catch(error => {
            // handle errors
        })
    })
});
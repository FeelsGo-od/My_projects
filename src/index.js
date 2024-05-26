import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/src/service-worker.js').then(function(registration) {
      console.log('Service Worker registered with scope: ', registration.scope);
    }, function(error) {
      console.log('Service Worker registration failed:', error);
    });
  });
}

document.querySelectorAll('.progress-bar').forEach(bar => {
  bar.addEventListener('input', function() {
    const percentage = document.getElementById(`percentage-${this.id.split('-')[2]}`);
    percentage.textContent = `${this.value}%`;
  });
});

async function getConfig() {
  const response = await fetch('/.netlify/functions/config');
  const config = await response.json();
  return config.firebaseConfig;
}

getConfig().then(firebaseConfig => {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  const db = getFirestore(app);

  document.getElementById('login-btn').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(result => {
      const user = result.user;
      console.log('User signed in:', user);
    }).catch(error => {
      console.error('Error during sign in:', error);
    });
  });

  onAuthStateChanged(auth, user => {
    if (user) {
      console.log('User signed in:', user);
      loadProgress(user.uid);
    } else {
      console.log('No user signed in');
      document.querySelectorAll('.progress-bar').forEach(bar => {
        bar.style.display = 'none';
      });
    }
  });

  async function loadProgress(uid) {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const progressData = docSnap.data().progressData;
        console.log('Loaded progress data:', progressData);
      } else {
        console.log('No such document!');
      }
    } catch (error) {
      console.error('Error loading document:', error);
    }
  }

  document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
      console.log('User signed out');
    }).catch(error => {
      console.error('Error during sign out:', error);
    });
  });
});

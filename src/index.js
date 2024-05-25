import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

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
        saveProgress(currentUser.uid, { [this.id]: this.value });
    });
});

async function getConfig() {
    const response = await fetch('/.netlify/functions/config');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const config = await response.json();
    return config.firebaseConfig;
}

let currentUser = null;

async function saveProgress(uid, progressData) {
    try {
        const userDoc = doc(getFirestore(), 'users', uid);
        const existingData = (await getDoc(userDoc)).data() || {};
        await setDoc(userDoc, { ...existingData, ...progressData });
    } catch (e) {
        console.error('Error adding document: ', e);
    }
}

async function loadProgress(uid) {
    try {
        const docSnap = await getDoc(doc(getFirestore(), 'users', uid));
        if (docSnap.exists()) {
            return docSnap.data()
        } else {
            console.log('No progress data found.');
            return null;
        }
    } catch (e) {
        console.error('Error loading progress: ', e);
        return null;
    }
}

getConfig().then(firebaseConfig => {
    // Initialize Firebase with the fetched config
    if (firebaseConfig) {
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const provider = new GoogleAuthProvider();
        const db = getFirestore(app);

        document.getElementById('login-btn').addEventListener('click', () => {
            signInWithPopup(auth, provider).then(result => {
                const credential = GoogleAuthProvider.credentialFromResult(result);
                const token = credential.accessToken;

                const user = result.user;
                console.log('User signed in: ', user);
                currentUser = result.user;
            }).catch(error => {
                const errorCode = error.code;
                const errorMessage = error.message;
                const email = error.customData.email;
                const credential = GoogleAuthProvider.credentialFromError(error);
                console.error('Error during sign in: ', error)
            });
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            signOut(auth).then(() => {
                // user signed out
                console.log('User signed out.');
                currentUser = null;
                document.getElementById('logout-btn').style.display = 'none';
                document.getElementById('progress-container').style.display = 'none';
                document.getElementById('login-btn').style.display = 'block';
            }).catch(error => {
                // handle errors
                console.error('Error during sign out: ', error);
            });
        });

        onAuthStateChanged(auth, async user => {
            if (user) {
                // user is signed in
                console.log('User is signed in: ', user);
                currentUser = user;
                document.getElementById('login-btn').style.display = 'none';
                document.getElementById('logout-btn').style.display = 'block';
                document.getElementById('progress-container').style.display = 'block';
                
                const progressData = await loadProgress(user.uid);
                if (progressData) {
                    for (const [key, value] of Object.entries(progressData)) {
                        const progressBar = document.getElementById(key);
                        if (progressBar) {
                            progressBar.value = value;
                            const percentage = document.getElementById(`percentage-${key.split('-')[2]}`);
                            if (percentage) {
                                percentage.textContent = `${value}%`;
                            }
                        }
                    }
                }

                loadProgress(user.uid).then(progressData => {
                    console.log(progressData);
                });
            } else {
                // no user is signed in
                console.log('No user is signed in.');
                currentUser = null;
                document.getElementById('login-btn').style.display = 'block';
                document.getElementById('logout-btn').style.display = 'none';
                document.getElementById('progress-container').style.display = 'none'
            }
        });

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
    }
}).catch(error => {
    console.error('Error fetching Firebase config: ', error);
});

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
        if (percentage) {
            percentage.textContent = `${this.value}%`;
            percentage.style.width = `${this.value}%`;
        } else {
            console.error('Element not found:', `percentage-${this.id.split('-')[2]}`)
        }
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

getConfig().then(firebaseConfig => {
    // Initialize Firebase with the fetched config
    if (firebaseConfig) {
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const provider = new GoogleAuthProvider();
        const db = getFirestore(app);

        async function saveProgress(uid, progressData) {
            try {
                await setDoc(doc(db, 'users', uid), { progressData });
            } catch (e) {
                console.error('Error adding document: ', e);
            }
        }

        async function loadProgress(uid) {
            try {
                const docRef = doc(db, 'users', uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    return docSnap.data().progressData;
                } else {
                    console.log('No progress data found.');
                    return null;
                }
            } catch (e) {
                console.error('Error loading progress: ', e);
                return null;
            }
        }

        document.getElementById('login-btn').addEventListener('click', () => {
            signInWithPopup(auth, provider).then(result => {
                const credential = GoogleAuthProvider.credentialFromResult(result);
                const token = credential.accessToken;
                const user = result.user;
                console.log('User signed in: ', user);
                currentUser = result.user;
            }).catch(error => {
                if (error.code === 'auth/popup-closed-by-user') {
                    console.error('Error during sign in: Popup closed by user');
                } else {
                    console.error('Error during sign in: ', error)
                }
            });
        });

        onAuthStateChanged(auth, user => {
            if (user) {
                // user is signed in
                loadProgress(user.uid).then(progressData => {
                    if (progressData) {
                        console.log(progressData);
                        // Update the UI with loaded progress data
                        progressData.forEach((value, index) => {
                            const progressBar = document.getElementById(`progress-bar-${index + 1}`);
                            const percentage = document.getElementById(`percentage-${index + 1}`);
                            if (progressBar && percentage) {
                                progressBar.value = value;
                                percentage.textContent = `${value}%`;
                                percentage.style.width = `${value}%`;
                            }
                        });
                    }
                })
            } else {
                document.querySelectorAll('.progress-bar').forEach(bar => bar.style.display = 'none');
            }
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            signOut(auth).then(() => {
                // user signed out
                console.log('User signed out.');
                document.querySelectorAll('.progress-bar').forEach(bar => bar.style.display = 'none');
            }).catch(error => {
                // handle errors
                console.error('Error during sign out: ', error);
            });
        });
    }
}).catch(error => {
    console.error('Error fetching Firebase config: ', error);
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, browserLocalPersistence, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-check.js";

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/src/service-worker.js').then(function(registration) {
            console.log('Service Worker registered with scope: ', registration.scope);
        }, function(error) {
            console.log('Service Worker registration failed:', error);
        });
    });
}

async function getConfig() {
    const response = await fetch('/.netlify/functions/config');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const config = await response.json();
    return config.firebaseConfig;
}

function showSpinner() {
    document.getElementById('loading-spinner').style.display = 'block';
}

function hideSpinner() {
    document.getElementById('loading-spinner').style.display = 'none';
}

function hideProgressBars() {
    document.querySelector('.progress-bar-container').style.display = 'none';
    document.getElementById('login-btn').style.display = 'inline-block';
    document.getElementById('logout-btn').style.display = 'none';
}

function showProgressBars() {
    document.querySelector('.progress-bar-container').style.display = 'block';
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'inline-block';
}

// Function to create a new progress bar
function createProgressBar(title) {
    const progressBarsContainer = document.querySelector('.progress-bars-container');

    if (!progressBarsContainer) {
        console.error('Progress bars container not found.');
        return;
    }

    // Create HTML elements for the new progress bar
    const progressBarHTML = `
    <div class="progress-bar-container">
        <div class="form-group">
            <input type="range" min="0" max="100" value="50" class="progress-bar form-control-range">
            <div class="d-flex justify-content-between">
                <label>Progress</label>
                <span class="percentage">50%</span>
            </div>
        </div>
    </div>
    `;

    // Append the new progress bar to the container
    progressBarsContainer.insertAdjacentHTML('beforeend', progressBarHTML);

    // Show the newly created progress bar by setting display to "block"
    const newProgressBar = progressBarsContainer.lastElementChild;
    newProgressBar.style.display = 'block';
}

document.getElementById('add-progress-bar-btn').addEventListener('click', () => {
    const title = prompt('Enter the title for the new progress bar:');
    if (title) {
        createProgressBar(title);
    }
});

document.getElementById('save-progress-bar-title-btn').addEventListener('click', () => {
    const newTitle = document.getElementById('progress-bar-title-input').value;
    // Update the title of the current progress bar
    // This is just a placeholder, you'll need to implement your own logic to save the new title to the database
});

getConfig().then(firebaseConfig => {
    // Initialize Firebase with the fetched config
    if (firebaseConfig) {
        const app = initializeApp(firebaseConfig);
        const appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_SITE_KEY'),
            isTokenAutoRefreshEnabled: true
        })

        const auth = getAuth(app);
        const provider = new GoogleAuthProvider();
        const db = getFirestore(app);

        auth.setPersistence(browserLocalPersistence).then(() => {
            document.getElementById('login-btn').addEventListener('click', () => {
                showSpinner();
                signInWithPopup(auth, provider).then(result => {
                    const credential = GoogleAuthProvider.credentialFromResult(result);
                    const token = credential.accessToken;
                    const user = result.user;
                    console.log('User signed in: ', user);
                    showProgressBars();
                }).catch(error => {
                    console.error('Error during sign in:', error);
                    if (error.code === 'auth/popup-closed-by-user') {
                        alert('Authentication popup was closed before sign in was completed. Please try again.');
                    }
                }).finally(() => {
                    hideSpinner();
                });
            });

            document.getElementById('logout-btn').addEventListener('click', () => {
                showSpinner();
                signOut(auth).then(() => {
                    // user signed out
                    console.log('User signed out.');
                    hideProgressBars();
                }).catch(error => {
                    // handle errors
                    console.error('Error during sign out: ', error);
                }).finally(() => {
                    hideSpinner();
                });
            });

            onAuthStateChanged(auth, user => {
                showSpinner();
                if (user) {
                    // user is signed in
                    sessionStorage.setItem('user', JSON.stringify(user));
    
                    loadProgress(user.uid).then(progressData => {
                        if (progressData) {
                            console.log(progressData);
                            updateProgressBars(progressData);
                            showProgressBars();
                        }
                    }).finally(() => {
                        hideSpinner();
                    })
                } else {
                    sessionStorage.removeItem('user')
                    console.log('No user is signed in');
                    hideProgressBars();
                    hideSpinner();            
                }
            });

            async function saveProgress(uid, progressData) {
                try {
                    await setDoc(doc(db, 'users', uid), { progressData });
                } catch (e) {
                    console.error('Error adding document: ', e);
                }
            }

            async function loadProgress(uid) {
                showSpinner();
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
                } finally {
                    hideSpinner();
                }
            }

            function updateProgressBars(progressData) {
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

            document.querySelectorAll('.progress-bar').forEach(bar => {
                bar.addEventListener('input', function() {
                    const percentage = document.getElementById(`percentage-${this.id.split('-')[2]}`);
                    if (percentage) {
                        percentage.textContent = `${this.value}%`;
                        percentage.style.width = `${this.value}%`;
                    } else {
                        console.error('Element not found:', `percentage-${this.id.split('-')[2]}`)
                    }
    
                    const user = auth.currentUser;
                    if (user) {
                        const progressData = Array.from(document.querySelectorAll('.progress-bar')).map(bar => bar.value);
                        saveProgress(user.uid, progressData);
                    }
                });
            });
        }).catch(error => {
            console.error('Error setting persistence: ', error);
        })
    }
}).catch(error => {
    console.error('Error fetching Firebase config: ', error);
});

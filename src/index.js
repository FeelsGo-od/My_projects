import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, browserLocalPersistence, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
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
    const progressBarsContainer = document.querySelector('.progress-bars-container');
    progressBarsContainer.innerHTML = '';
    document.getElementById('login-btn').style.display = 'inline-block';
    document.getElementById('logout-btn').style.display = 'none';
}

function showProgressBars() {
    const progressBarsContainer = document.querySelector('.progress-bars-container');
    if (progressBarsContainer) {
        progressBarsContainer.style.display = 'block';
    }
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'inline-block';
}

getConfig().then(firebaseConfig => {
    if (firebaseConfig) {
        const app = initializeApp(firebaseConfig);
        const appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_SITE_KEY'),
            isTokenAutoRefreshEnabled: true
        });

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
                    console.log('User signed out.');
                    hideProgressBars();
                }).catch(error => {
                    console.error('Error during sign out: ', error);
                }).finally(() => {
                    hideSpinner();
                });
            });

            onAuthStateChanged(auth, user => {
                showSpinner();
                if (user) {
                    sessionStorage.setItem('user', JSON.stringify(user));

                    loadProgress(user.uid).then(progressData => {
                        if (progressData) {
                            console.log(progressData);
                            updateProgressBars(progressData);
                            showProgressBars();
                        } else {
                            updateProgressBars([]);
                        }
                    }).finally(() => {
                        hideSpinner();
                    });
                } else {
                    sessionStorage.removeItem('user');
                    console.log('No user is signed in');
                    hideProgressBars();
                    hideSpinner();            
                }
            });

            async function createProgressBar(title, id, percentage = 50) {
                // Check if progress bar with provided ID already exists
                if (document.getElementById(id)) {
                    return; // If it exists, exit function to prevent duplication
                }
            
                const progressBarsContainer = document.querySelector('.progress-bars-container');
            
                // Generate HTML for the new progress bar
                const progressBarHTML = `
                    <div class="progress-bar-container" id="${id}">
                        <h3 class="progress-title">${title}</h3>
                        <button class="btn btn-danger delete-progress-bar-btn">Delete</button>
                        <div class="form-group">
                            <label>Progress</label>
                            <input type="range" min="0" max="100" value="${percentage}" class="progress-bar form-control-range">
                            <div class="d-flex justify-content-between">
                                <span>${percentage}%</span>
                            </div>
                        </div>
                    </div>
                `;
            
                // Append the new progress bar to the container
                progressBarsContainer.insertAdjacentHTML('beforeend', progressBarHTML);
            
                // Show the newly created progress bar
                const newProgressBar = progressBarsContainer.lastElementChild;
                newProgressBar.style.display = 'block';
            
                // Add event listener to the delete button
                const deleteButton = newProgressBar.querySelector('.delete-progress-bar-btn');
                deleteButton.addEventListener('click', async () => {
                    // Call a function to delete the progress bar from the database
                    deleteProgressBar(user.uid, id);
                    // Remove the progress bar from the UI
                    newProgressBar.remove();
                });
            
                // Call saveProgress to add the new progress bar to the database
                const user = auth.currentUser;
                if (user) {
                    await saveProgress(user.uid, { title, id, percentage });
                }
            }

            document.getElementById('add-progress-bar-btn').addEventListener('click', async () => {
                const title = prompt('Enter the title for the new progress bar:');
                if (title) {
                    await createProgressBar(title); // Ensure async completion
                }
            });

            async function deleteProgressBar(userId, progressBarId) {
                try {
                    const progressBarRef = doc(db, 'progressBars', progressBarId);
                    await deleteDoc(progressBarRef);
                } catch (error) {
                    console.error('Error deleting progress bar:', error);
                }
            }

            async function saveProgress(uid, progressBars) {
                try {
                    const progressBarsQuery = query(collection(db, 'progressBars'), where('uid', '==', uid));
                    const progressBarsSnapshot = await getDocs(progressBarsQuery);
                    progressBarsSnapshot.forEach(async doc => {
                        await deleteDoc(doc.ref);
                    });

                    await Promise.all(progressBars.map(async bar => {
                        await addDoc(collection(db, 'progressBars'), {
                            uid: uid,
                            title: bar.title,
                            percentage: bar.percentage
                        });
                    }));
                } catch (e) {
                    console.error('Error adding document: ', e);
                }
            }

            async function loadProgress(uid) {
                showSpinner();
                try {
                    const querySnapshot = await getDocs(query(collection(db, 'progressBars'), where('uid', '==', uid)));
                    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                } catch (e) {
                    console.error('Error loading progress: ', e);
                    return null;
                } finally {
                    hideSpinner();
                }
            }

            function updateProgressBars(progressData) {
                const progressBarsContainer = document.querySelector('.progress-bars-container');
                const noProgressText = document.getElementById('no-progress-text');
            
                // Clear any existing progress bars
                progressBarsContainer.innerHTML = '';
            
                if (progressData.length > 0) {
                    progressData.forEach(value => {
                        createProgressBar(value.title, value.id, value.percentage);
                    });
            
                    // Show progress bars container and hide placeholder text
                    progressBarsContainer.style.display = 'block';
                    noProgressText.style.display = 'none';
                } else {
                    // Hide progress bars container and show placeholder text
                    progressBarsContainer.style.display = 'none';
                    noProgressText.style.display = 'block';
                }
            }

            document.querySelectorAll('.progress-bar').forEach(bar => {
                bar.addEventListener('input', function() {
                    const percentage = document.getElementById(`percentage-${this.id.split('-')[2]}`);
                    if (percentage) {
                        percentage.textContent = `${this.value}%`;
                        percentage.style.width = `${this.value}%`;
                    } else {
                        console.error('Element not found:', `percentage-${this.id.split('-')[2]}`);
                    }

                    if (auth.currentUser) {
                        const progressData = Array.from(document.querySelectorAll('.progress-bar')).map(bar => ({
                            title: bar.previousElementSibling.textContent, 
                            percentage: bar.value 
                        }));
                        saveProgress(auth.currentUser.uid, progressData);
                    }
                });
            });
        }).catch(error => {
            console.error('Error setting persistence: ', error);
        });
    }
}).catch(error => {
    console.error('Error fetching Firebase config: ', error);
});

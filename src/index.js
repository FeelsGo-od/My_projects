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
            document.getElementById('login-btn').addEventListener('click', async () => {
                await clearCache();
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

            async function clearCache() {
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    for (const cacheName of cacheNames) {
                        await caches.delete(cacheName);
                    }
                    console.log('All caches cleared');
                }
            }

            document.getElementById('logout-btn').addEventListener('click', async () => {
                await clearCache();
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

            onAuthStateChanged(auth, async user => {
                showSpinner();
                if (user) {
                    console.log('User is signed in:', user);
                    sessionStorage.setItem('user', JSON.stringify(user));
                    try {
                        const progressData = await loadProgress(user.uid);
                        if (progressData) {
                            console.log(progressData);
                            updateProgressBars(progressData);
                            showProgressBars();
                        } else {
                            updateProgressBars([]);
                        }
                    } finally {
                        hideSpinner();
                    }
                } else {
                    sessionStorage.removeItem('user');
                    console.log('No user is signed in');
                    hideProgressBars();
                    hideSpinner();            
                }
            });
            
            let progressBarsArray = [];

            async function createProgressBar(title, id, percentage = 50) {
                const user = auth.currentUser;
                if (!user) {
                    throw new Error('User is not authenticated');
                }
            
                const progressBarsContainer = document.querySelector('.progress-bars-container');
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
                progressBarsContainer.insertAdjacentHTML('beforeend', progressBarHTML);
            
                const newProgressBar = progressBarsContainer.lastElementChild;
                newProgressBar.style.display = 'block';
            
                const progressBarInput = newProgressBar.querySelector('.progress-bar');
                progressBarInput.addEventListener('input', async function() {
                    const percentage = this.value;
                    const progressBarId = this.parentNode.parentNode.id;
                    if (user) {
                        const progressData = {
                            id: progressBarId,
                            percentage: parseInt(percentage)
                        };
                        await updateProgressBar(user.uid, progressData);
                    }
                    const percentageDisplay = this.parentNode.querySelector('span');
                    if (percentageDisplay) {
                        percentageDisplay.textContent = `${percentage}%`;
                    }
                });
            
                progressBarsArray.push({ title, id, percentage, uid: user.uid });
                await saveProgressBar(user.uid, { title, id, percentage, uid: user.uid });
            }


            async function saveProgressBar(userId, progressBar) {
                try {
                    const progressBarRef = doc(db, 'progressBars', progressBar.id);
                    await setDoc(progressBarRef, progressBar);
                    console.log('Progress bar saved successfully with ID:', progressBar.id);
                } catch (error) {
                    console.error('Error saving progress bar:', error);
                }
            }

            document.querySelector('.progress-bars-container').addEventListener('click', async (event) => {
                if (event.target.classList.contains('delete-progress-bar-btn')) {
                    const deleteButton = event.target;
                    const progressBarContainer = deleteButton.closest('.progress-bar-container');
                    const progressBarId = progressBarContainer.id;
                    const user = auth.currentUser;
            
                    if (user) {
                        try {
                            await deleteProgressBar(user.uid, progressBarId);
                            progressBarContainer.remove();
                            console.log('Progress bar removed from UI');
                        } catch (error) {
                            console.error('Error deleting progress bar:', error);
                        }
                    }
                }
            });

            document.getElementById('add-progress-bar-btn').addEventListener('click', async () => {
                const title = prompt('Enter the title for the new progress bar:');
                if (title) {
                    const id = generateId();
                    await createProgressBar(title, id);
                    saveAllProgressBars();}
                });
    
                // Function to generate a unique ID for each progress bar
                function generateId() {
                    return Math.random().toString(36).substr(2, 9);
                }
    
                async function deleteProgressBar(userId, progressBarId) {
                    try {
                        console.log('Attempting to delete progress bar:');
                        console.log('User ID:', userId);
                        console.log('Progress Bar ID:', progressBarId);
                
                        const progressBarRef = doc(db, 'progressBars', progressBarId);
                        console.log('Document Reference:', progressBarRef.path);
                
                        const progressBarDoc = await getDoc(progressBarRef);
                        if (progressBarDoc.exists()) {
                            console.log('Progress bar document exists. Checking permissions.');
                
                            const docData = progressBarDoc.data();
                            if (docData.uid === userId) {
                                console.log('User has permission to delete this progress bar. Proceeding with deletion.');
                                await deleteDoc(progressBarRef);
                                console.log('Progress bar deleted successfully');
                                return true;
                            } else {
                                console.warn('User does not have permission to delete this progress bar.');
                                return false;
                            }
                        } else {
                            console.warn('Progress bar document does not exist. Cannot delete.');
                            return false;
                        }
                    } catch (error) {
                        console.error('Error deleting progress bar:', error);
                        return false;
                    }
                }
    
                async function saveAllProgressBars() {
                    if (auth.currentUser && progressBarsArray.length > 0) {
                        await Promise.all(progressBarsArray.map(async bar => {
                            await saveProgressBar(auth.currentUser.uid, bar);
                        }));
                        progressBarsArray = [];
                    }
                }
    
                async function saveProgress(uid, progressBars) {
                    try {
                        const progressBarsCollectionRef = collection(db, 'progressBars');
                        const progressBarsQuery = query(progressBarsCollectionRef, where('uid', '==', uid));
                        const progressBarsSnapshot = await getDocs(progressBarsQuery);
                        progressBarsSnapshot.forEach(async doc => {
                            await deleteDoc(doc.ref);
                        });
                
                        await Promise.all(progressBars.map(async bar => {
                            const progressBarRef = doc(progressBarsCollectionRef, bar.id);
                            await setDoc(progressBarRef, {
                                uid: uid,
                                title: bar.title,
                                percentage: bar.percentage
                            });
                        }));
                    } catch (e) {
                        console.error('Error saving progress:', e);
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
                
                    progressBarsContainer.innerHTML = '';
                
                    if (progressData.length > 0) {
                        progressData.forEach(value => {
                            createProgressBar(value.title, value.id, value.percentage);
                        });
                
                        progressBarsContainer.style.display = 'block';
                        noProgressText.style.display = 'none';
                    } else {
                        progressBarsContainer.style.display = 'none';
                        noProgressText.style.display = 'block';
                    }
                }
                
                async function updateProgressBar(userId, progressData) {
                    try {
                        console.log(`Attempting to update progress bar with ID: ${progressData.id}`);
                        const progressBarRef = doc(db, 'progressBars', progressData.id);
                        await setDoc(progressBarRef, { percentage: progressData.percentage }, { merge: true });
                        console.log(`Progress bar ${progressData.id} updated successfully`);
                    } catch (error) {
                        console.error('Error updating progress bar:', error);
                    }
                }
    
            }).catch(error => {
                console.error('Error setting persistence: ', error);
            });
        }
    }).catch(error => {
        console.error('Error fetching Firebase config: ', error);
    });

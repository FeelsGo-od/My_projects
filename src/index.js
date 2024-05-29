import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, browserLocalPersistence, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js"; // Import collection, addDoc, getDocs, and deleteDoc functions
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
    if (progressBarContainer) {
        progressBarContainer.style.display = 'block';
    }
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'inline-block';
}

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
                            progressData.forEach(data => {
                                createProgressBar(data.title, data.id); // Call createProgressBar for each progress bar
                            });
                            showProgressBars();
                        } else {
                            updateProgressBars([]);
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

            // Function to create a new progress bar
            async function createProgressBar(title, id) {
                const progressBarsContainer = document.querySelector('.progress-bars-container');

                if (!progressBarsContainer) {
                    console.error('Progress bars container not found.');
                    return;
                }

                progressBarsContainer.innerHTML = '';

                // Generate a unique ID for the progress bar container
                const progressBarId = `progress-bar-${Date.now()}`;

                // Create HTML elements for the new progress bar
                const progressBarHTML = `
                <div class="progress-bar-container" id="${progressBarId}">
                <h3 class="progress-title">${title}</h3>
                <button class="btn btn-danger delete-progress-bar-btn">Delete</button>
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

                // Add event listener to the label to make it editable
                const titleElement = newProgressBar.querySelector('.progress-title');
                titleElement.addEventListener('click', () => {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = titleElement.textContent;
                    input.addEventListener('blur', async () => {
                        titleElement.textContent = input.value;
                        // Update the title in the database
                        await updateTitleInDatabase(progressBarId, input.value);
                    });
                    titleElement.textContent = '';
                    titleElement.appendChild(input);
                    input.focus();
                });

                // Add event listener to the delete button
                const deleteButton = newProgressBar.querySelector('.delete-progress-bar-btn');
                deleteButton.addEventListener('click', async () => {
                    // Call a function to delete the progress bar from the database
                    deleteProgressBar(user.uid, progressBarId);
                    // Remove the progress bar from the UI
                    newProgressBar.remove();
                });

                // Call saveProgress to add the new progress bar to the database
                const user = auth.currentUser;
                if (user) {
                    const progressBars = Array.from(document.querySelectorAll('.progress-bar')).map(bar => ({ title: bar.title, percentage: bar.value }));
                    await saveProgress(user.uid, progressBars);
                }
            }

            document.getElementById('add-progress-bar-btn').addEventListener('click', () => {
                const title = prompt('Enter the title for the new progress bar:');
                if (title) {
                    createProgressBar(title);
                }
            });

            async function deleteProgressBar(userId, progressBarId) {
                try {
                    const userDocRef = doc(db, 'users', userId);
                    const userProgressDocRef = doc(userDocRef, 'progressBars', progressBarId);
                    await deleteDoc(userProgressDocRef);
                } catch (error) {
                    console.error('Error deleting progress bar:', error);
                }
            }

            async function saveProgress(uid, newProgressBar) {
                try {
                    const docRef = doc(db, 'users', uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        let progressData = userData.progressData || [];
                        progressData.push(newProgressBar);
                        await setDoc(docRef, { progressData: progressData });
                    } else {
                        // If user document doesn't exist, create a new one with the progress data
                        await setDoc(docRef, { progressData: [newProgressBar] });
                    }
                } catch (e) {
                    console.error('Error adding document: ', e);
                }
            }

            async function loadProgress(uid) {
                showSpinner();
                try {
                    const userDocRef = doc(db, 'users', uid);
                    const userDocSnap = await getDoc(userDocRef);
            
                    if (userDocSnap.exists()) {
                        const userProgressCollectionRef = collection(userDocRef, 'progressBars');
                        const progressDataSnapshot = await getDocs(userProgressCollectionRef);
                        return progressDataSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
                const progressBarsContainer = document.querySelector('.progress-bars-container');
                const noProgressText = document.getElementById('no-progress-text');

                if (progressData.length > 0) {
                    // Clear any existing progress bars
                    progressBarsContainer.innerHTML = '';

                    progressData.forEach((value, index) => {
                        const progressBarId = `progress-bar-${index + 1}`;
                        const progressBarHTML = `
                        <div class="progress-bar-container" id="${progressBarId}">
                            <h3 class="progress-title">${value.title}</h3>
                            <div class="form-group">
                                <input type="range" min="0" max="100" value="${value.progress}" class="progress-bar form-control-range" id="${progressBarId}">
                                <div class="d-flex justify-content-between">
                                    <label for="${progressBarId}">Progress</label>
                                    <span class="percentage">${value.progress}%</span>
                                </div>
                            </div>
                        </div>
                        `;
                        progressBarsContainer.insertAdjacentHTML('beforeend', progressBarHTML);
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

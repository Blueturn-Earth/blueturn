import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

let auth;

try {
  auth = getAuth();
  console.log("Current Firebase user before signin:", auth ? auth.currentUser : null);
} catch (e) {
  console.error("Firebase getAuth error:", e);
  auth = null;
}

export async function ensureAuthReady() {
  if (!auth) {
    console.warn("No Firebase Auth available");
    return null;
  }
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => {
      console.log("Firebase auth state changed, current user:", user);
      if (user) {
        unsub();
        resolve(auth);
      }
    });

    if (!auth.currentUser) {
      console.log("No current user, signing in anonymously");
      signInAnonymously(auth).catch(reject);
    }
  });
}

import { auth, db } from "./firebase-init.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Google Provider setup
const googleProvider = new GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {

    /* =========================================================================
       Standalone Auth Page Logic with Firebase
       ========================================================================= */

    const loginForm = document.getElementById('loginForm');
    const regisForm = document.getElementById('regisForm');
    const authErrorMsg = document.getElementById('authErrorMsg');

    // Helper to store user and redirect
    const handleSuccessfulAuthFlow = async (user, displayNameOverride = null) => {
        try {
            // Check if user exists in Firestore
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            // If not (e.g., first Google login), create profile
            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    displayName: displayNameOverride || user.displayName || "Usuario Nuevo",
                    email: user.email || user.phoneNumber || "No Email",
                    createdAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.warn("Advertencia: No se pudo guardar el perfil en Firestore. ¿Está habilitado en Firebase Console?", error);
        }

        // Always proceed to log the user in locally and redirect, even if Firestore fails
        sessionStorage.setItem('quest_user_logged_in', 'true');
        sessionStorage.setItem('quest_user_id', user.uid);
        window.location.href = 'index.html';
    };

    // --- GOOGLE AUTHENTICATION ---
    const attachGoogleLogin = (btnId) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', async () => {
                btn.textContent = "Cargando...";
                btn.style.opacity = '0.7';
                try {
                    const result = await signInWithPopup(auth, googleProvider);
                    console.log('Google Auth Success:', result.user.email);
                    await handleSuccessfulAuthFlow(result.user);
                } catch (error) {
                    console.error("Google Auth Error:", error);
                    showError("Fallo al iniciar con Google.");
                    btn.innerHTML = `<img src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg" alt="Google Logo" class="social-icon"> Google`;
                    btn.style.opacity = '1';
                }
            });
        }
    };

    // Attach to both pages if available
    attachGoogleLogin('btnGoogleLogin');
    attachGoogleLogin('btnGoogleRegis');


    // --- PHONE AUTHENTICATION ---
    const attachPhoneLogin = (btnId, recaptchaContainerId) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        btn.addEventListener('click', async () => {
            const phoneNumber = prompt("Ingresa tu número (Ejemplo: +521234567890):");
            if (!phoneNumber) return;

            btn.textContent = "Verificando...";
            btn.style.opacity = '0.7';
            btn.disabled = true;

            try {
                // Initialize verifier (invisible mode or visible container)
                window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
                    'size': 'invisible',
                    'callback': (response) => {
                        // reCAPTCHA solved
                    }
                });

                const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);

                // Prompt for code
                const code = prompt("Ingresa el código SMS (6 dígitos):");
                if (code) {
                    const result = await confirmationResult.confirm(code);
                    console.log('Phone Auth Success', result.user.phoneNumber);
                    await handleSuccessfulAuthFlow(result.user, result.user.phoneNumber);
                } else {
                    throw new Error("Código cancelado");
                }
            } catch (error) {
                console.error("Phone Auth Error:", error);
                showError("Fallo la verificación SMS. Intenta de nuevo.");
                btn.innerHTML = `<span class="material-icons-round social-icon">phone_iphone</span> Teléfono`;
                btn.style.opacity = '1';
                btn.disabled = false;
            }
        });
    };

    // Attach to both pages if available
    attachPhoneLogin('btnPhoneLogin', 'recaptcha-container');
    attachPhoneLogin('btnPhoneRegis', 'recaptcha-container-regis');


    // --- EMAIL/PASSWORD LOGIC ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('emailInput').value;
            const password = document.getElementById('passwordInput').value;
            const btnSubmitAuth = document.getElementById('btnSubmitAuth');

            if (password.length < 6) {
                showError('La contraseña debe tener al menos 6 caracteres.');
                return;
            }

            btnSubmitAuth.textContent = 'Conectando...';
            btnSubmitAuth.style.opacity = '0.7';

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                await handleSuccessfulAuthFlow(userCredential.user);
            } catch (error) {
                console.error("Login error:", error);
                showError('Error al iniciar sesión. Verifica tus credenciales.');
                btnSubmitAuth.textContent = 'Entrar';
                btnSubmitAuth.style.opacity = '1';
            }
        });
    }

    if (regisForm) {
        regisForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('nameInput').value;
            const email = document.getElementById('emailInput').value;
            const password = document.getElementById('passwordInput').value;
            const btnSubmitRegis = document.getElementById('btnSubmitRegis');

            if (password.length < 6) {
                showError('La contraseña debe tener al menos 6 caracteres.');
                return;
            }

            btnSubmitRegis.textContent = 'Creando Cuenta...';
            btnSubmitRegis.style.opacity = '0.7';

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await handleSuccessfulAuthFlow(userCredential.user, name);
            } catch (error) {
                console.error("Registration error:", error);
                showError('Error al registrarse. Posiblemente el correo ya esté en uso.');
                btnSubmitRegis.textContent = 'Registrarse';
                btnSubmitRegis.style.opacity = '1';
            }
        });
    }

    function showError(message) {
        if (authErrorMsg) {
            authErrorMsg.textContent = message;
            authErrorMsg.style.display = 'block';
        }
    }
});

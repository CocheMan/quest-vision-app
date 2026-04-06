import { db } from "./firebase-init.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const btnBackIndex = document.getElementById('btnBackIndex');

    // Main View
    const mainChoiceView = document.getElementById('mainChoiceView');
    const lobbyDescription = document.getElementById('lobbyDescription');
    const btnCreateRoom = document.getElementById('btnCreateRoom');
    const btnJoinRoom = document.getElementById('btnJoinRoom');

    // Join View
    const joinCodeView = document.getElementById('joinCodeView');
    const btnCancelJoin = document.getElementById('btnCancelJoin');
    const btnSubmitJoin = document.getElementById('btnSubmitJoin');
    const joinCodeInput = document.getElementById('joinCodeInput');

    // Back to index
    if (btnBackIndex) {
        btnBackIndex.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // CREATE ROOM
    if (btnCreateRoom) {
        btnCreateRoom.addEventListener('click', async () => {
            // Generate a random code
            const generatedCode = 'QV-' + Math.floor(1000 + Math.random() * 9000);

            lobbyDescription.textContent = 'Creando sala...';
            btnCreateRoom.style.opacity = '0.7';
            btnCreateRoom.textContent = 'Iniciando...';
            btnCreateRoom.disabled = true;

            try {
                // Register room in Firestore
                await setDoc(doc(db, "rooms", generatedCode), {
                    hostId: sessionStorage.getItem('quest_user_id') || 'unknown',
                    createdAt: new Date().toISOString()
                });

                // Redirect to vbox with a "room" parameter
                window.location.href = `vbox.html?room=${generatedCode}&mode=host`;
            } catch (error) {
                console.warn("Error creating room in Firestore:", error);

                // Fallback mechanics if Firestore is disabled
                window.location.href = `vbox.html?room=${generatedCode}&mode=host`;
            }
        });
    }

    // JOIN ROOM (Show Input)
    if (btnJoinRoom) {
        btnJoinRoom.addEventListener('click', () => {
            mainChoiceView.style.display = 'none';
            joinCodeView.classList.add('active');
            lobbyDescription.textContent = 'Ingresa el código proporcionado por el creador de la sala.';
            joinCodeInput.focus();
        });
    }

    // CANCEL JOIN (Go back to choice)
    if (btnCancelJoin) {
        btnCancelJoin.addEventListener('click', () => {
            joinCodeView.classList.remove('active');
            mainChoiceView.style.display = 'flex';
            lobbyDescription.textContent = '¿Qué deseas hacer en esta sesión?';
            joinCodeInput.value = ''; // clear input
        });
    }

    // SUBMIT JOIN 
    if (btnSubmitJoin) {
        btnSubmitJoin.addEventListener('click', async () => {
            const code = joinCodeInput.value.trim().toUpperCase();
            if (!code) {
                // Shake effect or simple alert for accessibility
                joinCodeInput.style.borderColor = 'red';
                setTimeout(() => { joinCodeInput.style.borderColor = 'var(--q-glass-border)'; }, 1000);
                return;
            }

            lobbyDescription.textContent = `Buscando la sala ${code}...`;
            btnSubmitJoin.textContent = 'Uniéndose...';
            btnSubmitJoin.style.opacity = '0.7';
            btnSubmitJoin.disabled = true;

            try {
                // Check if room exists in Firestore
                const roomSnap = await getDoc(doc(db, "rooms", code));

                if (roomSnap.exists()) {
                    window.location.href = `vbox.html?room=${code}&mode=guest`;
                } else {
                    lobbyDescription.textContent = 'Esa sala no existe o ya cerró.';
                    lobbyDescription.style.color = 'var(--q-error)';
                    btnSubmitJoin.textContent = 'Entrar a la Sala';
                    btnSubmitJoin.style.opacity = '1';
                    btnSubmitJoin.disabled = false;
                }
            } catch (error) {
                console.warn("Firestore Check Error", error);

                // If firestore is off, just let them try to join natively with PeerJS
                window.location.href = `vbox.html?room=${code}&mode=guest`;
            }
        });
    }

    // Pressing ENTER on the code input
    if (joinCodeInput) {
        joinCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnSubmitJoin.click();
            }
        });
    }
});

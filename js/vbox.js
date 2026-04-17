import { auth, db } from "./firebase-init.js";
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {

    /* --- UI Elements --- */
    const btnBack = document.getElementById('btnBack');
    const roomTitle = document.getElementById('roomTitle');
    const roomStatusBadge = document.getElementById('roomStatusBadge');

    // Video Elements
    const localVideo = document.getElementById('localVideo');
    const localAvatar = document.getElementById('localAvatar');
    const remoteVideosContainer = document.getElementById('remoteVideosContainer');

    // Controls
    const btnToggleMic = document.getElementById('btnToggleMic');
    const micIcon = document.getElementById('micIcon');
    const userMicIconStatus = document.getElementById('userMicIconStatus');

    const btnToggleCam = document.getElementById('btnToggleCam');
    const camIcon = document.getElementById('camIcon');

    const btnLeave = document.getElementById('btnLeave');

    /* --- State --- */
    let localStream = null;
    let peer = null;
    let isMicOn = true;
    let isCamOn = true;
    let myEmail = "Invitado";
    let peerNames = {};

    onAuthStateChanged(auth, (user) => {
        if (user) {
            myEmail = user.email || user.phoneNumber || "Usuario";
            dataConnections.forEach(conn => {
                if (conn.open) {
                    try { conn.send({ type: 'identify', email: myEmail }); } catch (e) {}
                }
            });
        }
    });

    // 2. Parse URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    const mode = urlParams.get('mode'); // 'host' or 'guest'

    if (!roomCode) {
        alert("No se especificó un código de sala.");
        window.location.href = 'lobby.html';
        return;
    }

    roomTitle.textContent = `Sala: ${roomCode}`;

    // Helper: Cleanup room if host
    const cleanupRoomAsHost = async () => {
        if (mode === 'host') {
            try {
                await deleteDoc(doc(db, "rooms", roomCode));
            } catch (error) {
                console.error("Error cleaning up room:", error);
            }
        }
    };

    // 1. Navigation Back
    const exitVbox = async () => {
        if (peer) peer.destroy();
        await cleanupRoomAsHost();
        window.location.href = 'index.html';
    };

    if (btnBack) {
        btnBack.addEventListener('click', exitVbox);
    }

    if (btnLeave) {
        btnLeave.addEventListener('click', exitVbox);
    }

    // Cleanup on browser tab close
    window.addEventListener('beforeunload', () => {
        cleanupRoomAsHost();
    });

    /* --- WebRTC & Camera Setup --- */

    try {
        // Request Camera and Mic with fallbacks
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (vidErr) {
            console.warn("Media devices initially failed, trying audio only...", vidErr);
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                isCamOn = false;
            } catch (audErr) {
                console.warn("No audio device available or permission denied. Joining without media.");
                // Create an empty stream so PeerJS doesn't crash on peer.call
                localStream = new MediaStream();
                isCamOn = false;
                isMicOn = false;
            }
        }

        // Show Local Video
        if (localVideo && isCamOn) {
            localVideo.srcObject = localStream;
        } else if (localVideo && !isCamOn) {
            localVideo.style.display = 'none';
            if (localAvatar) localAvatar.style.display = 'flex';
        }

        // Initialize PeerJS
        // Prefix room with 'quest-' to avoid public server collisions
        const peerId = mode === 'host' ? `quest-${roomCode}` : null;

        peer = new Peer(peerId, {
            debug: 2,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { 
                        urls: 'turn:openrelay.metered.ca:80',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    { 
                        urls: 'turn:openrelay.metered.ca:443',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    { 
                        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    }
                ]
            }
        });

        peer.on('open', (id) => {
            console.log("My Peer ID is: " + id);
            roomStatusBadge.textContent = mode === 'host' ? "Esperando invitados" : "Conectado";
            roomStatusBadge.style.background = "var(--q-success)"; // Greenish indicator

            // If we are a guest, connect to the host via data channel to ask for permission
            if (mode === 'guest') {
                const hostId = `quest-${roomCode}`;
                console.log("Connecting to host via data channel: " + hostId);

                // Open Data Channel to Host
                const conn = peer.connect(hostId);
                dataConnections.push(conn);
                setupDataConnection(conn);

                conn.on('open', () => {
                    // Send identify first!
                    conn.send({ type: 'identify', email: myEmail });
                    // Start the permission request
                    conn.send({ type: 'join-request', peerId: peer.id });
                    roomStatusBadge.textContent = "Pidiendo permiso...";
                });
            }
        });

        peer.on('error', (err) => {
            console.error(err);
            roomStatusBadge.textContent = "Error de conexión";
            roomStatusBadge.style.background = "var(--q-error)";
            if (err.type === 'unavailable-id') {
                alert("La sala ya existe o alguien más ya es el anfitrión.");
            } else if (err.type === 'peer-unavailable') {
                alert("El anfitrión de la sala no está disponible u ocurrió un error de conexión.");
            }
        });

        // If we are the host (or guest receiving mesh calls), answer incoming calls
        peer.on('call', (call) => {
            console.log("Receiving a call from: " + call.peer);
            call.answer(localStream); // Answer with our current stream
            handleCall(call);
        });

        // Listen for incoming Data Connections (usually Host receiving from Guests, or Guests bridging to other Guests)
        peer.on('connection', (conn) => {
            dataConnections.push(conn);
            setupDataConnection(conn);
        });

    } catch (error) {
        console.error("Error accessing media devices.", error);
        alert("Por favor habilita los permisos de Cámara y Micrófono para participar en la sala.");
        roomStatusBadge.textContent = "Cámara Denegada";
    }

    // Function to handle the active video call connection
    function handleCall(call) {
        call.on('stream', (remoteStream) => {
            console.log("Remote stream received from", call.peer);

            // Check if we already have a video for this peer
            const existingCard = document.getElementById(call.peer);
            if (!existingCard) {
                addRemoteVideo(call.peer, remoteStream);
            } else {
                // If stream tracks update (e.g. video track arrives after audio), update srcObject
                const videoEl = existingCard.querySelector('video');
                if (videoEl && videoEl.srcObject !== remoteStream) {
                    videoEl.srcObject = remoteStream;
                    videoEl.play().catch(e => console.warn("Auto-play prevented on stream update", e));
                }
            }
        });

        call.on('close', () => {
            const remoteVideoCard = document.getElementById(call.peer);
            if (remoteVideoCard) {
                remoteVideoCard.remove();
            }
        });
    }

    // Helper to dynamically add remote user HTML
    function addRemoteVideo(peerId, stream) {
        const card = document.createElement('div');
        card.className = 'video-card glass-panel';
        card.id = peerId;

        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.srcObject = stream;
        // Auto-reproducción robusta: El navegador bloquea audio/video si el usuario no ha interactuado
        const playVideo = () => {
            video.play().catch(err => {
                console.warn("Autoplay bloqueado. Esperando interacción del usuario: ", err);
                // Mostrar alerta visual temporal para que el anfitrión sepa que debe hacer clic
                let overlay = document.getElementById('autoplayAlertOverlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'autoplayAlertOverlay';
                    overlay.style.position = 'absolute';
                    overlay.style.top = '10%';
                    overlay.style.left = '50%';
                    overlay.style.transform = 'translate(-50%, 0)';
                    overlay.style.background = 'var(--q-primary)';
                    overlay.style.color = '#fff';
                    overlay.style.padding = '12px 24px';
                    overlay.style.borderRadius = '8px';
                    overlay.style.zIndex = '9999';
                    overlay.style.cursor = 'pointer';
                    overlay.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
                    overlay.innerHTML = '<strong>⚠️ Haz clic aquí o en cualquier lado para iniciar la cámara y audio del invitado</strong>';
                    document.body.appendChild(overlay);
                }

                const playOnInteract = () => {
                    video.play();
                    if (overlay) overlay.remove();
                    document.body.removeEventListener('click', playOnInteract);
                    document.body.removeEventListener('touchstart', playOnInteract);
                };
                document.body.addEventListener('click', playOnInteract);
                document.body.addEventListener('touchstart', playOnInteract);
            });
        };

        // Forzar reproducción tanto si se cargan metadatos como si no, para asegurar
        video.onloadedmetadata = playVideo;
        // Intento inmediato también por si el stream ya viene listo
        setTimeout(playVideo, 500);

        const info = document.createElement('div');
        info.className = 'participant-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = peerNames[peerId] || "Invitado";

        const micSpan = document.createElement('span');
        micSpan.className = 'material-icons-round icon-mic on';
        micSpan.textContent = 'mic';

        const handSpan = document.createElement('span');
        handSpan.className = 'material-icons-round icon-hand raise-hand-indicator';
        handSpan.textContent = 'front_hand';
        handSpan.style.display = 'none';
        handSpan.style.color = 'var(--q-warning)';
        handSpan.style.marginLeft = '8px';

        info.appendChild(nameSpan);
        info.appendChild(micSpan);
        info.appendChild(handSpan);

        card.appendChild(video);
        card.appendChild(info);

        remoteVideosContainer.appendChild(card);
    }


    /* --- Speech Recognition, Subtitles & Chat Setup --- */

    const subtitlesOverlay = document.getElementById('subtitlesOverlay');
    let dataConnections = [];
    let myLanguage = navigator.language.split('-')[0] || 'es'; // 'es', 'en', etc.

    // UI Sidebar Elements
    const btnTabChat = document.getElementById('btnTabChat');
    const btnTabCC = document.getElementById('btnTabCC');
    const chatContainer = document.getElementById('chatContainer');
    const ccContainer = document.getElementById('ccContainer');
    const chatFooter = document.getElementById('chatFooter');
    const chatInput = document.getElementById('chatInput');
    const btnSendChat = document.getElementById('btnSendChat');

    // Tab Switching Logic
    if (btnTabChat && btnTabCC) {
        btnTabChat.addEventListener('click', () => {
            btnTabChat.classList.add('active');
            btnTabCC.classList.remove('active');
            chatContainer.style.display = 'flex';
            ccContainer.style.display = 'none';
            chatFooter.style.display = 'flex'; // Only show text input on Chat Tab
        });

        btnTabCC.addEventListener('click', () => {
            btnTabCC.classList.add('active');
            btnTabChat.classList.remove('active');
            ccContainer.style.display = 'flex';
            chatContainer.style.display = 'none';
            chatFooter.style.display = 'none'; // Hide input on CC Log Tab
        });
    }

    // Append standard message bubble to a container
    function appendLog(container, text, sender = "") {
        if (!container) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = sender === "Tú" ? 'message my-message' : 'message';
        // Applying some basic styling for own messages if you like, otherwise default
        msgDiv.innerHTML = sender ? `<strong>${sender}:</strong> ${text}` : text;

        if (sender === "Tú") {
            msgDiv.style.color = 'var(--q-primary)';
        }

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight; // Auto-scroll to bottom
    }

    // 1. Display Subtitles on Video & Log
    let subtitleTimeout = null;
    function showSubtitle(text, sender = "") {
        // Log to Sidebar CC panel
        appendLog(ccContainer, text, sender);

        // Render on Video Overlay
        if (!subtitlesOverlay) return;
        const prefix = sender ? `${sender}: ` : "";
        subtitlesOverlay.innerHTML = `<span class="subtitle-text">${prefix}${text}</span>`;

        if (subtitleTimeout) clearTimeout(subtitleTimeout);
        subtitleTimeout = setTimeout(() => {
            subtitlesOverlay.innerHTML = '';
        }, 4000); // Hide after 4 seconds
    }

    // 2. Translate Text (Free MyMemory API)
    async function translateText(text, targetLang) {
        // If the API fails or languages are same, return original
        try {
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${targetLang}`);
            const data = await res.json();
            if (data && data.responseData && data.responseData.translatedText) {
                return data.responseData.translatedText;
            }
        } catch (error) {
            console.error("Translation error:", error);
        }
        return text;
    }

    // 3. Handle Incoming PeerJS Data
    let joinRequestsQueue = [];
    let isPrompting = false;

    function processJoinQueue() {
        if (isPrompting || joinRequestsQueue.length === 0) return;
        isPrompting = true;
        const request = joinRequestsQueue.shift();
        showJoinPrompt(request.peerId, request.conn);
    }

    function showJoinPrompt(guestId, conn) {
        const modal = document.getElementById('joinPromptModal');
        const text = document.getElementById('joinPromptText');
        const btnAccept = document.getElementById('btnAcceptJoin');
        const btnReject = document.getElementById('btnRejectJoin');

        if (!modal) {
            isPrompting = false;
            return;
        }
        const guestEmail = peerNames[guestId] || guestId;
        text.textContent = `Un invitado (${guestEmail}) quiere entrar a la sala.`;
        modal.style.display = 'flex';

        const cleanup = () => {
            modal.style.display = 'none';
            btnAccept.removeEventListener('click', onAccept);
            btnReject.removeEventListener('click', onReject);
            isPrompting = false;
            processJoinQueue();
        };

        const onAccept = () => {
            conn.send({ type: 'join-accept' });
            // Send peer-list to the newly accepted guest
            const uniquePeers = [...new Set(dataConnections.map(c => c.peer))].filter(p => p !== conn.peer && p !== peer.id);
            if (uniquePeers.length > 0) {
                conn.send({ type: 'peer-list', peers: uniquePeers });
            }
            cleanup();
        };

        const onReject = () => {
            conn.send({ type: 'join-reject' });
            setTimeout(() => {
                conn.close();
                dataConnections = dataConnections.filter(c => c !== conn);
            }, 500);
            cleanup();
        };

        btnAccept.addEventListener('click', onAccept);
        btnReject.addEventListener('click', onReject);
    }

    function setupDataConnection(conn) {
        const sendIdentify = () => {
            try { conn.send({ type: 'identify', email: myEmail }); } catch(err) {}
        };

        if (conn.open) {
            sendIdentify();
        } else {
            conn.on('open', () => {
                console.log(`Data connection opened with ${conn.peer}`);
                sendIdentify();
            });
        }

        conn.on('data', async (data) => {
            if (data.type === 'identify') {
                peerNames[conn.peer] = data.email;
                const card = document.getElementById(conn.peer);
                if (card) {
                    const nameSpan = card.querySelector('.name');
                    if (nameSpan) nameSpan.textContent = data.email;
                }
            }
            else if (data.type === 'join-request') {
                if (mode === 'host') {
                    joinRequestsQueue.push({ peerId: data.peerId || conn.peer, conn: conn });
                    processJoinQueue();
                }
            }
            else if (data.type === 'join-accept') {
                roomStatusBadge.textContent = "Conectado";
                roomStatusBadge.style.background = "var(--q-success)";

                // Now that we are accepted, we call the host
                const hostId = `quest-${roomCode}`;
                const call = peer.call(hostId, localStream);
                handleCall(call);
            }
            else if (data.type === 'join-reject') {
                alert("El anfitrión ha rechazado tu entrada a la sala.");
                window.location.href = 'index.html';
            }
            else if (data.type === 'subtitle') {
                // Sin traducción temporal para evitar bloqueos por límite de API gratuita
                showSubtitle(data.text, peerNames[conn.peer] || "Invitado");
            }
            else if (data.type === 'chat') {
                // Incoming text chat
                appendLog(chatContainer, data.text, peerNames[conn.peer] || "Invitado");
            }
            else if (data.type === 'raise-hand') {
                // Seleccionar explícitamente el recuadro del invitado que alzó la mano
                const card = document.getElementById(conn.peer);
                if (card) {
                    const remoteHand = card.querySelector('.raise-hand-indicator');
                    if (remoteHand) {
                        remoteHand.style.display = data.state ? 'inline-block' : 'none';
                    }
                }
            }
            else if (data.type === 'peer-list') {
                // Recibimos la lista de los que ya están en la sala. ¡Hay que llamarlos a todos!
                data.peers.forEach(otherPeerId => {
                    // Evitamos marcarnos a nosotros mismos o a gente que ya nos marcó
                    if (!peer.connections[otherPeerId]) {
                        console.log("Mesh Networking: Llamando a otro invitado secreto: " + otherPeerId);

                        // Iniciar videollamada cruzada
                        const call = peer.call(otherPeerId, localStream);
                        handleCall(call);

                        // Iniciar conexión de datos para chat/títulos cruzada
                        const meshConn = peer.connect(otherPeerId);
                        dataConnections.push(meshConn);
                        setupDataConnection(meshConn);
                    }
                });
            }
        });

        conn.on('close', () => {
            dataConnections = dataConnections.filter(c => c !== conn);
        });
    }

    // 4. Send Text Chat
    function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Render locally
        appendLog(chatContainer, text, "Tú");

        // Broadcast to peers
        dataConnections.forEach(conn => {
            conn.send({ type: 'chat', text: text });
        });

        chatInput.value = ''; // Clean field
    }

    if (btnSendChat) btnSendChat.addEventListener('click', sendChatMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    // 5. Initialize Local Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true; // Show results as they are spoken
        recognition.lang = myLanguage;

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const currentText = finalTranscript || interimTranscript;

            if (currentText && isMicOn) {
                // Show my own subtitle overlay locally
                if (finalTranscript) {
                    showSubtitle(finalTranscript, "Tú");

                    // Broadcast final transcript as subtitle
                    dataConnections.forEach(conn => {
                        conn.send({ type: 'subtitle', text: finalTranscript });
                    });
                } else {
                    // Just update overlay for interim without logging permanently
                    const prefix = "Tú: ";
                    if (subtitlesOverlay) {
                        subtitlesOverlay.innerHTML = `<span class="subtitle-text">${prefix}${currentText}</span>`;
                    }
                }
            }
        };

        recognition.onerror = (event) => {
            console.warn("Speech recognition error:", event.error);
            // sometimes it throws 'no-speech' repeatedly if silent, we handle restarts below
        };

        recognition.onend = () => {
            // Auto restart to keep listening infinitely if the mic is logically "on"
            if (isMicOn) {
                try { recognition.start(); } catch (e) { }
            }
        };

        // Start listening immediately
        try { recognition.start(); } catch (e) { }
    } else {
        appendLog(ccContainer, "Web Speech API no soportada en este navegador. Recomiendo Chrome/Edge.", "Sistema");
    }

    /* --- Vbox Room Meeting Controls --- */

    // 1. Copy Room Code
    const btnCopyCode = document.getElementById('btnCopyCode');
    const copyCodeIcon = document.getElementById('copyCodeIcon');
    if (btnCopyCode) {
        btnCopyCode.addEventListener('click', () => {
            navigator.clipboard.writeText(roomCode).then(() => {
                copyCodeIcon.innerText = 'check';
                copyCodeIcon.style.color = 'var(--q-success)';
                btnCopyCode.setAttribute('aria-label', "Código copiado");
                setTimeout(() => {
                    copyCodeIcon.innerText = 'content_copy';
                    copyCodeIcon.style.color = '';
                    btnCopyCode.setAttribute('aria-label', "Copiar código de sala");
                }, 2000);
            });
        });
    }

    // 2. Raise Hand state
    let isHandRaised = false;
    const btnRaiseHand = document.getElementById('btnRaiseHand');
    const handIcon = document.getElementById('handIcon');
    const localHandIndicator = document.getElementById('localHandIndicator');

    if (btnRaiseHand && localHandIndicator) {
        btnRaiseHand.addEventListener('click', () => {
            isHandRaised = !isHandRaised;
            if (isHandRaised) {
                btnRaiseHand.classList.add('toggle-off'); // Reuse UI style to indicate active 
                handIcon.style.color = 'var(--q-warning)';
                localHandIndicator.style.display = 'inline-block';
            } else {
                btnRaiseHand.classList.remove('toggle-off');
                handIcon.style.color = '';
                localHandIndicator.style.display = 'none';
            }

            // Sync with peers
            dataConnections.forEach(conn => {
                conn.send({ type: 'raise-hand', state: isHandRaised });
            });
        });
    }

    // Update handle Incoming data to also handle "raise-hand"
    // Since we already have a generic `setupDataConnection`, let's patch the local array of logic via re-declaration or modifying the callback:
    // (We will update the handleIncomingData function body inside setupDataConnection from before)
    // Wait, the easiest way is to modify the `conn.on('data')` that we already defined earlier. 
    // Since it's enclosed in setupDataConnection, I will redefine setupDataConnection here to override it safely, or modify it above.

    // 3. Screen Sharing
    const btnShareScreen = document.getElementById('btnShareScreen');
    let screenStream = null;

    if (btnShareScreen) {
        btnShareScreen.addEventListener('click', async () => {
            if (!screenStream) {
                // START Screenshare
                try {
                    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                    const screenTrack = screenStream.getVideoTracks()[0];

                    // Replace local video preview
                    localVideo.srcObject = screenStream;
                    btnShareScreen.classList.add('toggle-off');
                    btnShareScreen.querySelector('.dock-icon').style.color = 'var(--q-primary)';

                    // Replace track on all active PeerJS connections
                    for (let conns in peer.connections) {
                        peer.connections[conns].forEach(c => {
                            if (c.peerConnection) {
                                const sender = c.peerConnection.getSenders().find(s => s.track.kind === 'video');
                                if (sender) sender.replaceTrack(screenTrack);
                            }
                        });
                    }

                    // Listen for "Stop Sharing" on the browser native bar
                    screenTrack.onended = stopScreenShare;
                } catch (error) {
                    console.error("Screen sharing cancelled or failed", error);
                }
            } else {
                // STOP Screenshare manually
                stopScreenShare();
            }
        });
    }

    function stopScreenShare() {
        if (!screenStream) return;
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;

        btnShareScreen.classList.remove('toggle-off');
        btnShareScreen.querySelector('.dock-icon').style.color = '';

        // Revert local video
        const videoTrack = localStream.getVideoTracks()[0];
        localVideo.srcObject = localStream;

        // Revert track on peers
        for (let conns in peer.connections) {
            peer.connections[conns].forEach(c => {
                if (c.peerConnection && videoTrack) {
                    const sender = c.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(videoTrack);
                }
            });
        }
    }


    if (btnToggleMic && micIcon && localStream) {
        // Initial sync of UI with stream state
        if (!isMicOn) {
            btnToggleMic.classList.add('toggle-off');
            micIcon.innerText = 'mic_off';
            if (userMicIconStatus) {
                userMicIconStatus.innerText = 'mic_off';
                userMicIconStatus.classList.remove('on');
                userMicIconStatus.classList.add('off');
            }
        } else {
            btnToggleMic.classList.remove('toggle-off');
        }

        btnToggleMic.addEventListener('click', () => {
            isMicOn = !isMicOn;

            // Actual Audio Track toggling
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = isMicOn;
            }

            if (isMicOn) {
                // Mic is ON state
                btnToggleMic.classList.remove('toggle-off');
                micIcon.innerText = 'mic';
                userMicIconStatus.innerText = 'mic';
                userMicIconStatus.classList.remove('off');
                userMicIconStatus.classList.add('on');

                // Restart Speech Recognition if supported
                if (recognition) {
                    try { recognition.start(); } catch (e) { }
                }
            } else {
                // Mic is OFF state
                btnToggleMic.classList.add('toggle-off');
                micIcon.innerText = 'mic_off';
                userMicIconStatus.innerText = 'mic_off';
                userMicIconStatus.classList.remove('on');
                userMicIconStatus.classList.add('off');

                // Stop Speech Recognition
                if (recognition) {
                    recognition.stop();
                }
            }
        });
    }

    if (btnToggleCam && camIcon && localStream) {
        if (!isCamOn) {
            btnToggleCam.classList.add('toggle-off');
            camIcon.innerText = 'videocam_off';
        } else {
            btnToggleCam.classList.remove('toggle-off');
        }

        btnToggleCam.addEventListener('click', () => {
            isCamOn = !isCamOn;

            // Actual Video Track toggling
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = isCamOn;
            }

            if (isCamOn) {
                // Cam is ON
                btnToggleCam.classList.remove('toggle-off');
                camIcon.innerText = 'videocam';
                localVideo.style.display = 'block';
                localAvatar.style.display = 'none';
            } else {
                // Cam is OFF
                btnToggleCam.classList.add('toggle-off');
                camIcon.innerText = 'videocam_off';
                localVideo.style.display = 'none';
                localAvatar.style.display = 'flex';
            }
        });
    }

});

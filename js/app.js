document.addEventListener('DOMContentLoaded', () => {

    // --- Authentication Wall ---
    if (sessionStorage.getItem('quest_user_logged_in') !== 'true') {
        window.location.replace('login.html');
        return; // Halt further execution
    }

    // Select all the dock buttons
    const dockItems = document.querySelectorAll('.dock-item');
    const statusHint = document.getElementById('statusHint');
    const btnLogout = document.getElementById('btnLogout');

    // Handle Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            sessionStorage.removeItem('quest_user_logged_in');
            sessionStorage.removeItem('quest_user_id');
            sessionStorage.removeItem('quest_user_name');
            window.location.replace('login.html');
        });
    }

    // Hint messages based on section
    const hints = {
        'Vbox': 'Conéctate a videollamadas seguras y accesibles. (Estilo Meet/Zoom)',
        'Juegos': 'Disfruta de juegos adaptados para discapacidad visual y auditiva.',
        'BioD': 'Interactúa con la comunidad en nuestra red social integrada.',
        'Documentación': 'Aprende sobre cómo usar nuestras herramientas de accesibilidad.'
    };

    // Default hint
    const defaultHint = 'Explora las opciones para comenzar. Esta plataforma está optimizada para asistencia visual y auditiva.';

    // Sound effect simulation (optional, good for accessibility feedback)
    // We won't play real audio to avoid abrupt noise, but we setup the structure
    const playHoverSound = () => {
        // Logic for subtle UI tick would go here if audio files were provided
        // console.log("bloop"); 
    };

    // Modal elements (used for WIP alerts and Disclaimers on index)
    const infoModal = document.getElementById('infoModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const btnModalClose = document.getElementById('btnModalClose');

    if (btnModalClose && infoModal) {
        btnModalClose.addEventListener('click', () => {
            infoModal.style.display = 'none';
        });
    }

    dockItems.forEach(item => {
        // Get the title to match with hints dictionary
        const title = item.querySelector('h3').innerText;

        item.addEventListener('mouseenter', () => {
            statusHint.textContent = hints[title] || defaultHint;
            statusHint.classList.add('active');
            playHoverSound();

            // 3D Tilt Effect on hover
            item.style.transform = 'translateY(-5px) scale(1.02)';
        });

        item.addEventListener('mouseleave', () => {
            statusHint.textContent = defaultHint;
            statusHint.classList.remove('active');

            // Reset 3D effect
            item.style.transform = 'translateY(0) scale(1)';
        });

        // Add 3D Mouse tracking effect inside the button for Meta Quest vibe
        item.addEventListener('mousemove', (e) => {
            const rect = item.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Move the background glow based on mouse position
            const glow = item.querySelector('.hover-glow');
            if (glow) {
                glow.style.left = `${x}px`;
                glow.style.top = `${y}px`;
            }
        });

        // Click handler
        item.addEventListener('click', () => {
            // Visual feedback
            item.style.transform = 'scale(0.95)';
            setTimeout(() => {
                item.style.transform = 'scale(1.02)';
            }, 150);

            // Handle navigation for Vbox (Require Login)
            if (title === 'Vbox') {
                // If user mock logged in during this session, let them pass
                if (sessionStorage.getItem('quest_user_logged_in') === 'true') {
                    statusHint.textContent = `Abriendo Sala de Espera Vbox...`;
                    statusHint.style.color = 'var(--q-accent)';
                    setTimeout(() => {
                        window.location.href = 'lobby.html';
                    }, 300);
                } else {
                    // Otherwise, force login by redirecting to login page
                    statusHint.textContent = `Redirigiendo al inicio de sesión...`;
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 300);
                }
            }
            else if (title === 'Documentación') {
                // Show Legal Disclaimer
                if (infoModal) {
                    modalTitle.innerText = "Aviso Legal - Proyecto Educativo";
                    modalTitle.style.color = "var(--q-error)";
                    modalBody.innerHTML = `
                        Esta página web es parte de un proyecto escolar/educativo que busca potenciar nuestras habilidades de desarrollo.<br><br>
                        Deseamos especificar que en caso de que la página sea vulnerada (hackeada), <b>no seremos responsables del uso indebido</b>. 
                        No obstante, actuaremos proactivamente: deshabilitaremos la base de datos y daremos de baja el dominio en caso de que ocurran situaciones de fuerza mayor.<br><br>
                        <i>Términos y condiciones y derechos reservados.</i>
                    `;
                    infoModal.style.display = 'flex';
                }
            }
            else if (title === 'Juegos') {
                statusHint.textContent = `Abriendo Zona Arcade...`;
                statusHint.style.color = '#38bdf8'; // un color acorde a la ui
                setTimeout(() => {
                    window.location.href = 'Games.html';
                }, 300);
            }
            else if (title === 'BioD') {
                statusHint.textContent = `Abriendo Comunidad Social BioD...`;
                statusHint.style.color = '#a855f7'; 
                setTimeout(() => {
                    window.location.href = 'BioD.html';
                }, 300);
            }
            else {
                if (infoModal) {
                    modalTitle.innerText = "Trabajando en ello...";
                    modalTitle.style.color = "var(--q-warning)";
                    modalBody.innerHTML = `El módulo de <b>${title}</b> se encuentra actualmente en desarrollo y pronto estará disponible. <br><br>¡Gracias por tu paciencia!`;
                    infoModal.style.display = 'flex';
                }
            }
        });

        // Accessibility Support (keyboard focus)
        item.addEventListener('focus', () => {
            statusHint.textContent = hints[title] || defaultHint;
            statusHint.classList.add('active');
        });

        item.addEventListener('blur', () => {
            statusHint.textContent = defaultHint;
            statusHint.classList.remove('active');
        });
    });

    // Subtly move the dock based on mouse movement globally for parallax
    const dock = document.querySelector('.glass-dock');
    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 10;
        const y = (e.clientY / window.innerHeight - 0.5) * 10;
        dock.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${-y}deg)`;
    });
});

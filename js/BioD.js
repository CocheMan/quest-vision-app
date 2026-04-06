// BioD.js - Simulador básico de Chat sin backend real para propósitos de maquetación (Mockup)

document.addEventListener('DOMContentLoaded', () => {

    const chatInput = document.getElementById('chatInput');
    const btnSend = document.getElementById('btnSend');
    const messagesContainer = document.getElementById('messagesContainer');

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Obtener hora actual para el mensaje
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        // Crear contenedor del mensaje enviado (HTML)
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message sent';
        
        msgDiv.innerHTML = `
            <div class="bubble">
                ${escapeHTML(text)}
                <span class="msg-time">${timeString}</span>
            </div>
        `;

        // Agregar al DOM
        messagesContainer.appendChild(msgDiv);

        // Limpiar input y scrollear al final
        chatInput.value = '';
        scrollToBottom();

        // OPCIONAL: Simular que la otra persona lee y te manda un "escribiendo..." y luego responde (Mockup Effect)
        simulateReply();
    }

    // Prevención básica de inyección HTML para los mensajes escritos
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Scroll to bottom on init
    scrollToBottom();

    // Eventos 
    btnSend.addEventListener('click', sendMessage);

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Simula una pequeña respuesta automática para que parezca que funciona
    function simulateReply() {
        setTimeout(() => {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');

            // Crear el elemento
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message received';
            
            msgDiv.innerHTML = `
                <img src="https://i.pravatar.cc/150?img=47" alt="María" class="msg-avatar">
                <div class="bubble">
                    Estaría muy cool implementar eso. Te aviso cuando lo tenga listo.
                    <span class="msg-time">${hours}:${minutes}</span>
                </div>
            `;

            messagesContainer.appendChild(msgDiv);
            scrollToBottom();
        }, 3000); // responde a los 3 segundos
    }
});

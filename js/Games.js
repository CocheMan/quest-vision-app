// Games.js - Lógica interactiva del hub

document.addEventListener('DOMContentLoaded', () => {
    // Pequeño efecto dinámico al cargar
    const cards = document.querySelectorAll('.game-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 150 * index + 100);
    });
});

// Función para navegar hacia el juego seleccionado
function openGame(gamePageUrl) {
    // Agregamos un efecto de salida antes de navegar
    document.body.style.transition = 'opacity 0.4s ease';
    document.body.style.opacity = '0';
    
    setTimeout(() => {
        window.location.href = gamePageUrl;
    }, 400);
}

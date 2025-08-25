// CONFIGURACIÓN
const API_URL = "/api/data"; // Usaremos la misma ruta de proxy en Netlify

// --- LÓGICA DE LA APLICACIÓN ---

let allMatches = [];

// CORRECCIÓN: Unificamos toda la lógica de inicialización en un solo listener.
document.addEventListener('DOMContentLoaded', () => {
    // Inicialización del Tablón de Partidos
    fetchMatches();
    document.getElementById('date-filter').addEventListener('input', applyFilters);
    document.getElementById('level-filter').addEventListener('input', applyFilters);
    document.getElementById('location-filter').addEventListener('change', applyFilters);
    document.getElementById('slots-filter').addEventListener('change', applyFilters);
    document.getElementById('time-filter').addEventListener('change', applyFilters);

    // Inicialización del Formulario de Alertas
    const alertForm = document.getElementById('alert-form');
    if(alertForm) {
        alertForm.addEventListener('submit', handleAlertFormSubmit);
    }

    const anyDateBtn = document.getElementById('any-date-btn');
    if(anyDateBtn) {
        anyDateBtn.addEventListener('click', () => {
            const dateInput = document.getElementById('alert-fecha');
            dateInput.value = ''; // Limpia el campo de fecha
            dateInput.dispatchEvent(new Event('input')); // Para que los filtros se den cuenta
        });
    }
});


async function fetchMatches() {
    const loader = document.getElementById('loader');
    const container = document.getElementById('matches-container');
    loader.style.display = 'block';
    container.innerHTML = '';

    try {
        const response = await fetch(`${API_URL}?endpoint=getPublicMatches`);
        const result = await response.json();

        if (result.success && result.data) {
            allMatches = result.data;
            renderMatches(allMatches);
        } else {
            throw new Error(result.error || 'No se pudieron cargar las partidas.');
        }
    } catch (error) {
        container.innerHTML = `<p style="color: red; text-align: center;">${error.message}</p>`;
    } finally {
        loader.style.display = 'none';
    }
}

function renderMatches(matches) {
    const container = document.getElementById('matches-container');
    container.innerHTML = '';

    if (matches.length === 0) {
        container.innerHTML = '<p style="text-align: center; margin-top: 20px;">No hay partidas que coincidan con tu búsqueda.</p>';
        return;
    }

    matches.forEach(match => {
        const card = document.createElement('div');
        card.className = 'match-card';
        
        const fecha = new Date(match.fecha + 'T00:00:00');
        const fechaStr = fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

        let playersHtml = '<h3>Jugadores Apuntados:</h3>';
        if (match.jugadores.length > 0) {
            match.jugadores.forEach(p => {
                playersHtml += `<div class="player">${p.nombre} (Nivel: ${p.nivel || 'N/A'})</div>`;
            });
        } else {
            playersHtml += '<div class="player">¡Sé el primero en apuntarte!</div>';
        }

        card.innerHTML = `
            <h2>${match.pista}</h2>
            <div class="info"><strong>Fecha:</strong> ${fechaStr}</div>
            <div class="info"><strong>Hora:</strong> ${match.hora}</div>
            <div class="status">🔥 ¡Quedan ${match.plazas_libres} plazas libres!</div>
            <div class="players-list">${playersHtml}</div>
        `;
        container.appendChild(card);
    });
}

function applyFilters() {
    const dateFilter = document.getElementById('date-filter').value;
    const levelFilter = document.getElementById('level-filter').value.toLowerCase().trim();
    const locationFilter = document.getElementById('location-filter').value;
    const slotsFilter = document.getElementById('slots-filter').value;
    const timeFilter = document.getElementById('time-filter').value;

    let filteredMatches = allMatches.filter(match => {
        const dateMatch = !dateFilter || match.fecha === dateFilter;
        const locationMatch = !locationFilter || (match.pista && match.pista.toLowerCase().includes(locationFilter));
        const slotsMatch = !slotsFilter || match.plazas_libres >= parseInt(slotsFilter);
        const levelMatch = !levelFilter || match.jugadores.some(p => p.nivel && String(p.nivel).toLowerCase().includes(levelFilter));
        
        const horaMatch = !timeFilter || (()=>{
            const hora = parseInt(String(match.hora).split(':')[0]);
            if(timeFilter === 'mañana') return hora < 14;
            if(timeFilter === 'tarde') return hora >= 14 && hora < 18;
            if(timeFilter === 'noche') return hora >= 18;
            return true;
        })();

        return dateMatch && locationMatch && slotsMatch && levelMatch && horaMatch;
    });

    renderMatches(filteredMatches);
}

async function handleAlertFormSubmit(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('form-status');
    statusDiv.textContent = 'Guardando alerta...';
    statusDiv.style.color = '#555';

    const alertData = {
        plazas: document.getElementById('alert-plazas').value,
        fecha: document.getElementById('alert-fecha').value || 'cualquiera',
        ubicacion: document.getElementById('alert-ubicacion').value,
        horaInicio: document.getElementById('alert-hora-inicio').value,
        horaFin: document.getElementById('alert-hora-fin').value,
        nivel: document.getElementById('alert-nivel').value,
        telegramId: document.getElementById('alert-telegram-id').value.trim()
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveAlert',
                data: alertData
            })
        });
        const result = await response.json();
        
        if (result.success) {
            statusDiv.textContent = result.message;
            statusDiv.style.color = '#28a745';
            document.getElementById('alert-form').reset();
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        statusDiv.textContent = `Error: ${error.message}`;
        statusDiv.style.color = '#dc3545';
    }
}
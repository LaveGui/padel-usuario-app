// CONFIGURACIÓN
const API_URL = "/api/data"; // Usaremos la misma ruta de proxy en Netlify

// --- LÓGICA DE LA APLICACIÓN ---

let allMatches = [];
let leagueData = {}; // Para la pestaña "Liga"


// --- Listener Principal Unificado ---
// --- Listener Principal Unificado ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica de Pestañas ---
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            contents.forEach(content => content.classList.remove('active'));
            document.getElementById(`tab-content-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // --- Inicialización de la Pestaña LIGA ---
    fetchAndRenderLeague();
    document.getElementById('team-filter').addEventListener('change', handleTeamSelection);
    document.getElementById('add-result-main-btn').addEventListener('click', () => openResultModal());
    document.getElementById('result-form').addEventListener('submit', submitMatchResult);
    document.getElementById('modal-close-btn').addEventListener('click', () => document.getElementById('result-modal').classList.add('hidden'));

    // Lógica del Tablón de Partidos
    fetchMatches();
    populateTimeFilters(); // <-- NUEVO: Llenamos los select de hora
    document.getElementById('date-filter').addEventListener('input', applyFilters);
    document.getElementById('level-filter').addEventListener('input', applyFilters);
    document.getElementById('location-filter').addEventListener('change', applyFilters);
    document.getElementById('time-from-filter').addEventListener('change', applyFilters); // <-- NUEVO
    document.getElementById('time-to-filter').addEventListener('change', applyFilters); // <-- NUEVO

    // Lógica del Formulario de Alertas
    const alertForm = document.getElementById('alert-form');
    if(alertForm) {
        alertForm.addEventListener('submit', handleAlertFormSubmit);
    }
});


async function fetchAndRenderLeague() {
    // Aquí podrías añadir un loader específico para la liga
    try {
        const response = await fetch(`${API_URL}?endpoint=getLeagueData`);
        const result = await response.json();
        if (result.success) {
            leagueData = result.data;
            populateTeamFilter(leagueData.clasificacion);
            renderClassificationTable(leagueData.clasificacion);
            renderMatchesList(leagueData.partidos);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error("Error al cargar datos de la liga:", error);
        // Aquí podrías mostrar un error en la UI
    }
}

function populateTeamFilter(classification) {
    const select = document.getElementById('team-filter');
    select.innerHTML = '<option value="">Selecciona tu pareja...</option>';
    classification.forEach(team => {
        select.innerHTML += `<option value="${team.Numero}">${team.Pareja}</option>`;
    });
}

function renderClassificationTable(classification) {
    const tableBody = document.getElementById('classification-table-body');
    tableBody.innerHTML = '';
    classification.forEach((team, index) => {
        const row = document.createElement('tr');
        row.dataset.teamId = team.Numero;
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${team.Pareja}</td>
            <td>${team.PJ}</td>
            <td>${team.Puntos}</td>
            <td>${team.DS}</td>
            <td>${team.DJ}</td>
        `;
        tableBody.appendChild(row);
    });
}

function renderMatchesList(matches) {
    const container = document.getElementById('matches-list-container');
    container.innerHTML = '';
    matches.forEach(match => {
        const matchEl = document.createElement('div');
        matchEl.className = 'match-item';
        matchEl.dataset.team1Id = match['Numero Pareja 1'];
        matchEl.dataset.team2Id = match['Numero Pareja 2'];
        
        const teams = `<span>${match['Nombre Pareja 1']}</span> vs <span>${match['Nombre Pareja 2']}</span>`;
        let resultHtml;

        if (match.Estado === 'Jugado') {
            resultHtml = `<div class="match-result">${match.Resultado}</div>`;
        } else {
            matchEl.classList.add('pending');
            matchEl.dataset.matchId = match['ID Partido'];
            resultHtml = `<div class="match-result">Añadir resultado</div>`;
            matchEl.addEventListener('click', () => openResultModal(match['ID Partido'], match['Nombre Pareja 1'], match['Nombre Pareja 2']));
        }
        
        matchEl.innerHTML = `<div class="match-teams">${teams}</div>${resultHtml}`;
        container.appendChild(matchEl);
    });
}

function handleTeamSelection(event) {
    const selectedTeamId = event.target.value;
    const statsContainer = document.getElementById('stats-cards-container');

    // Limpiar highlights anteriores
    document.querySelectorAll('#classification-table-body tr, .match-item').forEach(el => el.classList.remove('highlight'));
    
    if (!selectedTeamId) {
        statsContainer.classList.add('hidden');
        return;
    }

    // Mostrar highlights
    document.querySelector(`#classification-table-body tr[data-team-id='${selectedTeamId}']`).classList.add('highlight');
    document.querySelectorAll(`.match-item[data-team1-id='${selectedTeamId}'], .match-item[data-team2-id='${selectedTeamId}']`).forEach(el => el.classList.add('highlight'));

    // Rellenar y mostrar tarjetas de stats
    const teamData = leagueData.clasificacion.find(t => t.Numero == selectedTeamId);
    const teamPosition = leagueData.clasificacion.findIndex(t => t.Numero == selectedTeamId) + 1;
    if(teamData) {
        document.getElementById('stat-posicion').textContent = `#${teamPosition}`;
        document.getElementById('stat-puntos').textContent = teamData.Puntos;
        document.getElementById('stat-partidos').textContent = `${teamData.PJ}/10`;
        statsContainer.classList.remove('hidden');
    }
}

function openResultModal(matchId = null, team1Name = '', team2Name = '') {
    const modal = document.getElementById('result-modal');
    document.getElementById('result-form').reset();
    document.getElementById('result-form-status').textContent = '';
    
    // Si no se provee un ID, es un resultado "manual", no lo manejamos aún
    if(!matchId) { 
        alert("Por favor, añade el resultado haciendo clic en un partido pendiente.");
        return;
    }

    document.getElementById('match-id-input').value = matchId;
    document.getElementById('modal-team1-name').textContent = team1Name;
    document.getElementById('modal-team2-name').textContent = team2Name;
    
    modal.classList.remove('hidden');
}

async function submitMatchResult(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('result-form-status');
    statusDiv.textContent = 'Guardando...';

    const data = {
        partidoId: document.getElementById('match-id-input').value,
        resultadoStr: document.getElementById('result-string').value
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'addMatchResult', data: data })
        });
        const result = await response.json();
        if (result.success) {
            leagueData = result.data; // Actualizamos los datos con la respuesta del servidor
            renderClassificationTable(leagueData.clasificacion);
            renderMatchesList(leagueData.partidos);
            document.getElementById('result-modal').classList.add('hidden');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        statusDiv.textContent = `Error: ${error.message}`;
    }
}
function populateTimeFilters() {
    const fromSelect = document.getElementById('time-from-filter');
    const toSelect = document.getElementById('time-to-filter');
    fromSelect.innerHTML = '<option value="">Desde...</option>';
    toSelect.innerHTML = '<option value="">Hasta...</option>';

    for (let h = 8; h <= 23; h++) {
        for (let m = 0; m < 60; m += 30) {
            if (h === 23 && m === 30) continue; // La última hora es 23:00

            const hourStr = String(h).padStart(2, '0');
            const minStr = String(m).padStart(2, '0');
            const timeValue = `${hourStr}:${minStr}`;
            
            fromSelect.innerHTML += `<option value="${timeValue}">${timeValue}</option>`;
            toSelect.innerHTML += `<option value="${timeValue}">${timeValue}</option>`;
        }
    }
    toSelect.innerHTML += `<option value="23:30">23:30</option>`; // Añadimos la hora final
}


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
    const timeFromFilter = document.getElementById('time-from-filter').value;
    const timeToFilter = document.getElementById('time-to-filter').value;

    let filteredMatches = allMatches.filter(match => {
        const dateMatch = !dateFilter || match.fecha === dateFilter;
        const locationMatch = !locationFilter || (match.pista && match.pista.toLowerCase().includes(locationFilter));
        const levelMatch = !levelFilter || match.jugadores.some(p => p.nivel && String(p.nivel).toLowerCase().includes(levelFilter));

        // Lógica de Hora Actualizada
        const matchTime = match.hora;
        const timeFromMatch = !timeFromFilter || matchTime >= timeFromFilter;
        const timeToMatch = !timeToFilter || matchTime <= timeToFilter;
        
        return dateMatch && locationMatch && levelMatch && timeFromMatch && timeToMatch;
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
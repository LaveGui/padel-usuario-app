// CONFIGURACIÓN
const API_URL = "/api/data"; 

// --- ALMACENES DE DATOS GLOBALES ---
let allPublicMatches = []; // Almacena todas las partidas de la pestaña "Buscar Pista"
let leagueData = {};     // Almacena todos los datos de la pestaña "Liga"

// --- Listener Principal Unificado ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica Común de Pestañas ---
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

    // --- Inicialización de cada Pestaña ---
    initLeagueTab();
    initSearchTab();
    initAlertsTab();
});

// ============================================================
// ========= PESTAÑA "LIGA" ===================================
// ============================================================
function initLeagueTab() {
    document.getElementById('team-filter').addEventListener('change', handleTeamSelection);
    document.getElementById('result-form').addEventListener('submit', submitMatchResult);
    document.getElementById('modal-close-btn').addEventListener('click', () => document.getElementById('result-modal').classList.add('hidden'));
    fetchAndRenderLeague();
}

async function fetchAndRenderLeague() {
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
        
        let team1Name = `<span>${match['Nombre Pareja 1']}</span>`;
        let team2Name = `<span>${match['Nombre Pareja 2']}</span>`;

        if (match.ganador == 1) {
            team1Name = `<strong class="winner">🏆 ${match['Nombre Pareja 1']}</strong>`;
        } else if (match.ganador == 2) {
            team2Name = `<strong class="winner">🏆 ${match['Nombre Pareja 2']}</strong>`;
        }
        const teams = `${team1Name} vs ${team2Name}`;
        
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

    document.querySelectorAll('#classification-table-body tr, .match-item').forEach(el => el.classList.remove('highlight'));
    
    if (!selectedTeamId) {
        statsContainer.classList.add('hidden');
        return;
    }

    document.querySelector(`#classification-table-body tr[data-team-id='${selectedTeamId}']`).classList.add('highlight');
    document.querySelectorAll(`.match-item[data-team1-id='${selectedTeamId}'], .match-item[data-team2-id='${selectedTeamId}']`).forEach(el => el.classList.add('highlight'));

    const teamData = leagueData.clasificacion.find(t => t.Numero == selectedTeamId);
    const teamPosition = leagueData.clasificacion.findIndex(t => t.Numero == selectedTeamId) + 1;
    if(teamData) {
        document.getElementById('stat-posicion').textContent = `#${teamPosition}`;
        document.getElementById('stat-puntos').textContent = teamData.Puntos;
        document.getElementById('stat-partidos').textContent = `${teamData.PJ}/10`; // Asumiendo 10 partidos
        statsContainer.classList.remove('hidden');
    }
}

function openResultModal(matchId, team1Name, team2Name) {
    const modal = document.getElementById('result-modal');
    document.getElementById('result-form').reset();
    document.getElementById('result-form-status').textContent = '';
    
    document.getElementById('match-id-input').value = matchId;
    document.getElementById('modal-team1-name').textContent = team1Name;
    document.getElementById('modal-team2-name').textContent = team2Name;
    
    modal.classList.remove('hidden');
}

async function submitMatchResult(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('result-form-status');
    statusDiv.textContent = 'Guardando...';
    statusDiv.style.color = '#555';

    const data = {
        partidoId: document.getElementById('match-id-input').value,
        set1_p1: document.getElementById('set1_p1').value, set1_p2: document.getElementById('set1_p2').value,
        set2_p1: document.getElementById('set2_p1').value, set2_p2: document.getElementById('set2_p2').value,
        set3_p1: document.getElementById('set3_p1').value, set3_p2: document.getElementById('set3_p2').value,
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'addMatchResult', data: data })
        });
        const result = await response.json();
        if (result.success) {
            leagueData = result.data; // Actualizamos los datos de la liga
            renderClassificationTable(leagueData.clasificacion);
            renderMatchesList(leagueData.partidos);
            document.getElementById('result-modal').classList.add('hidden');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        statusDiv.textContent = `Error: ${error.message}`;
        statusDiv.style.color = '#dc3545';
    }
}


// ============================================================
// ========= PESTAÑA "BUSCAR PISTA" ===========================
// ============================================================

function initSearchTab() {
    // Poblar los filtros con valores dinámicos
    populateDateFilters();
    populateTimeFilters();
    populateLevelFilter();

    // Configurar listeners del formulario
    document.getElementById('search-type-filter').addEventListener('change', toggleLevelFilter);
    document.getElementById('search-form').addEventListener('submit', (event) => {
        event.preventDefault(); // Evitamos que la página se recargue
        applyMatchesFilter();
    });

    // Cargar los datos de las partidas una sola vez
    fetchPublicMatches();
}

function populateDateFilters() {
    const fromDate = document.getElementById('date-from-filter');
    const toDate = document.getElementById('date-to-filter');
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 14);

    const formatDate = (date) => date.toISOString().split('T')[0];

    fromDate.value = formatDate(today);
    toDate.value = formatDate(maxDate);
    fromDate.min = formatDate(today);
    toDate.min = formatDate(today);
}

function populateTimeFilters() {
    const fromSelect = document.getElementById('time-from-filter');
    const toSelect = document.getElementById('time-to-filter');
    fromSelect.innerHTML = '<option value="">Desde...</option>';
    toSelect.innerHTML = '<option value="">Hasta...</option>';
    for (let h = 8; h <= 23; h++) {
        for (let m = 0; m < 60; m += 30) {
            if (h === 23 && m === 30) continue;
            const timeValue = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            fromSelect.innerHTML += `<option value="${timeValue}">${timeValue}</option>`;
            toSelect.innerHTML += `<option value="${timeValue}">${timeValue}</option>`;
        }
    }
    toSelect.innerHTML += `<option value="23:30">23:30</option>`;
}

function populateLevelFilter() {
    const select = document.getElementById('level-filter');
    const levels = ["3.75", "3.90", "4.0", "4.10", "4.20", "4.25", "4.30", "4.35"];
    levels.forEach(level => {
        select.innerHTML += `<option value="${level}">${level}</option>`;
    });
}

function toggleLevelFilter() {
    const searchType = document.getElementById('search-type-filter').value;
    const levelContainer = document.getElementById('level-filter-container');
    if (searchType === 'faltan' || searchType === 'ambas') {
        levelContainer.classList.remove('hidden');
    } else {
        levelContainer.classList.add('hidden');
    }
}

async function fetchPublicMatches() {
    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_URL}?endpoint=getPublicMatches`);
        const result = await response.json();
        if (result.success) {
            allPublicMatches = result.data;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        document.getElementById('search-results-container').innerHTML = `<p style="color: red; text-align: center;">${error.message}</p>`;
    } finally {
        loader.classList.add('hidden');
    }
}

function applyMatchesFilter() {
    // 1. Leer todos los valores de los filtros
    const fromDate = document.getElementById('date-from-filter').value;
    const toDate = document.getElementById('date-to-filter').value;
    const fromTime = document.getElementById('time-from-filter').value;
    const toTime = document.getElementById('time-to-filter').value;
    const location = document.getElementById('location-filter').value;
    const searchType = document.getElementById('search-type-filter').value;
    const level = document.getElementById('level-filter').value;

    const loader = document.getElementById('loader');
    const container = document.getElementById('search-results-container');
    loader.classList.remove('hidden');
    container.innerHTML = '';

    // 2. Filtrar el array `allPublicMatches`
    setTimeout(() => { // Simulamos una pequeña demora para que el loader sea visible
        const filtered = allPublicMatches.filter(match => {
            if (fromDate && match.fecha < fromDate) return false;
            if (toDate && match.fecha > toDate) return false;
            if (fromTime && match.hora < fromTime) return false;
            if (toTime && match.hora > toTime) return false;
            if (location && !match.pista.toLowerCase().includes(location)) return false;
            if (searchType === 'libre' && match.plazas_libres !== 4) return false;
            if (searchType === 'faltan' && match.plazas_libres === 4) return false;

            if ((searchType === 'faltan' || searchType === 'ambas') && level) {
                 if (match.jugadores.length === 0) return false; // Si no hay jugadores, no podemos filtrar por nivel
                 if (!match.jugadores.some(p => p.nivel == level)) return false;
            }
            return true;
        });

        // 3. Renderizar los resultados
        renderFilteredMatches(filtered);
        loader.classList.add('hidden');
    }, 250);
}

function renderFilteredMatches(matches) {
    const container = document.getElementById('search-results-container');
    container.innerHTML = '';

    if (matches.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No se han encontrado partidas que coincidan con tu búsqueda.</p>';
        return;
    }

    matches.forEach(match => {
        const card = document.createElement('div');
        card.className = 'card'; // Reutilizamos el estilo de 'card'
        
        const fecha = new Date(match.fecha + 'T00:00:00');
        const fechaStr = fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

        let playersHtml = '';
        if (match.jugadores.length > 0) {
            playersHtml = `
                <p><strong>Jugadores Apuntados:</strong></p>
                <ul>
                    ${match.jugadores.map(p => `<li>${p.nombre} (Nivel: ${p.nivel || 'N/A'})</li>`).join('')}
                </ul>`;
        } else {
            playersHtml = '<p>¡Sé el primero en apuntarte!</p>';
        }
        
        let statusText = match.plazas_libres === 4 ? `✅ <b>Pista Libre</b>` : `🔥 <b>¡Faltan ${match.plazas_libres}!</b>`;

        card.innerHTML = `
            <h3>${match.pista}</h3>
            <p><strong>${fechaStr}</strong> a las <strong>${match.hora}hs</strong></p>
            <p>${statusText}</p>
            ${playersHtml}
        `;
        container.appendChild(card);
    });
}

// ============================================================
// ========= PESTAÑA "CREAR ALERTA" ===========================
// ============================================================

function initAlertsTab() {
    const alertForm = document.getElementById('alert-form');
    if (alertForm) {
        alertForm.addEventListener('submit', handleAlertFormSubmit);
    }
}

async function handleAlertFormSubmit(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('form-status');
    statusDiv.textContent = 'Guardando alerta...';
    statusDiv.style.color = '#555';

    // Simplificamos la recolección de datos
    const alertData = {
        plazas: document.getElementById('alert-plazas').value,
        ubicacion: document.getElementById('alert-ubicacion').value,
        telegramId: document.getElementById('alert-telegram-id').value.trim()
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveAlert', data: alertData })
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
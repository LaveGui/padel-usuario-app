// CONFIGURACIÓN
const API_URL = "/api/data"; 

// --- ALMACENES DE DATOS GLOBALES ---
let allPublicMatches = []; // Almacena todas las partidas de la pestaña "Buscar Pista"
let leagueData = {};     // Almacena todos los datos de la pestaña "Liga"
let currentZone = 'A'; // NUEVO: Variable para saber la zona activa. Por defecto 'A'.


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

    // --- NUEVO: Listener para el botón "Cerrar" de la vista de éxito ---
    document.getElementById('modal-success-close-btn').addEventListener('click', () => {
        document.getElementById('result-modal').classList.add('hidden');
    });
    
    document.querySelectorAll('.zone-button').forEach(button => {
        button.addEventListener('click', () => {
            currentZone = button.dataset.zone;
            if (leagueData && leagueData.clasificacion) {
                renderZoneView(leagueData, null); 
            }
        });
    });

    const accordionHeader = document.querySelector('.accordion-header');
    if (accordionHeader) {
        accordionHeader.addEventListener('click', (event) => {
            if (event.target.closest('.telegram-button')) {
                return;
            }
            accordionHeader.parentElement.classList.toggle('expanded');
        });
    }

    fetchAndRenderLeague();
}

function showLeagueLoaders() {
    document.getElementById('classification-loader').classList.remove('hidden');
    document.getElementById('matches-loader').classList.remove('hidden');
    document.querySelector('.table-wrapper').classList.add('hidden');
    document.getElementById('matches-list-container').classList.add('hidden');
}

function hideLeagueLoaders() {
    document.getElementById('classification-loader').classList.add('hidden');
    document.getElementById('matches-loader').classList.add('hidden');
    document.querySelector('.table-wrapper').classList.remove('hidden');
    document.getElementById('matches-list-container').classList.remove('hidden');
}


async function fetchAndRenderLeague() {
    const cacheKey = 'padelLeagueData';
    const cachedDataString = localStorage.getItem(cacheKey);
    let cachedData = null;

    // 1. Intentar cargar datos desde la caché
    if (cachedDataString) {
        cachedData = JSON.parse(cachedDataString);
        leagueData = cachedData; // Actualizamos la variable global
        // Pasamos la clasificación cacheada para la renderización inicial. 
        // No hay "clasificación previa" en este punto, así que pasamos null.
        renderZoneView(cachedData, null); 
        populateTeamFilter(cachedData.clasificacion); // Rellenamos el filtro
        hideLeagueLoaders();
    } else {
        showLeagueLoaders();
    }

    // 2. Siempre buscar datos frescos de la API
    try {
        const response = await fetch(`${API_URL}?endpoint=getLeagueData`);
        const result = await response.json();

        if (result.success) {
            // 3. Actualizar la variable global y la caché
            leagueData = result.data;
            localStorage.setItem(cacheKey, JSON.stringify(leagueData));
            
            // 4. Volver a renderizar con datos frescos, pasando la caché como "datos previos"
            populateTeamFilter(leagueData.clasificacion);
            renderZoneView(leagueData, cachedData); 
        } else {
            if (!cachedData) {
                 throw new Error(result.error);
            }
        }
    } catch (error) {
        console.error("Error al cargar datos de la liga:", error);
        if (!cachedData) {
            document.getElementById('classification-loader').innerHTML = `<p style="color: red;">Error al cargar los datos.</p>`;
            document.getElementById('matches-loader').innerHTML = '';
        }
    } finally {
        hideLeagueLoaders();
    }
}

// NUEVA FUNCIÓN MEJORADA: Acepta datos actuales y previos
function renderZoneView(dataToRender, previousData) {
    document.querySelectorAll('.zone-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.zone === currentZone);
    });

    hideLeagueLoaders();

    const filteredClassification = dataToRender.clasificacion.filter(team => team.Zona === currentZone);
    
    // Obtenemos la clasificación previa de la misma zona para comparar.
    const previousClassification = previousData ? previousData.clasificacion.filter(team => team.Zona === currentZone) : null;
    renderClassificationTable(filteredClassification, previousClassification);

    const filteredMatches = dataToRender.partidos.filter(match => match.Zona === currentZone);
    renderMatchesList(filteredMatches);
}

function populateTeamFilter(classification) {
    const select = document.getElementById('team-filter');
    select.innerHTML = '<option value="">Selecciona tu pareja...</option>';
    classification.forEach(team => {
        select.innerHTML += `<option value="${team.Numero}">${team.Pareja}</option>`;
    });
}

/**
 * Dibuja la tabla de clasificación en el DOM.
 * v3: Añade el icono de racha (🔥) y las flechas de posición.
 */
function renderClassificationTable(classification, previousClassification) {
    const tableBody = document.getElementById('classification-table-body');
    tableBody.innerHTML = '';
    
    // Creamos un mapa de posiciones previas para una búsqueda rápida
    const previousPositions = {};
    if (previousClassification) {
        previousClassification.forEach((team, index) => {
            previousPositions[team.Numero] = index + 1;
        });
    }

    classification.forEach((team, index) => {
        const row = document.createElement('tr');
        row.dataset.teamId = team.Numero;

        // --- LÓGICA DE RACHAS (HOT STREAK) ---
        const teamName = team.isOnFire ? `${team.Pareja} 🔥` : team.Pareja;
        // --- FIN LÓGICA DE RACHAS ---

        let positionIndicator = '';
        const currentPosition = index + 1;
        const previousPosition = previousPositions[team.Numero];

        if (previousPosition && previousPosition !== currentPosition) {
            if (currentPosition < previousPosition) {
                positionIndicator = `<span class="pos-up"> ▲</span>`;
            } else {
                positionIndicator = `<span class="pos-down"> ▼</span>`;
            }
        }
        
        // La celda de Pareja ahora incluye el nombre, el icono de racha (si aplica) y el indicador de posición
        row.innerHTML = `
            <td>${currentPosition}</td>
            <td>${teamName}${positionIndicator}</td>
            <td>${team.PJ}</td>
            <td>${team.Puntos}</td>
            <td>${team.DS}</td>
            <td>${team.DJ}</td>
        `;
        tableBody.appendChild(row);
    });
}

function renderMatchesList(matches) { // La función ahora recibe datos ya filtrados
    const container = document.getElementById('matches-list-container');
    container.innerHTML = '';
    matches.forEach(match => {
        // ... (el interior de esta función no cambia, solo recibe menos datos)
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
    const telegramPrompt = document.getElementById('telegram-prompt-liga');
    
    document.querySelectorAll('#classification-table-body tr, .match-item').forEach(el => el.classList.remove('highlight'));
    
    if (!selectedTeamId) {
        statsContainer.classList.add('hidden');
        telegramPrompt.classList.add('hidden');
        return;
    }

    const teamData = leagueData.clasificacion.find(t => t.Numero == selectedTeamId);
    if (!teamData) return;

    // ... (Lógica del enlace dinámico de Telegram, sin cambios) ...
    const teamNameForUrl = teamData.Pareja.replace(/\s+/g, '-');
    const dynamicUrl = `https://t.me/PadelGuido1_bot?start=liga_team_${teamData.Numero}_${teamNameForUrl}`;
    document.getElementById('telegram-link-liga').href = dynamicUrl;

    if (teamData.Zona !== currentZone) {
        currentZone = teamData.Zona;
        renderZoneView(leagueData, null);
    }
    
    setTimeout(() => {
        const teamsInCurrentZone = leagueData.clasificacion.filter(t => t.Zona === currentZone);
        const teamPosition = teamsInCurrentZone.findIndex(t => t.Numero == selectedTeamId) + 1;
        
        // --- INICIO DE LA LÓGICA ACTUALIZADA ---
        document.getElementById('stat-posicion').textContent = `#${teamPosition}`;
        document.getElementById('stat-puntos').textContent = teamData.Puntos;
        
        const totalMatchesForZone = teamsInCurrentZone.length - 1;
        document.getElementById('stat-partidos').textContent = `${teamData.PJ}/${totalMatchesForZone}`;
        
        const evolucionEl = document.getElementById('stat-evolucion');
        const positionChange = teamData.positionChange;

        // Reseteamos clases y contenido
        evolucionEl.className = 'evolution-indicator';
        evolucionEl.textContent = '';

        if (positionChange > 0) {
            evolucionEl.textContent = `▲ +${positionChange}`;
            evolucionEl.classList.add('positive');
        } else if (positionChange < 0) {
            evolucionEl.textContent = `▼ ${positionChange}`;
            evolucionEl.classList.add('negative');
        } else {
            // Si no hay cambio, no mostramos nada para mantenerlo limpio
            evolucionEl.textContent = '';
        }
        // --- FIN DE LA LÓGICA ACTUALIZADA ---

        statsContainer.classList.remove('hidden');
        telegramPrompt.classList.remove('hidden');
        
        document.querySelector(`#classification-table-body tr[data-team-id='${selectedTeamId}']`)?.classList.add('highlight');
        document.querySelectorAll(`.match-item[data-team1-id='${selectedTeamId}'], .match-item[data-team2-id='${selectedTeamId}']`).forEach(el => el.classList.add('highlight'));
    }, 100);
}



function openResultModal(matchId, team1Name, team2Name) {
    const modal = document.getElementById('result-modal');
    // --- LÓGICA MEJORADA ---
    // Nos aseguramos de que al abrir, siempre se vea el formulario y no la vista de éxito
    document.getElementById('result-form-view').classList.remove('hidden');
    document.getElementById('result-success-view').classList.add('hidden');
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

    // --- LÓGICA MEJORADA: Paso 1 - Guardamos el contexto actual ---
    const teamFilter = document.getElementById('team-filter');
    const selectedTeamIdBeforeSubmit = teamFilter.value;

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
            // --- LÓGICA MEJORADA: Paso 2 - Actualizamos datos y mostramos éxito ---
            const cachedData = JSON.parse(localStorage.getItem('padelLeagueData') || '{}');
            leagueData = result.data;
            localStorage.setItem('padelLeagueData', JSON.stringify(leagueData));
            
            // Renderizamos la tabla de fondo con los datos nuevos
            renderZoneView(leagueData, cachedData);

            // Mostramos la vista de éxito
            document.getElementById('result-form-view').classList.add('hidden');
            document.getElementById('result-success-view').classList.remove('hidden');

            // --- LÓGICA MEJORADA: Paso 3 - Restauramos el contexto ---
            if (selectedTeamIdBeforeSubmit) {
                teamFilter.value = selectedTeamIdBeforeSubmit;
                // Disparamos el evento 'change' para que se actualicen las tarjetas y highlights
                teamFilter.dispatchEvent(new Event('change'));
            }

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
    populateTimeFilters('time-from-filter', 'time-to-filter');
    populateLevelFilter();

    // Configurar listeners del formulario
    document.getElementById('search-type-filter').addEventListener('change', toggleLevelFilter);
    document.getElementById('search-form').addEventListener('submit', (event) => {
        event.preventDefault(); // Evitamos que la página se recargue
        applyMatchesFilter();
    });

    // --- AÑADIDO: Listener para el nuevo botón ---
    // Esto hará que al pulsar nuestro nuevo botón, se haga 'clic' en la pestaña de Alertas.
    document.getElementById('go-to-alerts-btn').addEventListener('click', () => {
        document.querySelector('.tab-button[data-tab="alertas"]').click();
    });
    // --- FIN DEL AÑADIDO ---


    // Cargar los datos de las partidas una sola vez al cargar la pestaña por primera vez
    fetchPublicMatches();
}


function populateDateFilters() {
    const fromDateInput = document.getElementById('date-from-filter'); // Renombrado para claridad
    const toDateInput = document.getElementById('date-to-filter');     // Renombrado para claridad
    
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 14);

    const formatDate = (date) => date.toISOString().split('T')[0];

    fromDateInput.value = formatDate(today);
    // No prellenamos toDateInput para que la lógica de "fecha hasta vacía" funcione
    // toDateInput.value = formatDate(maxDate); // Eliminamos esto para permitir que esté vacío por defecto
    
    fromDateInput.min = formatDate(today);
    toDateInput.min = formatDate(today);
}


function populateTimeFilters(fromId, toId) {
    const fromSelect = document.getElementById(fromId);
    const toSelect = document.getElementById(toId);
    if (!fromSelect || !toSelect) return;
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

function populateLevelFilter(selectId = 'level-filter') {
    const select = document.getElementById(selectId);
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
            // Después de cargar, si no hay filtro aplicado, podríamos renderizar todo
            // Pero por ahora, mantenemos el placeholder hasta que el usuario busque explícitamente.
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        document.getElementById('search-results-container').innerHTML = `<p style="color: red; text-align: center;">Error al cargar partidas: ${error.message}. Intenta recargar la página.</p>`;
    } finally {
        loader.classList.add('hidden');
    }
}


function applyMatchesFilter() {
    // 1. Leer todos los valores de los filtros
    const fromDate = document.getElementById('date-from-filter').value;
    let toDate = document.getElementById('date-to-filter').value;
    const fromTime = document.getElementById('time-from-filter').value;
    const toTime = document.getElementById('time-to-filter').value;
    const location = document.getElementById('location-filter').value.toLowerCase();
    const searchType = document.getElementById('search-type-filter').value;
    const level = document.getElementById('level-filter').value;

    const loader = document.getElementById('loader');
    const container = document.getElementById('search-results-container');
    // --- AÑADIDO: Obtenemos el nuevo contenedor ---
    const alertPrompt = document.getElementById('alert-prompt-container');
    
    loader.classList.remove('hidden');
    container.innerHTML = ''; // Limpiamos los resultados anteriores
    alertPrompt.classList.add('hidden'); // Lo ocultamos al iniciar cada nueva búsqueda

    if (!toDate && fromDate) {
        toDate = fromDate; 
    }

    // 2. Filtrar el array `allPublicMatches`
    setTimeout(() => { 
        const filtered = allPublicMatches.filter(match => {
            // ... (lógica de filtrado que ya corregimos antes, no cambia) ...
            if (fromDate && match.fecha < fromDate) return false;
            if (toDate && match.fecha > toDate) return false;
            if (fromTime && match.hora < fromTime) return false;
            if (toTime && match.hora > toTime) return false;
            if (location && !match.pista.toLowerCase().includes(location)) return false;
            if (searchType === 'libre' && match.plazas_libres !== 4) return false;
            if (searchType === 'faltan' && match.plazas_libres === 4) return false;
            if (level && (searchType === 'faltan' || searchType === 'ambas')) {
                if (match.jugadores && match.jugadores.length > 0) {
                    const hasPlayerWithLevel = match.jugadores.some(p => p.nivel && p.nivel.toString() === level);
                    if (!hasPlayerWithLevel) return false;
                } else {
                    if (searchType === 'faltan') return false;
                }
            }
            return true;
        });

        // 3. Renderizar los resultados
        renderFilteredMatches(filtered);
        // --- AÑADIDO: Mostramos el contenedor del botón después de renderizar ---
        alertPrompt.classList.remove('hidden');
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
        card.className = 'card search-result-card'; // Añadimos una clase específica para resultados de búsqueda si quieres estilos distintos
        
        // Formateo de fecha más amigable
        // Aseguramos que la fecha sea un objeto Date válido para toLocaleDateString
        const fechaMatch = new Date(match.fecha + 'T00:00:00'); 
        const fechaStr = fechaMatch.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

        let playersHtml = '';
        if (match.jugadores && match.jugadores.length > 0) { // Aseguramos que 'jugadores' existe
            playersHtml = `
                <p><strong>Jugadores Apuntados:</strong></p>
                <ul>
                    ${match.jugadores.map(p => `<li>${p.nombre} (Nivel: ${p.nivel || 'N/A'})</li>`).join('')}
                </ul>`;
        } else {
            playersHtml = '<p>¡Sé el primero en apuntarte!</p>';
        }
        
        let statusText;
        if (match.plazas_libres === 4) {
            statusText = `✅ <b>Pista Libre</b>`;
        } else if (match.plazas_libres > 0) {
            statusText = `🔥 <b>¡Faltan ${match.plazas_libres} jugadores!</b>`;
        } else {
            statusText = `👥 Partido Completo`; // En caso de que se muestren partidos completos
        }
        
        // Aquí puedes incluir el botón de "Apuntarse" si la partida no está completa y hay plazas_libres
        let actionButton = '';
        if (match.plazas_libres > 0) {
            actionButton = `<button class="secondary-button join-match-button" data-match-id="${match.id}">¡Apuntarse!</button>`;
            // En un futuro, añadir un event listener para este botón
        }


        card.innerHTML = `
            <h3>${match.pista}</h3>
            <p><strong>${fechaStr}</strong> a las <strong>${match.hora}hs</strong></p>
            <p>${statusText}</p>
            ${playersHtml}
            ${actionButton}
        `;
        container.appendChild(card);
    });
}

// ============================================================
// ========= PESTAÑA "CREAR ALERTA" ===========================
// ============================================================

function initAlertsTab() {
    // ¡AQUÍ ESTÁ LA CORRECCIÓN CLAVE!
    // Se asegura de que los desplegables de hora y nivel se rellenen.
    populateTimeFilters('alert-hora-inicio', 'alert-hora-fin');
    populateLevelFilter('alert-nivel');
    
    const fromDate = document.getElementById('alert-fecha-desde');
    const today = new Date().toISOString().split('T')[0];
    if(fromDate) {
        fromDate.value = today;
        fromDate.min = today;
        document.getElementById('alert-fecha-hasta').min = today;
    }

    const plazasSelect = document.getElementById('alert-plazas');
    if(plazasSelect) {
        plazasSelect.addEventListener('change', () => {
            const searchType = plazasSelect.value;
            const levelContainer = document.getElementById('alert-level-container');
            if (searchType === 'faltan' || searchType === 'ambas') {
                levelContainer.classList.remove('hidden');
            } else {
                levelContainer.classList.add('hidden');
                document.getElementById('alert-nivel').value = '';
            }
        });
    }

    const alertForm = document.getElementById('alert-form');
    if (alertForm) {
        alertForm.addEventListener('submit', handleAlertFormSubmit);
    }
}

async function handleAlertFormSubmit(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('form-status');
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');

    statusDiv.textContent = 'Guardando alerta...';
    statusDiv.style.color = '#555';
    submitButton.disabled = true;

    const fechaDesde = document.getElementById('alert-fecha-desde').value;
    let fechaHasta = document.getElementById('alert-fecha-hasta').value;

    const alertData = {
        plazas: document.getElementById('alert-plazas').value,
        fecha: fechaDesde,
        // (Nota: El backend actualmente solo usa una fecha, pero enviamos el dato por si se mejora en el futuro)
        fecha_hasta: fechaHasta, 
        horaInicio: document.getElementById('alert-hora-inicio').value,
        horaFin: document.getElementById('alert-hora-fin').value,
        ubicacion: document.getElementById('alert-ubicacion').value,
        nivel: document.getElementById('alert-nivel').value,
        email: document.getElementById('alert-email').value.trim(),
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
            form.reset();
            document.getElementById('alert-fecha-desde').value = new Date().toISOString().split('T')[0];
            document.getElementById('alert-level-container').classList.add('hidden');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        statusDiv.textContent = `Error: ${error.message}`;
    } finally {
        submitButton.disabled = false;
    }
}

// CONFIGURACIÓN
const API_URL = "/api/data"; // Debería apuntar a tu API de Apps Script

// --- ESTADO GLOBAL ---
let leagueData = {};
let currentZoneClassification = 'A'; // Para la tabla de clasificación
let currentFilterZone = 'all'; // Para la gestión de partidos
let currentFilterEstado = 'all'; // Para la gestión de partidos

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // Listeners de Pestañas
    document.querySelectorAll('.tab-button').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-button, .tab-content').forEach(el => el.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-content-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // Listeners de Filtro de Zona (Clasificación)
    document.querySelectorAll('.zone-selector .zone-button').forEach(button => {
        button.addEventListener('click', () => {
            currentZoneClassification = button.dataset.zone;
            renderClassificationTable();
        });
    });

    // Listeners de Filtro de Partidos (Gestión de Partidos)
    document.querySelectorAll('.match-filters .filter-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const filterType = e.target.dataset.filterType;
            const filterValue = e.target.dataset.filterValue;

            // Remover 'active' de todos los botones del mismo tipo
            document.querySelectorAll(`.filter-button[data-filter-type="${filterType}"]`).forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            if (filterType === 'zona') {
                currentFilterZone = filterValue;
            } else if (filterType === 'estado') {
                currentFilterEstado = filterValue;
            }
            renderMatchesList(); // Volver a renderizar la lista con los nuevos filtros
        });
    });
    
    // Listeners del Modal
    document.getElementById('result-form').addEventListener('submit', submitMatchResult);
    document.getElementById('modal-close-btn').addEventListener('click', () => document.getElementById('result-modal').classList.add('hidden'));

    // Carga de datos inicial
    fetchAllData();
});

// --- CARGA DE DATOS ---
async function fetchAllData() {
    // Mostramos loaders si es necesario (se puede añadir un spinner, etc.)
    try {
        const [dashboardRes, leagueRes] = await Promise.all([
            fetch(`${API_URL}?endpoint=getAdminDashboardData`),
            fetch(`${API_URL}?endpoint=getLeagueData`)
        ]);

        const dashboardResult = await dashboardRes.json();
        if (dashboardResult.success) {
            renderDashboard(dashboardResult.data);
            renderLastUpdatedMatches(dashboardResult.data.lastUpdatedMatches);
        } else {
            console.error("Error al cargar datos del dashboard:", dashboardResult.error);
            alert("Error al cargar datos del dashboard.");
        }

        const leagueResult = await leagueRes.json();
        if (leagueResult.success) {
            leagueData = leagueResult.data;
            renderClassificationTable(); // Renderizar tabla de clasificación
            renderMatchesList(); // Renderizar lista de partidos
        } else {
            console.error("Error al cargar datos de la liga:", leagueResult.error);
            alert("Error al cargar datos de la liga.");
        }
    } catch (error) {
        console.error("Error general al cargar los datos del admin:", error);
        alert("No se pudieron cargar los datos del panel. Revisa la consola.");
    }
}

// --- RENDERIZADO ---
function renderDashboard(data) {
    document.getElementById('stat-progreso').textContent = data.progresoFase;
    document.getElementById('stat-partidos-a').textContent = data.partidosJugadosA;
    document.getElementById('stat-partidos-b').textContent = data.partidosJugadosB;

    const leadersA = document.getElementById('leaders-a');
    leadersA.innerHTML = '';
    data.lideresA.forEach((team, i) => leadersA.innerHTML += `<li><span class="team-name">${i+1}. ${team.Pareja}</span> <span class="team-stats">${team.Puntos} Pts | ${team.PJ} PJ</span></li>`);

    const leadersB = document.getElementById('leaders-b');
    leadersB.innerHTML = '';
    data.lideresB.forEach((team, i) => leadersB.innerHTML += `<li><span class="team-name">${i+1}. ${team.Pareja}</span> <span class="team-stats">${team.Puntos} Pts | ${team.PJ} PJ</span></li>`);
}

function renderLastUpdatedMatches(matches) {
    const container = document.getElementById('last-updated-matches-list');
    container.innerHTML = '';
    
    if (matches && matches.length > 0) {
        matches.forEach(match => {
            const matchCard = document.createElement('div');
            matchCard.className = 'last-match-card';
            
            // Nueva estructura HTML, más compacta y sin fecha/hora
            matchCard.innerHTML = `
                <div class="match-details">
                    <p class="teams">${match.pareja1} vs ${match.pareja2}</p>
                    <p class="result">${match.resultado}</p>
                </div>
                <div class="match-actions">
                    <button class="action-btn edit" title="Editar Resultado" data-match-id="${match.id}">✏️</button>
                    <button class="action-btn delete" title="Eliminar Resultado" data-match-id="${match.id}">🗑️</button>
                </div>
            `;
            container.appendChild(matchCard);
        });

        // Reasignamos los listeners a los nuevos botones
        document.querySelectorAll('#last-updated-matches-list .edit').forEach(btn => {
            btn.addEventListener('click', (e) => openResultModal(e.target.closest('.action-btn').dataset.matchId));
        });
        document.querySelectorAll('#last-updated-matches-list .delete').forEach(btn => {
            btn.addEventListener('click', (e) => handleDeleteMatch(e.target.closest('.action-btn').dataset.matchId));
        });

    } else {
        container.innerHTML = '<p style="text-align: center; color: var(--secondary-text-color);">No hay partidos registrados recientemente.</p>';
    }
}

function renderClassificationTable() {
    document.querySelectorAll('.zone-selector .zone-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.zone === currentZoneClassification);
    });
    const tableBody = document.getElementById('classification-table-body');
    tableBody.innerHTML = '';
    const filteredClassification = leagueData.clasificacion.filter(team => team.Zona === currentZoneClassification);
    
    filteredClassification.forEach((team, index) => {
        const row = document.createElement('tr');
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

function renderMatchesList() {
    const container = document.getElementById('matches-list-container');
    container.innerHTML = '';

    // Filtrar los partidos según los filtros seleccionados
    const filteredMatches = leagueData.partidos.filter(match => {
        const matchesZone = (currentFilterZone === 'all' || match.Zona === currentFilterZone);
        const matchesEstado = (currentFilterEstado === 'all' || match.Estado === currentFilterEstado);
        return matchesZone && matchesEstado;
    });

    if (filteredMatches.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--secondary-text-color);">No hay partidos que coincidan con los filtros.</p>';
        return;
    }

    filteredMatches.forEach(match => {
        const matchEl = document.createElement('div');
        matchEl.className = 'match-item';
        
        const team1Name = (match.ganador == 1) ? `<strong class="winner">${match['Nombre Pareja 1']}</strong>` : `<span>${match['Nombre Pareja 1']}</span>`;
        const team2Name = (match.ganador == 2) ? `<strong class="winner">${match['Nombre Pareja 2']}</strong>` : `<span>${match['Nombre Pareja 2']}</span>`;

        let resultHtml;
        let actionsHtml = '';

        if (match.Estado === 'Jugado') {
            resultHtml = `<div class="result">${match.Resultado}</div>`;
            actionsHtml = `
                <div class="match-actions">
                    <button class="action-btn edit" data-match-id="${match['ID Partido']}">✏️</button>
                    <button class="action-btn delete" data-match-id="${match['ID Partido']}">🗑️</button>
                </div>`;
        } else {
            resultHtml = `<div class="result pending">Pendiente</div>`;
            actionsHtml = `<div class="match-actions"><button class="primary-button add-result-btn" data-match-id="${match['ID Partido']}">Añadir Resultado</button></div>`;
        }
        
        matchEl.innerHTML = `
            <div class="match-info-display">
                <div class="teams">${team1Name} vs ${team2Name}</div>
                ${resultHtml}
            </div>
            ${actionsHtml}
        `;
        container.appendChild(matchEl);
    });

    // Añadir Event Listeners a los botones de la lista principal
    document.querySelectorAll('#matches-list-container .add-result-btn, #matches-list-container .edit').forEach(btn => {
        btn.addEventListener('click', (e) => openResultModal(e.target.dataset.matchId));
    });
    document.querySelectorAll('#matches-list-container .delete').forEach(btn => {
        btn.addEventListener('click', (e) => handleDeleteMatch(e.target.dataset.matchId));
    });
}

// --- ACCIONES ---
function openResultModal(matchId) {
    const modal = document.getElementById('result-modal');
    const form = document.getElementById('result-form');
    form.reset();
    document.getElementById('result-form-status').textContent = '';
    document.getElementById('result-form-status').classList.remove('error', 'success');


    const match = leagueData.partidos.find(p => p['ID Partido'] == matchId);
    if (!match) {
        console.error("Partido no encontrado:", matchId);
        return;
    }

    document.getElementById('modal-title').textContent = (match.Estado === 'Jugado') ? 'Editar Resultado' : 'Añadir Resultado';
    document.getElementById('match-id-input').value = matchId;
    document.getElementById('modal-team1-name').textContent = match['Nombre Pareja 1'];
    document.getElementById('modal-team2-name').textContent = match['Nombre Pareja 2'];
    
    if (match.Estado === 'Jugado' && match.Resultado) {
        const sets = match.Resultado.split(', ');
        if (sets[0]) {
            const [s1p1, s1p2] = sets[0].split('-');
            document.getElementById('set1_p1').value = s1p1;
            document.getElementById('set1_p2').value = s1p2;
        } else { /* default to empty */ }
        if (sets[1]) {
            const [s2p1, s2p2] = sets[1].split('-');
            document.getElementById('set2_p1').value = s2p1;
            document.getElementById('set2_p2').value = s2p2;
        } else { /* default to empty */ }
        if (sets[2]) {
            const [s3p1, s3p2] = sets[2].split('-');
            document.getElementById('set3_p1').value = s3p1;
            document.getElementById('set3_p2').value = s3p2;
        } else { /* default to empty */ }
    } else {
        document.getElementById('set1_p1').value = ''; document.getElementById('set1_p2').value = '';
        document.getElementById('set2_p1').value = ''; document.getElementById('set2_p2').value = '';
        document.getElementById('set3_p1').value = ''; document.getElementById('set3_p2').value = '';
    }

    modal.classList.remove('hidden');
}

async function submitMatchResult(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('result-form-status');
    statusDiv.textContent = 'Guardando...';
    statusDiv.classList.remove('error', 'success');

    const data = {
        partidoId: document.getElementById('match-id-input').value,
        set1_p1: document.getElementById('set1_p1').value, set1_p2: document.getElementById('set1_p2').value,
        set2_p1: document.getElementById('set2_p1').value, set2_p2: document.getElementById('set2_p2').value,
        set3_p1: document.getElementById('set3_p1').value, set3_p2: document.getElementById('set3_p2').value,
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'addMatchResult', data })
        });
        const result = await response.json();
        if (result.success) {
            statusDiv.textContent = '¡Resultado guardado con éxito!';
            statusDiv.classList.add('success');
            setTimeout(() => {
                document.getElementById('result-modal').classList.add('hidden');
                fetchAllData(); // Recargar todos los datos para actualizar el dashboard y listas
            }, 1500);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        statusDiv.textContent = `Error: ${error.message}`;
        statusDiv.classList.add('error');
        console.error("Error al guardar resultado:", error);
    }
}

async function handleDeleteMatch(matchId) {
    if (!confirm("¿Estás seguro de que quieres eliminar este resultado? La clasificación se recalculará.")) {
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'deleteMatchResult', data: { partidoId: matchId } })
        });
        const result = await response.json();
        if (result.success) {
            alert("Resultado eliminado y clasificación recalculada.");
            fetchAllData(); // Recargar todos los datos
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert(`Error al eliminar el resultado: ${error.message}`);
        console.error("Error al eliminar el resultado:", error);
    }
}
// CONFIGURACIÓN
const API_URL = "/api/data"; // Debería apuntar a tu API de Apps Script

// --- ESTADO GLOBAL ---
let leagueData = {};
let currentZone = 'A';

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

    // Listeners de Filtro de Zona
    document.querySelectorAll('.zone-button').forEach(button => {
        button.addEventListener('click', () => {
            currentZone = button.dataset.zone;
            renderZoneView();
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
    // Mostramos loaders si es necesario
    try {
        const [dashboardRes, leagueRes] = await Promise.all([
            fetch(`${API_URL}?endpoint=getAdminDashboardData`),
            fetch(`${API_URL}?endpoint=getLeagueData`)
        ]);

        const dashboardResult = await dashboardRes.json();
        if (dashboardResult.success) {
            renderDashboard(dashboardResult.data);
        }

        const leagueResult = await leagueRes.json();
        if (leagueResult.success) {
            leagueData = leagueResult.data;
            renderZoneView();
            renderMatchesList();
        }
    } catch (error) {
        console.error("Error al cargar los datos del admin:", error);
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
    data.lideresA.forEach((team, i) => leadersA.innerHTML += `<li><strong>${i+1}.</strong> ${team.Pareja}</li>`);

    const leadersB = document.getElementById('leaders-b');
    leadersB.innerHTML = '';
    data.lideresB.forEach((team, i) => leadersB.innerHTML += `<li><strong>${i+1}.</strong> ${team.Pareja}</li>`);
}

function renderZoneView() {
    document.querySelectorAll('.zone-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.zone === currentZone);
    });
    renderClassificationTable();
}

function renderClassificationTable() {
    const tableBody = document.getElementById('classification-table-body');
    tableBody.innerHTML = '';
    const filteredClassification = leagueData.clasificacion.filter(team => team.Zona === currentZone);
    
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
    leagueData.partidos.forEach(match => {
        const matchEl = document.createElement('div');
        matchEl.className = 'match-item';
        
        const team1Name = (match.ganador == 1) ? `<strong class="winner">${match['Nombre Pareja 1']}</strong>` : `<span>${match['Nombre Pareja 1']}</span>`;
        const team2Name = (match.ganador == 2) ? `<strong class="winner">${match['Nombre Pareja 2']}</strong>` : `<span>${match['Nombre Pareja 2']}</span>`;

        let resultHtml;
        let actionsHtml = '<div class="match-actions"></div>';

        if (match.Estado === 'Jugado') {
            resultHtml = `<strong>${match.Resultado}</strong>`;
            actionsHtml = `
                <div class="match-actions">
                    <button class="action-btn edit" data-match-id="${match['ID Partido']}">✏️</button>
                    <button class="action-btn delete" data-match-id="${match['ID Partido']}">🗑️</button>
                </div>`;
        } else {
            resultHtml = `<button class="primary-button add-result-btn" data-match-id="${match['ID Partido']}">Añadir Resultado</button>`;
        }
        
        matchEl.innerHTML = `
            <div>${team1Name} vs ${team2Name}</div>
            <div>${resultHtml}</div>
            ${actionsHtml}
        `;
        container.appendChild(matchEl);
    });

    // Añadir Event Listeners a los nuevos botones
    document.querySelectorAll('.add-result-btn, .edit').forEach(btn => {
        btn.addEventListener('click', (e) => openResultModal(e.target.dataset.matchId));
    });
    document.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => handleDeleteMatch(e.target.dataset.matchId));
    });
}

// --- ACCIONES ---
function openResultModal(matchId) {
    const modal = document.getElementById('result-modal');
    const form = document.getElementById('result-form');
    form.reset();
    document.getElementById('result-form-status').textContent = '';

    const match = leagueData.partidos.find(p => p['ID Partido'] == matchId);
    if (!match) return;

    document.getElementById('modal-title').textContent = (match.Estado === 'Jugado') ? 'Editar Resultado' : 'Añadir Resultado';
    document.getElementById('match-id-input').value = matchId;
    document.getElementById('modal-team1-name').textContent = match['Nombre Pareja 1'];
    document.getElementById('modal-team2-name').textContent = match['Nombre Pareja 2'];
    
    if (match.Estado === 'Jugado') {
        const sets = match.Resultado.split(', ');
        if (sets[0]) {
            const [s1p1, s1p2] = sets[0].split('-');
            document.getElementById('set1_p1').value = s1p1;
            document.getElementById('set1_p2').value = s1p2;
        }
        if (sets[1]) {
            const [s2p1, s2p2] = sets[1].split('-');
            document.getElementById('set2_p1').value = s2p1;
            document.getElementById('set2_p2').value = s2p2;
        }
        if (sets[2]) {
            const [s3p1, s3p2] = sets[2].split('-');
            document.getElementById('set3_p1').value = s3p1;
            document.getElementById('set3_p2').value = s3p2;
        }
    }

    modal.classList.remove('hidden');
}

async function submitMatchResult(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('result-form-status');
    statusDiv.textContent = 'Guardando...';

    const data = {
        partidoId: document.getElementById('match-id-input').value,
        set1_p1: document.getElementById('set1_p1').value, set1_p2: document.getElementById('set1_p2').value,
        set2_p1: document.getElementById('set2_p1').value, set2_p2: document.getElementById('set2_p2').value,
        set3_p1: document.getElementById('set3_p1').value, set3_p2: document.getElementById('set3_p2').value,
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'addMatchResult', data })
        });
        const result = await response.json();
        if (result.success) {
            document.getElementById('result-modal').classList.add('hidden');
            fetchAllData(); // Recargar todos los datos
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        statusDiv.textContent = `Error: ${error.message}`;
    }
}

async function handleDeleteMatch(matchId) {
    if (!confirm("¿Estás seguro de que quieres eliminar este resultado? La clasificación se recalculará.")) {
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteMatchResult', data: { partidoId } })
        });
        const result = await response.json();
        if (result.success) {
            fetchAllData(); // Recargar todos los datos
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert(`Error al eliminar el resultado: ${error.message}`);
    }
}
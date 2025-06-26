const BIN_ID = "6859f6548a456b7966b466c6";
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const MASTER_KEY = "$2a$10$CJN48O6SvqnObn0Z0zy0j.Vronnf/8J5ntOTNT5f4ZMhCsRguKcNe";

// Registrar el Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registrado con éxito:', registration);
      })
      .catch(error => {
        console.log('Error al registrar el Service Worker:', error);
      });
  });
}

// Sistema de modales
function showModal(options) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modalOverlay');
    const icon = document.getElementById('modalIcon');
    const iconSymbol = document.getElementById('modalIconSymbol');
    const title = document.getElementById('modalTitle');
    const message = document.getElementById('modalMessage');
    const buttonsContainer = document.getElementById('modalButtons');

    icon.className = `modal-icon ${options.type || 'question'}`;
    iconSymbol.className = options.icon || 'fas fa-question';
    title.textContent = options.title || 'Confirmación';
    message.textContent = options.message || '';

    buttonsContainer.innerHTML = '';
    options.buttons.forEach(button => {
      const btn = document.createElement('button');
      btn.className = `modal-btn ${button.class || 'secondary'}`;
      btn.textContent = button.text;
      btn.onclick = () => {
        hideModal();
        resolve(button.value);
      };
      buttonsContainer.appendChild(btn);
    });

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        hideModal();
        resolve(false);
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        hideModal();
        resolve(false);
      }
    };
  });
}

function hideModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  overlay.onclick = null;
}

function showSuccess(title, message) {
  return showModal({
    type: 'success',
    icon: 'fas fa-check',
    title: title,
    message: message,
    buttons: [{ text: 'Aceptar', class: 'primary', value: true }]
  });
}

function showError(title, message) {
  return showModal({
    type: 'error',
    icon: 'fas fa-exclamation-triangle',
    title: title,
    message: message,
    buttons: [{ text: 'Aceptar', class: 'danger', value: true }]
  });
}

function showConfirm(title, message) {
  return showModal({
    type: 'warning',
    icon: 'fas fa-question-circle',
    title: title,
    message: message,
    buttons: [
      { text: 'Cancelar', class: 'secondary', value: false },
      { text: 'Confirmar', class: 'warning', value: true }
    ]
  });
}

function showDeleteConfirm(title, message) {
  return showModal({
    type: 'error',
    icon: 'fas fa-trash',
    title: title,
    message: message,
    buttons: [
      { text: 'Cancelar', class: 'secondary', value: false },
      { text: 'Eliminar', class: 'danger', value: true }
    ]
  });
}

async function obtenerDatos() {
  if (!navigator.onLine) {
    const cachedData = localStorage.getItem('cachedRegistros');
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    showError('Sin Conexión', 'No hay datos disponibles sin conexión.');
    return [];
  }

  try {
    const response = await fetch(`${API_URL}/latest`, {
      headers: { "X-Master-Key": MASTER_KEY }
    });
    const data = await response.json();
    localStorage.setItem('cachedRegistros', JSON.stringify(data.record || []));
    return data.record || [];
  } catch (error) {
    console.error('Error obteniendo datos:', error);
    showError('Error', `No se pudieron cargar los datos: ${error.message}`);
    const cachedData = localStorage.getItem('cachedRegistros');
    return cachedData ? JSON.parse(cachedData) : [];
  }
}

async function guardarDatos(nuevosDatos) {
  if (!navigator.onLine) {
    const pendingActions = JSON.parse(localStorage.getItem('pendingActions') || '[]');
    pendingActions.push({ action: 'save', data: nuevosDatos });
    localStorage.setItem('pendingActions', JSON.stringify(pendingActions));
    showSuccess('Guardado Offline', 'Los cambios se guardarán cuando haya conexión.');
    localStorage.setItem('cachedRegistros', JSON.stringify(nuevosDatos));
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": MASTER_KEY
      },
      body: JSON.stringify(nuevosDatos)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error guardando datos: ${response.status} ${errorText}`);
    }
    localStorage.setItem('cachedRegistros', JSON.stringify(nuevosDatos));
  } catch (error) {
    console.error('Error guardando datos:', error);
    throw error;
  }
}

async function sincronizarAccionesPendientes() {
  if (!navigator.onLine) return;
  const pendingActions = JSON.parse(localStorage.getItem('pendingActions') || '[]');
  if (pendingActions.length === 0) return;

  try {
    for (const action of pendingActions) {
      if (action.action === 'save') {
        await guardarDatos(action.data);
      }
    }
    localStorage.removeItem('pendingActions');
    showSuccess('Sincronización Completada', 'Todas las acciones pendientes se han sincronizado.');
    render();
  } catch (error) {
    console.error('Error sincronizando acciones:', error);
  }
}

window.addEventListener('online', sincronizarAccionesPendientes);

function tieneRegistroHoy(entradas) {
  const hoy = new Date().toISOString().slice(0, 10);
  return entradas.some(e => e.fecha === hoy);
}

function formatearFecha(fecha) {
  const opciones = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', opciones);
}

function getInitials(nombre) {
  return nombre.split(' ').map(n => n[0]).join('').toUpperCase();
}

function renderStats(registros) {
  const agrupado = {};
  registros.forEach(r => {
    if (!agrupado[r.nombre]) agrupado[r.nombre] = [];
    agrupado[r.nombre].push(r);
  });

  const totalEmpleados = Object.keys(agrupado).length;
  const empleadosActivos = Object.keys(agrupado).filter(nombre => {
    const entradas = agrupado[nombre];
    return !(entradas.length === 1 && entradas[0].totalHoras === 0 && tieneRegistroHoy(entradas));
  }).length;
  const totalHoras = registros.reduce((acc, r) => acc + r.totalHoras, 0);

  const statsContainer = document.getElementById('stats');
  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">
        <i class="fas fa-users"></i>
      </div>
      <div class="stat-number">${totalEmpleados}</div>
      <div class="stat-label">Total Empleados</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">
        <i class="fas fa-user-check"></i>
      </div>
      <div class="stat-number">${empleadosActivos}</div>
      <div class="stat-label">Empleados Activos</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">
        <i class="fas fa-clock"></i>
      </div>
      <div class="stat-number">${totalHoras.toFixed(2)}</div>
      <div class="stat-label">Horas Totales</div>
    </div>
  `;
}

async function render() {
  const registros = await obtenerDatos();

  if (registros.length === 0) {
    document.getElementById('resultado').innerHTML = `
      <div class="empty-state">
        <i class="fas fa-clipboard-list"></i>
        <h3>No hay registros de empleados</h3>
        <p>Los empleados aparecerán aquí cuando se registren horas</p>
      </div>
    `;
    document.getElementById('stats').innerHTML = '';
    return;
  }

  renderStats(registros);

  const agrupado = {};
  registros.forEach(r => {
    if (!agrupado[r.nombre]) agrupado[r.nombre] = [];
    agrupado[r.nombre].push(r);
  });

  const nombres = Object.keys(agrupado);
  nombres.sort((a, b) => {
    const aHoy = tieneRegistroHoy(agrupado[a]) ? 0 : 1;
    const bHoy = tieneRegistroHoy(agrupado[b]) ? 0 : 1;
    return aHoy - bHoy;
  });

  const contenedor = document.getElementById("resultado");
  contenedor.innerHTML = "";

  for (const nombre of nombres) {
    const entradas = agrupado[nombre];
    const soloCancelado = entradas.length === 1 && entradas[0].fecha === new Date().toISOString().slice(0, 10) && entradas[0].totalHoras === 0;
    const total = entradas.reduce((acc, r) => acc + r.totalHoras, 0);
    const initials = getInitials(nombre);

    let horasListHtml = '';
    entradas.forEach(r => {
      horasListHtml += `
        <div class="hours-entry">
          <span class="hours-date">${formatearFecha(r.fecha)}</span>
          <span class="hours-amount">${r.totalHoras.toFixed(2)}h</span>
        </div>
      `;
    });

    const employeeHtml = `
      <div class="employee-card">
        <div class="employee-header">
          <div class="employee-info">
            <div class="employee-avatar">${initials}</div>
            <div class="employee-name">${nombre}</div>
          </div>
          <div class="status-badge ${soloCancelado ? 'status-cancelled' : 'status-active'}">
            ${soloCancelado ? 'Cancelado' : 'Activo'}
          </div>
        </div>
        <div class="hours-list">
          <h4><i class="fas fa-history"></i> Historial de Horas</h4>
          ${horasListHtml}
        </div>
        <div class="total-hours">
          <i class="fas fa-calculator"></i> Total: ${total.toFixed(2)} horas
        </div>
        <div class="action-buttons">
          <button class="btn btn-cancel" onclick="cancelarHistorial('${nombre}')">
            <i class="fas fa-pause"></i> Cancelar/Reiniciar
          </button>
          <button class="btn btn-delete" onclick="eliminarEmpleado('${nombre}')">
            <i class="fas fa-trash"></i> Eliminar Empleado
          </button>
        </div>
      </div>
    `;
    contenedor.innerHTML += employeeHtml;
  }
}

async function cancelarHistorial(nombre) {
  const confirmado = await showConfirm(
    'Cancelar Historial',
    `¿Querés cancelar las horas de ${nombre} y reiniciar su historial?`
  );

  if (!confirmado) return;

  try {
    const registros = await obtenerDatos();
    const hoy = new Date().toISOString().slice(0, 10);
    const nuevosRegistros = registros.filter(r => r.nombre !== nombre);

    nuevosRegistros.push({
      nombre,
      fecha: hoy,
      totalHoras: 0
    });

    await guardarDatos(nuevosRegistros);
    await showSuccess(
      'Operación Exitosa',
      `Horas de ${nombre} canceladas y historial reiniciado correctamente.`
    );
    render();
  } catch (error) {
    await showError(
      'Error al Cancelar',
      `No se pudieron cancelar las horas: ${error.message}`
    );
  }
}

async function eliminarEmpleado(nombre) {
  const confirmado = await showDeleteConfirm(
    'Eliminar Empleado',
    `¿Querés eliminar a ${nombre} y todos sus registros? Esta acción no se puede deshacer.`
  );

  if (!confirmado) return;

  try {
    const registros = await obtenerDatos();
    const filtrados = registros.filter(r => r.nombre !== nombre);

    await guardarDatos(filtrados);
    await showSuccess(
      'Empleado Eliminado',
      `${nombre} ha sido eliminado del registro correctamente.`
    );
    render();
  } catch (error) {
    await showError(
      'Error al Eliminar',
      `No se pudo eliminar el empleado: ${error.message}`
    );
  }
}

// Inicializar la aplicación
render();
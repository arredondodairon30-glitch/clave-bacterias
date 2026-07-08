/* =========================================================
   CLAVE INTERACTIVA DE BACTERIOLOGÍA
   -----------------------------------------------------------
   El "esquema" (qué pruebas existen, sus opciones y cómo se
   agrupan) vive DENTRO de bacterias.json, bajo la clave
   "esquema". Esto significa que agregar una prueba bioquímica
   nueva se hace desde el modo Administrar → "Gestionar pruebas
   y criterios", SIN tocar este archivo.
   ========================================================= */

const DATA_PATH = "bacterias.json";

let ESQUEMA = {};   // se carga desde bacterias.json → esquema
let bacterias = [];  // se carga desde bacterias.json → bacterias
let activeFilters = {}; // { campo: valor } para single, { campo: [valores] } para multi

/* ---------------------------------------------------------
   CARGA INICIAL
   --------------------------------------------------------- */
async function cargarDatos() {
  try {
    const res = await fetch(DATA_PATH + "?_=" + Date.now()); // evita caché vieja
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    ESQUEMA = json.esquema || {};
    bacterias = json.bacterias || [];
    document.getElementById("loadError").hidden = true;
  } catch (e) {
    ESQUEMA = {};
    bacterias = [];
    document.getElementById("loadError").hidden = false;
    console.error("No se pudo cargar bacterias.json", e);
  }
  renderFiltros();
  renderResultados();
  renderCamposFormularioBacteria();
  renderTablaAdmin();
  renderTablaEsquema();
}

/* ---------------------------------------------------------
   MODO (Consulta / Administrar)
   --------------------------------------------------------- */
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => { b.classList.remove("is-active"); b.setAttribute("aria-selected","false"); });
    btn.classList.add("is-active");
    btn.setAttribute("aria-selected","true");
    const mode = btn.dataset.mode;
    document.getElementById("view-consulta").classList.toggle("is-active", mode === "consulta");
    document.getElementById("view-admin").classList.toggle("is-active", mode === "admin");
  });
});

/* ---------------------------------------------------------
   Utilidad: agrupar el esquema por "grupo" (para no repetir
   esta lógica en filtros, formulario, etc.)
   --------------------------------------------------------- */
function agruparEsquema() {
  const grupos = {};   // nombreGrupo -> [ [key,def], ... ]
  const sinGrupo = [];
  Object.entries(ESQUEMA).forEach(([key, def]) => {
    if (def.grupo) {
      grupos[def.grupo] = grupos[def.grupo] || [];
      grupos[def.grupo].push([key, def]);
    } else {
      sinGrupo.push([key, def]);
    }
  });
  return { grupos, sinGrupo };
}

/* ---------------------------------------------------------
   RENDER: panel de filtros (modo consulta)
   --------------------------------------------------------- */
function renderFiltros() {
  const panel = document.getElementById("filtersPanel");
  panel.innerHTML = "";
  const { grupos, sinGrupo } = agruparEsquema();

  sinGrupo.forEach(([campo, def]) => {
    panel.appendChild(construirGrupoFiltro(def.label, [[campo, def]], "filtro"));
  });
  Object.entries(grupos).forEach(([nombreGrupo, campos]) => {
    panel.appendChild(construirGrupoFiltro(nombreGrupo, campos, "filtro"));
  });
}

/* Construye un bloque <div class="filter-group"> con una o varias
   subfilas (una por campo). modo = "filtro" (consulta) usa
   toggleFiltro; el formulario de admin usa su propio render. */
function construirGrupoFiltro(titulo, campos, modo) {
  const group = document.createElement("div");
  group.className = "filter-group";
  const h3 = document.createElement("h3");
  h3.textContent = titulo;
  group.appendChild(h3);

  const esGrupoDeVarios = campos.length > 1;

  campos.forEach(([campo, def]) => {
    const wrap = document.createElement("div");
    wrap.className = esGrupoDeVarios ? "subfield" : "";
    if (esGrupoDeVarios) {
      const label = document.createElement("span");
      label.className = "subfield-label";
      label.textContent = def.label;
      wrap.appendChild(label);
    }
    const row = document.createElement("div");
    row.className = "chip-row";
    def.opciones.forEach(opt => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = opt;
      chip.dataset.value = opt;
      chip.addEventListener("click", () => toggleFiltro(campo, opt, def.tipo, chip));
      row.appendChild(chip);
    });
    wrap.appendChild(row);
    group.appendChild(wrap);
  });
  return group;
}

function toggleFiltro(campo, valor, tipo, chipEl) {
  if (tipo === "single") {
    if (activeFilters[campo] === valor) {
      delete activeFilters[campo];
      chipEl.classList.remove("is-selected");
    } else {
      chipEl.parentElement.querySelectorAll(".chip").forEach(c => c.classList.remove("is-selected"));
      activeFilters[campo] = valor;
      chipEl.classList.add("is-selected");
    }
  } else {
    const arr = activeFilters[campo] || [];
    if (arr.includes(valor)) {
      activeFilters[campo] = arr.filter(v => v !== valor);
      chipEl.classList.remove("is-selected");
    } else {
      activeFilters[campo] = [...arr, valor];
      chipEl.classList.add("is-selected");
    }
    if (activeFilters[campo].length === 0) delete activeFilters[campo];
  }
  renderResultados();
}

document.getElementById("btnReset").addEventListener("click", () => {
  activeFilters = {};
  document.querySelectorAll("#filtersPanel .chip.is-selected").forEach(c => c.classList.remove("is-selected"));
  renderResultados();
});

/* ---------------------------------------------------------
   LÓGICA DE COINCIDENCIA
   Un campo vacío/"" en la bacteria se considera "no aplica"
   y no descarta (ej. coagulasa en un bacilo Gram negativo).
   "variable" en la bacteria SIEMPRE cuenta como coincidencia
   posible, porque significa que a veces da ese resultado.
   --------------------------------------------------------- */
function coincide(bact) {
  return Object.entries(activeFilters).every(([campo, valor]) => {
    const def = ESQUEMA[campo];
    if (!def) return true;
    const bv = bact[campo];
    if (def.tipo === "single") {
      if (bv === undefined || bv === "") return true;   // no aplica, no descarta
      if (bv === "variable") return true;                 // puede dar cualquier resultado
      return bv === valor;
    } else {
      const arr = bv || [];
      return valor.every(v => arr.includes(v));
    }
  });
}

/* ---------------------------------------------------------
   RENDER: resultados (modo consulta)
   --------------------------------------------------------- */
function renderResultados() {
  const match = bacterias.filter(coincide);
  const discard = bacterias.filter(b => !coincide(b));

  const counterNum = document.getElementById("counterNumber");
  const counterLabel = document.getElementById("counterLabel");
  counterNum.textContent = bacterias.length ? match.length : "—";
  const nFiltros = Object.keys(activeFilters).length;
  counterLabel.textContent = bacterias.length
    ? (nFiltros === 0 ? `de ${bacterias.length} bacterias en la base` : `coinciden de ${bacterias.length} (con ${nFiltros} criterio${nFiltros>1?"s":""})`)
    : "no se pudo cargar bacterias.json";

  const grid = document.getElementById("resultsGrid");
  grid.innerHTML = "";
  if (bacterias.length && match.length === 0) {
    grid.innerHTML = `<div class="empty-state">Ninguna bacteria coincide con esta combinación. Prueba quitando algún criterio.</div>`;
  } else {
    match.forEach(b => grid.appendChild(bactCard(b, false)));
  }

  const discardGrid = document.getElementById("discardedGrid");
  discardGrid.innerHTML = "";
  discard.forEach(b => discardGrid.appendChild(bactCard(b, true)));
  document.getElementById("discardedCount").textContent = `(${discard.length})`;
}

function bactCard(b, discarded) {
  const card = document.createElement("div");
  card.className = `bact-card gram-${b.gram || ""} ${discarded ? "bact-card--discarded" : ""}`;
  const tags = [b.morfologia, b.hemolisis, b.oxigeno].filter(Boolean);
  card.innerHTML = `
    <h4>${b.nombre}</h4>
    <div class="tag-row">${tags.map(t => `<span class="tag">${t}</span>`).join("")}</div>
    <p>${b.notas || ""}</p>
  `;
  card.addEventListener("click", () => abrirFicha(b));
  return card;
}

/* ---------------------------------------------------------
   FICHA FLOTANTE (modal) al hacer clic en una bacteria
   --------------------------------------------------------- */
function abrirFicha(b) {
  const modal = document.getElementById("bactModal");
  const body = document.getElementById("modalBody");

  const filas = Object.entries(ESQUEMA)
    .filter(([campo, def]) => {
      const v = b[campo];
      return def.tipo === "multi" ? (v && v.length) : (v !== undefined && v !== "");
    })
    .map(([campo, def]) => {
      const v = b[campo];
      const valorTexto = def.tipo === "multi" ? (v.join(", ") || "—") : v;
      return `<div class="modal-result"><span>${def.label}</span><span>${valorTexto}</span></div>`;
    }).join("");

  body.innerHTML = `
    <h2>${b.nombre}</h2>
    <div class="modal-genero">${b.genero || ""}</div>
    <div class="modal-section">
      <h4>Resultados</h4>
      <div class="modal-result-grid">${filas || "<p>Sin resultados registrados.</p>"}</div>
    </div>
    ${b.notas ? `<div class="modal-section"><h4>Notas</h4><div class="modal-notes">${b.notas}</div></div>` : ""}
  `;
  modal.hidden = false;
}
document.getElementById("modalClose").addEventListener("click", cerrarFicha);
document.getElementById("bactModal").addEventListener("click", (e) => {
  if (e.target.id === "bactModal") cerrarFicha();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarFicha(); });
function cerrarFicha() { document.getElementById("bactModal").hidden = true; }

/* ---------------------------------------------------------
   ADMIN: configuración de conexión (guardada en localStorage)
   --------------------------------------------------------- */
const CFG_KEY = "clave_bacterias_cfg";

function getConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; }
  catch { return {}; }
}
function setConfig(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }

function cargarConfigEnFormulario() {
  const cfg = getConfig();
  document.getElementById("cfgOwner").value = cfg.owner || "";
  document.getElementById("cfgRepo").value = cfg.repo || "";
  document.getElementById("cfgPath").value = cfg.path || "bacterias.json";
  document.getElementById("cfgBranch").value = cfg.branch || "main";
  document.getElementById("cfgToken").value = cfg.token || "";
}

/* Verifica el token contra la API de GitHub (una petición GET real) antes
   de guardar la conexión y mostrar el panel. Así nadie ve el formulario de
   administración sin un token válido para ESE repositorio específico. */
async function verificarYDesbloquear(cfg, statusEl) {
  statusEl.textContent = "Verificando token…";
  statusEl.className = "status-text";
  try {
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}`;
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${cfg.token}`, "Accept": "application/vnd.github+json" }
    });
    if (!res.ok) {
      statusEl.textContent = res.status === 404
        ? "No se encontró el repositorio/archivo. Revisa usuario, repo y ruta."
        : "Token inválido o sin permisos de escritura sobre este repositorio.";
      statusEl.className = "status-text err";
      return false;
    }
    setConfig(cfg);
    mostrarPanelDesbloqueado(cfg);
    return true;
  } catch (err) {
    statusEl.textContent = "No se pudo verificar (revisa tu conexión a internet).";
    statusEl.className = "status-text err";
    return false;
  }
}

function mostrarPanelDesbloqueado(cfg) {
  document.getElementById("adminLock").hidden = true;
  document.getElementById("adminUnlocked").hidden = false;
  document.getElementById("repoLabelAdmin").textContent = `${cfg.owner}/${cfg.repo}`;
  document.getElementById("configStatus").textContent = "";
}

document.getElementById("btnUnlock").addEventListener("click", () => {
  const cfg = {
    owner: document.getElementById("cfgOwner").value.trim(),
    repo: document.getElementById("cfgRepo").value.trim(),
    path: document.getElementById("cfgPath").value.trim() || "bacterias.json",
    branch: document.getElementById("cfgBranch").value.trim() || "main",
    token: document.getElementById("cfgToken").value.trim()
  };
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    const status = document.getElementById("configStatus");
    status.textContent = "Completa usuario, repositorio y token.";
    status.className = "status-text err";
    return;
  }
  verificarYDesbloquear(cfg, document.getElementById("configStatus"));
});

document.getElementById("btnLockAgain").addEventListener("click", () => {
  document.getElementById("adminUnlocked").hidden = true;
  document.getElementById("adminLock").hidden = false;
});

document.getElementById("btnClearConfig").addEventListener("click", () => {
  localStorage.removeItem(CFG_KEY);
  cargarConfigEnFormulario();
  document.getElementById("adminUnlocked").hidden = true;
  document.getElementById("adminLock").hidden = false;
  const status = document.getElementById("configStatus");
  status.textContent = "Token borrado de este navegador.";
  status.className = "status-text";
});

/* Si ya hay una conexión guardada de una visita anterior, se verifica en
   silencio al cargar la página para no pedirle el token de nuevo al dueño. */
async function intentarDesbloqueoAutomatico() {
  const cfg = getConfig();
  if (cfg.owner && cfg.repo && cfg.token) {
    const ok = await verificarYDesbloquear(cfg, document.getElementById("configStatus"));
    if (!ok) document.getElementById("configStatus").textContent = "";
  }
}

/* ---------------------------------------------------------
   ADMIN: formulario de bacteria — campos dinámicos según ESQUEMA
   --------------------------------------------------------- */
function renderCamposFormularioBacteria() {
  const container = document.getElementById("dynamicFieldsContainer");
  container.innerHTML = "";
  const { grupos, sinGrupo } = agruparEsquema();

  sinGrupo.forEach(([campo, def]) => {
    container.appendChild(construirCampoFormulario(def.label, [[campo, def]]));
  });
  Object.entries(grupos).forEach(([nombreGrupo, campos]) => {
    container.appendChild(construirCampoFormulario(nombreGrupo, campos));
  });
}

function construirCampoFormulario(titulo, campos) {
  const group = document.createElement("div");
  group.className = "dynamic-field-group";
  const h3 = document.createElement("h3");
  h3.textContent = titulo;
  group.appendChild(h3);

  campos.forEach(([campo, def]) => {
    const row = document.createElement("div");
    row.className = "dynamic-field-row";
    row.dataset.field = campo;
    if (campos.length > 1) {
      const label = document.createElement("span");
      label.className = "field-label";
      label.textContent = def.label;
      row.appendChild(label);
    }
    const chipRow = document.createElement("div");
    chipRow.className = "chip-row";
    def.opciones.forEach(opt => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = opt;
      chip.dataset.value = opt;
      if (def.tipo === "single") {
        chip.addEventListener("click", () => {
          chipRow.querySelectorAll(".chip").forEach(c => c.classList.remove("is-selected"));
          chip.classList.add("is-selected");
        });
      } else {
        chip.addEventListener("click", () => chip.classList.toggle("is-selected"));
      }
      chipRow.appendChild(chip);
    });
    row.appendChild(chipRow);
    group.appendChild(row);
  });
  return group;
}

function leerFormularioBacteria() {
  const obj = {
    id: document.getElementById("fId").value || slugify(document.getElementById("fNombre").value),
    nombre: document.getElementById("fNombre").value.trim(),
    genero: document.getElementById("fGenero").value.trim(),
    notas: document.getElementById("fNotas").value.trim()
  };
  document.querySelectorAll("#dynamicFieldsContainer [data-field]").forEach(row => {
    const campo = row.dataset.field;
    const def = ESQUEMA[campo];
    if (!def) return;
    if (def.tipo === "single") {
      const sel = row.querySelector(".chip.is-selected");
      obj[campo] = sel ? sel.dataset.value : "";
    } else {
      obj[campo] = [...row.querySelectorAll(".chip.is-selected")].map(c => c.dataset.value);
    }
  });
  return obj;
}

function llenarFormularioBacteria(b) {
  document.getElementById("fId").value = b.id;
  document.getElementById("fNombre").value = b.nombre || "";
  document.getElementById("fGenero").value = b.genero || "";
  document.getElementById("fNotas").value = b.notas || "";
  document.querySelectorAll("#dynamicFieldsContainer [data-field]").forEach(row => {
    const campo = row.dataset.field;
    const def = ESQUEMA[campo];
    if (!def) return;
    if (def.tipo === "single") {
      row.querySelectorAll(".chip").forEach(c => c.classList.toggle("is-selected", c.dataset.value === b[campo]));
    } else {
      const arr = b[campo] || [];
      row.querySelectorAll(".chip").forEach(c => c.classList.toggle("is-selected", arr.includes(c.dataset.value)));
    }
  });
  document.getElementById("formTitle").textContent = "Editando: " + b.nombre;
}

function limpiarFormularioBacteria() {
  document.getElementById("bacteriaForm").reset();
  document.getElementById("fId").value = "";
  document.querySelectorAll("#dynamicFieldsContainer .chip").forEach(c => c.classList.remove("is-selected"));
  document.getElementById("formTitle").textContent = "Agregar bacteria nueva";
}

document.getElementById("btnCancelEdit").addEventListener("click", limpiarFormularioBacteria);

function slugify(str) {
  return str.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/* ---------------------------------------------------------
   ADMIN: tabla de bacterias existentes
   --------------------------------------------------------- */
function renderTablaAdmin() {
  const tbody = document.getElementById("adminTableBody");
  tbody.innerHTML = "";
  bacterias.forEach(b => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><em>${b.nombre}</em></td>
      <td>${b.gram || ""}</td>
      <td>${b.morfologia || ""}</td>
      <td>${b.catalasa || ""}</td>
      <td>${b.coagulasa || ""}</td>
      <td>${b.hemolisis || ""}</td>
      <td class="row-actions">
        <button data-action="edit" data-id="${b.id}">Editar</button>
        <button data-action="delete" data-id="${b.id}">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
  document.getElementById("totalCount").textContent = `(${bacterias.length})`;

  tbody.querySelectorAll("button[data-action='edit']").forEach(btn => {
    btn.addEventListener("click", () => {
      const b = bacterias.find(x => x.id === btn.dataset.id);
      if (b) { llenarFormularioBacteria(b); window.scrollTo({top:0, behavior:"smooth"}); }
    });
  });
  tbody.querySelectorAll("button[data-action='delete']").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta bacteria de la base de datos? Esto crea un commit en GitHub.")) return;
      bacterias = bacterias.filter(x => x.id !== btn.dataset.id);
      await guardarEnGitHub(`Elimina ${btn.dataset.id} vía app`);
      renderResultados();
      renderTablaAdmin();
    });
  });
}

document.getElementById("bacteriaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nuevo = leerFormularioBacteria();
  if (!nuevo.nombre) return;
  const idx = bacterias.findIndex(b => b.id === nuevo.id);
  if (idx >= 0) bacterias[idx] = nuevo; else bacterias.push(nuevo);

  const ok = await guardarEnGitHub(`${idx >= 0 ? "Actualiza" : "Agrega"} ${nuevo.nombre} vía app`, "saveStatus");
  if (ok) {
    limpiarFormularioBacteria();
    renderResultados();
    renderTablaAdmin();
  }
});

/* ---------------------------------------------------------
   ADMIN: gestión del esquema (agregar/editar/eliminar pruebas)
   --------------------------------------------------------- */
function renderTablaEsquema() {
  const tbody = document.getElementById("esquemaTableBody");
  tbody.innerHTML = "";
  Object.entries(ESQUEMA).forEach(([key, def]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${def.label}</td>
      <td>${def.tipo === "single" ? "Único" : "Múltiple"}</td>
      <td>${def.grupo || "—"}</td>
      <td>${def.opciones.join(", ")}</td>
      <td class="row-actions">
        <button data-action="edit" data-key="${key}">Editar</button>
        <button data-action="delete" data-key="${key}">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-action='edit']").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const def = ESQUEMA[key];
      document.getElementById("eKey").value = key;
      document.getElementById("eLabel").value = def.label;
      document.getElementById("eTipo").value = def.tipo;
      document.getElementById("eGrupo").value = def.grupo || "";
      document.getElementById("eOpciones").value = def.opciones.join(", ");
      window.scrollTo({top: document.getElementById("esquemaCard").offsetTop - 20, behavior:"smooth"});
    });
  });
  tbody.querySelectorAll("button[data-action='delete']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.key;
      if (!confirm(`¿Eliminar la prueba "${ESQUEMA[key].label}"? Las bacterias que ya tenían un valor en este campo lo conservarán guardado pero dejará de mostrarse.`)) return;
      delete ESQUEMA[key];
      const ok = await guardarEnGitHub(`Elimina prueba "${key}" vía app`, "esquemaStatus");
      if (ok) {
        renderFiltros(); renderResultados(); renderCamposFormularioBacteria(); renderTablaEsquema();
      }
    });
  });
}

document.getElementById("btnCancelEsquema").addEventListener("click", () => {
  document.getElementById("esquemaForm").reset();
  document.getElementById("eKey").value = "";
  document.getElementById("eOpciones").value = "+, -, variable";
});

document.getElementById("esquemaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = document.getElementById("eKey").value;
  const label = document.getElementById("eLabel").value.trim();
  const tipo = document.getElementById("eTipo").value;
  const grupo = document.getElementById("eGrupo").value.trim();
  const opciones = document.getElementById("eOpciones").value.split(",").map(s => s.trim()).filter(Boolean);

  if (!label || opciones.length === 0) return;

  const finalKey = key || slugify(label);
  ESQUEMA[finalKey] = { label, tipo, opciones };
  if (grupo) ESQUEMA[finalKey].grupo = grupo;

  const ok = await guardarEnGitHub(`${key ? "Actualiza" : "Agrega"} prueba "${label}" vía app`, "esquemaStatus");
  if (ok) {
    document.getElementById("esquemaForm").reset();
    document.getElementById("eKey").value = "";
    document.getElementById("eOpciones").value = "+, -, variable";
    renderFiltros(); renderResultados(); renderCamposFormularioBacteria(); renderTablaEsquema();
  }
});

/* ---------------------------------------------------------
   GUARDAR EN GITHUB (crea un commit real vía API de contenidos)
   --------------------------------------------------------- */
async function guardarEnGitHub(mensaje, statusElId = "saveStatus") {
  const cfg = getConfig();
  const status = document.getElementById(statusElId);
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    status.textContent = "Falta configurar la conexión con GitHub (arriba).";
    status.className = "status-text err";
    return false;
  }
  status.textContent = "Guardando en GitHub…";
  status.className = "status-text";

  const apiBase = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
  const headers = {
    "Authorization": `Bearer ${cfg.token}`,
    "Accept": "application/vnd.github+json"
  };

  try {
    const getRes = await fetch(`${apiBase}?ref=${cfg.branch}`, { headers });
    if (!getRes.ok) throw new Error(`No se pudo leer el archivo actual (${getRes.status})`);
    const getJson = await getRes.json();
    const sha = getJson.sha;

    const contenido = JSON.stringify({ esquema: ESQUEMA, bacterias }, null, 2);
    const putRes = await fetch(apiBase, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: mensaje,
        content: utf8ToBase64(contenido),
        sha: sha,
        branch: cfg.branch
      })
    });
    if (!putRes.ok) {
      const errJson = await putRes.json().catch(() => ({}));
      throw new Error(errJson.message || `Error al guardar (${putRes.status})`);
    }

    status.textContent = "Guardado. Commit creado en GitHub.";
    status.className = "status-text ok";
    return true;
  } catch (err) {
    status.textContent = "Error: " + err.message;
    status.className = "status-text err";
    console.error(err);
    return false;
  }
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/* ---------------------------------------------------------
   INICIO
   --------------------------------------------------------- */
cargarConfigEnFormulario();
cargarDatos();
intentarDesbloqueoAutomatico();

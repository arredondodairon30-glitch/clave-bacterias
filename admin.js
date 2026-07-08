const DATA_PATH = "bacterias.json";
const CFG_KEY = "clave_bacterias_cfg";
const BACKUP_KEY = "clave_bacterias_backup";

let ESQUEMA = {};
let bacterias = [];

/* ---------------------------------------------------------
   UTILIDADES
   --------------------------------------------------------- */
function getConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; }
  catch { return {}; }
}
function setConfig(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }

function guardarBackupLocal() {
  localStorage.setItem(BACKUP_KEY, JSON.stringify({ esquema: ESQUEMA, bacterias }));
}

function cargarBackupLocal() {
  try { return JSON.parse(localStorage.getItem(BACKUP_KEY)); }
  catch { return null; }
}

// FIX: utf8ToBase64 moderno (sin unescape deprecado)
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binString);
}

function slugify(str) {
  return str.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/* ---------------------------------------------------------
   CARGA INICIAL
   --------------------------------------------------------- */
function normalizarBacterias() {
  bacterias.forEach(b => {
    Object.entries(ESQUEMA).forEach(([campo, def]) => {
      if (b[campo] === undefined) {
        b[campo] = def.tipo === "single" ? "" : [];
      }
    });
  });
}

async function cargarDatos() {
  try {
    const res = await fetch(DATA_PATH + "?_=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    ESQUEMA = json.esquema || {};
    bacterias = json.bacterias || [];
    normalizarBacterias();
    document.getElementById("loadError").hidden = true;
  } catch (e) {
    ESQUEMA = {};
    bacterias = [];
    document.getElementById("loadError").hidden = false;
    console.error("No se pudo cargar bacterias.json", e);
  }
  renderCamposFormularioBacteria();
  renderTablaAdmin();
  renderTablaEsquema();
  cargarConfigEnFormulario();
}

/* ---------------------------------------------------------
   AGRUPAR ESQUEMA (ordenado alfabéticamente)
   --------------------------------------------------------- */
function agruparEsquema() {
  const grupos = {};
  const sinGrupo = [];
  Object.entries(ESQUEMA).forEach(([key, def]) => {
    if (def.grupo) {
      grupos[def.grupo] = grupos[def.grupo] || [];
      grupos[def.grupo].push([key, def]);
    } else {
      sinGrupo.push([key, def]);
    }
  });
  const gruposOrdenados = Object.fromEntries(
    Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))
  );
  return { grupos: gruposOrdenados, sinGrupo };
}

/* ---------------------------------------------------------
   ADMIN: configuración de conexión
   --------------------------------------------------------- */
function cargarConfigEnFormulario() {
  const cfg = getConfig();
  document.getElementById("cfgOwner").value = cfg.owner || "";
  document.getElementById("cfgRepo").value = cfg.repo || "";
  document.getElementById("cfgPath").value = cfg.path || "bacterias.json";
  document.getElementById("cfgBranch").value = cfg.branch || "main";
  document.getElementById("cfgToken").value = cfg.token || "";
}

document.getElementById("btnSaveConfig").addEventListener("click", () => {
  const cfg = {
    owner: document.getElementById("cfgOwner").value.trim(),
    repo: document.getElementById("cfgRepo").value.trim(),
    path: document.getElementById("cfgPath").value.trim() || "bacterias.json",
    branch: document.getElementById("cfgBranch").value.trim() || "main",
    token: document.getElementById("cfgToken").value.trim()
  };
  setConfig(cfg);
  const status = document.getElementById("configStatus");
  status.textContent = "Conexión guardada en este navegador.";
  status.className = "status-text ok";
});

document.getElementById("btnClearConfig").addEventListener("click", () => {
  localStorage.removeItem(CFG_KEY);
  cargarConfigEnFormulario();
  const status = document.getElementById("configStatus");
  status.textContent = "Token borrado de este navegador.";
  status.className = "status-text";
});

/* ---------------------------------------------------------
   ADMIN: formulario de bacteria
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

// FIX: Validación de ID único y no vacío
function leerFormularioBacteria() {
  const idOriginal = document.getElementById("fId").value;
  const nombre = document.getElementById("fNombre").value.trim();

  if (!nombre) {
    alert("El nombre científico es obligatorio.");
    return null;
  }

  // Si está editando, mantener el ID original. Si es nueva, generar slug.
  let id = idOriginal || slugify(nombre);

  if (!id) {
    alert("El nombre no puede generar un identificador válido. Usa letras y números.");
    return null;
  }

  // Si es nueva bacteria, verificar que no exista ya
  if (!idOriginal && bacterias.some(b => b.id === id)) {
    alert(`Ya existe una bacteria con el ID "${id}". Usa un nombre diferente.`);
    return null;
  }

  const obj = {
    id,
    nombre,
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
  document.getElementById("fId").value = b.id; // FIX: Mantiene ID original
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

/* ---------------------------------------------------------
   ADMIN: tabla de bacterias (dinámica según esquema)
   --------------------------------------------------------- */
function renderTablaAdmin() {
  const tbody = document.getElementById("adminTableBody");
  const theadRow = document.querySelector("#adminTable thead tr");
  tbody.innerHTML = "";

  // FIX: Reconstruir header dinámicamente según ESQUEMA
  let headerHTML = "<th>Nombre</th>";
  Object.entries(ESQUEMA).forEach(([key, def]) => {
    headerHTML += `<th>${def.label}</th>`;
  });
  headerHTML += "<th></th>";
  theadRow.innerHTML = headerHTML;

  bacterias.forEach(b => {
    const tr = document.createElement("tr");
    let rowHTML = `<td><em>${b.nombre}</em></td>`;
    Object.entries(ESQUEMA).forEach(([key, def]) => {
      const val = b[key];
      let display = "—";
      if (def.tipo === "multi") {
        if (val && val.length) display = val.join(", ");
      } else {
        if (val !== undefined && val !== "") display = val;
      }
      rowHTML += `<td>${display}</td>`;
    });
    rowHTML += `
      <td class="row-actions">
        <button data-action="edit" data-id="${b.id}">Editar</button>
        <button data-action="delete" data-id="${b.id}">Eliminar</button>
      </td>`;
    tr.innerHTML = rowHTML;
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
      guardarBackupLocal();
      await guardarEnGitHub(`Elimina ${btn.dataset.id} vía app`);
      renderTablaAdmin();
    });
  });
}

document.getElementById("bacteriaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nuevo = leerFormularioBacteria();
  if (!nuevo) return; // Validación falló

  const idx = bacterias.findIndex(b => b.id === nuevo.id);
  if (idx >= 0) bacterias[idx] = nuevo; else bacterias.push(nuevo);

  guardarBackupLocal();

  const ok = await guardarEnGitHub(`${idx >= 0 ? "Actualiza" : "Agrega"} ${nuevo.nombre} vía app`, "saveStatus");
  if (ok) {
    limpiarFormularioBacteria();
    renderTablaAdmin();
  }
});

/* ---------------------------------------------------------
   ADMIN: gestión del esquema
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
      if (!confirm(`¿Eliminar la prueba "${ESQUEMA[key].label}"? Se eliminará también de todas las bacterias.`)) return;

      // FIX: Limpiar el campo de todas las bacterias al eliminar la prueba
      bacterias.forEach(b => delete b[key]);
      delete ESQUEMA[key];

      guardarBackupLocal();
      const ok = await guardarEnGitHub(`Elimina prueba "${key}" vía app`, "esquemaStatus");
      if (ok) {
        renderCamposFormularioBacteria();
        renderTablaAdmin();
        renderTablaEsquema();
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
  if (!finalKey) {
    alert("El nombre de la prueba no puede generar un identificador válido.");
    return;
  }

  ESQUEMA[finalKey] = { label, tipo, opciones };
  if (grupo) ESQUEMA[finalKey].grupo = grupo;

  // Si es una prueba nueva, inicializar en todas las bacterias existentes
  if (!key) {
    bacterias.forEach(b => {
      if (b[finalKey] === undefined) {
        b[finalKey] = tipo === "single" ? "" : [];
      }
    });
  }

  guardarBackupLocal();
  const ok = await guardarEnGitHub(`${key ? "Actualiza" : "Agrega"} prueba "${label}" vía app`, "esquemaStatus");
  if (ok) {
    document.getElementById("esquemaForm").reset();
    document.getElementById("eKey").value = "";
    document.getElementById("eOpciones").value = "+, -, variable";
    renderCamposFormularioBacteria();
    renderTablaAdmin();
    renderTablaEsquema();
  }
});

/* ---------------------------------------------------------
   GUARDAR EN GITHUB (mejorado)
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
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  try {
    const getRes = await fetch(`${apiBase}?ref=${cfg.branch}`, { headers });
    if (!getRes.ok) {
      const errText = await getRes.text().catch(() => "Error desconocido");
      throw new Error(`No se pudo leer el archivo (${getRes.status}): ${errText.slice(0, 200)}`);
    }
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
      const errText = await putRes.text().catch(() => "{}");
      let errMsg = `Error al guardar (${putRes.status})`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    status.textContent = "✅ Guardado. Commit creado en GitHub.";
    status.className = "status-text ok";
    return true;
  } catch (err) {
    status.innerHTML = `Error: ${err.message} <button class="btn-link" onclick="descargarJSONLocal()">Descargar JSON de respaldo</button>`;
    status.className = "status-text err";
    console.error(err);
    return false;
  }
}

// Botón de descarga de respaldo
function descargarJSONLocal() {
  const data = cargarBackupLocal();
  if (!data) { alert("No hay datos en el respaldo local."); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bacterias_respaldo.json";
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------
   INICIO
   --------------------------------------------------------- */
cargarDatos();

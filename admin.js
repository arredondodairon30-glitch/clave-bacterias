const DATA_PATH = "bacterias.json";
let ESQUEMA = {}; let bacterias = [];
const CFG_KEY = "clave_bacterias_cfg";

function getConfig() { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; } }
function setConfig(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }

async function cargarDatos() {
  try {
    const res = await fetch(DATA_PATH + "?_=" + Date.now());
    if (res.ok) {
      const json = await res.json();
      ESQUEMA = json.esquema || {}; bacterias = json.bacterias || [];
    }
  } catch (e) { console.error("Error cargando base", e); }
  renderCamposFormularioBacteria(); renderTablaAdmin(); renderTablaEsquema();
}

function agruparEsquema() {
  const grupos = {}; const sinGrupo = [];
  Object.entries(ESQUEMA).forEach(([key, def]) => {
    if (def.grupo) { grupos[def.grupo] = grupos[def.grupo] || []; grupos[def.grupo].push([key, def]); }
    else sinGrupo.push([key, def]);
  });
  return { grupos, sinGrupo };
}

function cargarConfigEnFormulario() {
  const cfg = getConfig();
  document.getElementById("cfgOwner").value = cfg.owner || "";
  document.getElementById("cfgRepo").value = cfg.repo || "";
  document.getElementById("cfgPath").value = cfg.path || "bacterias.json";
  document.getElementById("cfgBranch").value = cfg.branch || "main";
  document.getElementById("cfgToken").value = cfg.token || "";
}

document.getElementById("btnSaveConfig").addEventListener("click", () => {
  setConfig({
    owner: document.getElementById("cfgOwner").value.trim(), repo: document.getElementById("cfgRepo").value.trim(),
    path: document.getElementById("cfgPath").value.trim() || "bacterias.json", branch: document.getElementById("cfgBranch").value.trim() || "main",
    token: document.getElementById("cfgToken").value.trim()
  });
  document.getElementById("configStatus").textContent = "Conexión guardada."; document.getElementById("configStatus").className = "status-text ok";
});

document.getElementById("btnClearConfig").addEventListener("click", () => {
  localStorage.removeItem(CFG_KEY); cargarConfigEnFormulario();
  document.getElementById("configStatus").textContent = "Token borrado."; document.getElementById("configStatus").className = "status-text";
});

function renderCamposFormularioBacteria() {
  const container = document.getElementById("dynamicFieldsContainer"); container.innerHTML = "";
  const { grupos, sinGrupo } = agruparEsquema();
  sinGrupo.forEach(([c, d]) => container.appendChild(construirCampoFormulario(d.label, [[c, d]])));
  Object.entries(grupos).forEach(([n, c]) => container.appendChild(construirCampoFormulario(n, c)));
}

function construirCampoFormulario(titulo, campos) {
  const group = document.createElement("div"); group.className = "dynamic-field-group";
  const h3 = document.createElement("h3"); h3.textContent = titulo; group.appendChild(h3);
  campos.forEach(([campo, def]) => {
    const row = document.createElement("div"); row.className = "dynamic-field-row"; row.dataset.field = campo;
    if (campos.length > 1) { const label = document.createElement("span"); label.className = "field-label"; label.textContent = def.label; row.appendChild(label); }
    const chipRow = document.createElement("div"); chipRow.className = "chip-row";
    def.opciones.forEach(opt => {
      const chip = document.createElement("button"); chip.type = "button"; chip.className = "chip"; chip.textContent = opt; chip.dataset.value = opt;
      if (def.tipo === "single") chip.addEventListener("click", () => { chipRow.querySelectorAll(".chip").forEach(c => c.classList.remove("is-selected")); chip.classList.add("is-selected"); });
      else chip.addEventListener("click", () => chip.classList.toggle("is-selected"));
      chipRow.appendChild(chip);
    });
    row.appendChild(chipRow); group.appendChild(row);
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
    const campo = row.dataset.field; const def = ESQUEMA[campo]; if (!def) return;
    if (def.tipo === "single") { const sel = row.querySelector(".chip.is-selected"); obj[campo] = sel ? sel.dataset.value : ""; }
    else { obj[campo] = [...row.querySelectorAll(".chip.is-selected")].map(c => c.dataset.value); }
  });
  return obj;
}

function llenarFormularioBacteria(b) {
  document.getElementById("fId").value = b.id; document.getElementById("fNombre").value = b.nombre || "";
  document.getElementById("fGenero").value = b.genero || ""; document.getElementById("fNotas").value = b.notas || "";
  document.querySelectorAll("#dynamicFieldsContainer [data-field]").forEach(row => {
    const campo = row.dataset.field; const def = ESQUEMA[campo]; if (!def) return;
    if (def.tipo === "single") row.querySelectorAll(".chip").forEach(c => c.classList.toggle("is-selected", c.dataset.value === b[campo]));
    else { const arr = b[campo] || []; row.querySelectorAll(".chip").forEach(c => c.classList.toggle("is-selected", arr.includes(c.dataset.value))); }
  });
  document.getElementById("formTitle").textContent = "Editando: " + b.nombre;
}

function limpiarFormularioBacteria() {
  document.getElementById("bacteriaForm").reset(); document.getElementById("fId").value = "";
  document.querySelectorAll("#dynamicFieldsContainer .chip").forEach(c => c.classList.remove("is-selected"));
  document.getElementById("formTitle").textContent = "Agregar bacteria nueva";
}
document.getElementById("btnCancelEdit").addEventListener("click", limpiarFormularioBacteria);

function slugify(str) { return str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }

function renderTablaAdmin() {
  const tbody = document.getElementById("adminTableBody"); tbody.innerHTML = "";
  bacterias.forEach(b => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><em>${b.nombre}</em></td><td>${b.gram || ""}</td><td>${b.morfologia || ""}</td><td class="row-actions"><button data-action="edit" data-id="${b.id}">Editar</button><button data-action="delete" data-id="${b.id}">Eliminar</button></td>`;
    tbody.appendChild(tr);
  });
  document.getElementById("totalCount").textContent = `(${bacterias.length})`;
  tbody.querySelectorAll("button[data-action='edit']").forEach(btn => btn.addEventListener("click", () => { const b = bacterias.find(x => x.id === btn.dataset.id); if (b) { llenarFormularioBacteria(b); window.scrollTo({top:0, behavior:"smooth"}); } }));
  tbody.querySelectorAll("button[data-action='delete']").forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar esta bacteria?")) return;
    bacterias = bacterias.filter(x => x.id !== btn.dataset.id);
    await guardarEnGitHub(`Elimina ${btn.dataset.id} vía app`); renderTablaAdmin();
  }));
}

document.getElementById("bacteriaForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const nuevo = leerFormularioBacteria(); if (!nuevo.nombre) return;
  const isEditMode = document.getElementById("fId").value !== "";
  const idx = bacterias.findIndex(b => b.id === nuevo.id);
  
  if (!isEditMode && idx >= 0) {
    alert(`¡Cuidado! Ya existe una bacteria llamada así (ID: "${nuevo.id}"). Cambia el nombre o edita la existente para no sobrescribir sus datos.`);
    return;
  }
  
  if (idx >= 0) bacterias[idx] = nuevo; else bacterias.push(nuevo);
  const ok = await guardarEnGitHub(`${idx >= 0 ? "Actualiza" : "Agrega"} ${nuevo.nombre} vía app`, "saveStatus");
  if (ok) { limpiarFormularioBacteria(); renderTablaAdmin(); }
});

function renderTablaEsquema() {
  const tbody = document.getElementById("esquemaTableBody"); tbody.innerHTML = "";
  Object.entries(ESQUEMA).forEach(([key, def]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${def.label}</td><td>${def.tipo === "single" ? "Único" : "Múltiple"}</td><td>${def.grupo || "—"}</td><td>${def.opciones.join(", ")}</td><td class="row-actions"><button data-action="edit" data-key="${key}">Editar</button><button data-action="delete" data-key="${key}">Eliminar</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("button[data-action='edit']").forEach(btn => btn.addEventListener("click", () => {
    const key = btn.dataset.key; const def = ESQUEMA[key];
    document.getElementById("eKey").value = key; document.getElementById("eLabel").value = def.label; document.getElementById("eTipo").value = def.tipo;
    document.getElementById("eGrupo").value = def.grupo || ""; document.getElementById("eOpciones").value = def.opciones.join(", ");
    window.scrollTo({top: document.getElementById("esquemaCard").offsetTop - 20, behavior:"smooth"});
  }));
  tbody.querySelectorAll("button[data-action='delete']").forEach(btn => btn.addEventListener("click", async () => {
    const key = btn.dataset.key; if (!confirm(`¿Eliminar la prueba "${ESQUEMA[key].label}"?`)) return;
    delete ESQUEMA[key]; const ok = await guardarEnGitHub(`Elimina prueba "${key}"`, "esquemaStatus");
    if (ok) { renderCamposFormularioBacteria(); renderTablaEsquema(); }
  }));
}

document.getElementById("btnCancelEsquema").addEventListener("click", () => { document.getElementById("esquemaForm").reset(); document.getElementById("eKey").value = ""; document.getElementById("eOpciones").value = "+, -, variable"; });

document.getElementById("esquemaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = document.getElementById("eKey").value; const label = document.getElementById("eLabel").value.trim();
  const tipo = document.getElementById("eTipo").value; const grupo = document.getElementById("eGrupo").value.trim();
  const opciones = document.getElementById("eOpciones").value.split(",").map(s => s.trim()).filter(Boolean);
  if (!label || opciones.length === 0) return;
  const finalKey = key || slugify(label);
  ESQUEMA[finalKey] = { label, tipo, opciones }; if (grupo) ESQUEMA[finalKey].grupo = grupo;
  const ok = await guardarEnGitHub(`${key ? "Actualiza" : "Agrega"} prueba "${label}"`, "esquemaStatus");
  if (ok) { document.getElementById("esquemaForm").reset(); document.getElementById("eKey").value = ""; document.getElementById("eOpciones").value = "+, -, variable"; renderCamposFormularioBacteria(); renderTablaEsquema(); }
});

async function guardarEnGitHub(mensaje, statusElId = "saveStatus") {
  const cfg = getConfig(); const status = document.getElementById(statusElId);
  if (!cfg.owner || !cfg.repo || !cfg.token) { status.textContent = "Falta configurar la conexión."; status.className = "status-text err"; return false; }
  status.textContent = "Guardando en GitHub…"; status.className = "status-text";
  const apiBase = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
  const headers = { "Authorization": `Bearer ${cfg.token}`, "Accept": "application/vnd.github+json" };
  try {
    const getRes = await fetch(`${apiBase}?ref=${cfg.branch}`, { headers });
    if (!getRes.ok) throw new Error(`No se pudo leer el archivo actual (${getRes.status})`);
    const sha = (await getRes.json()).sha;
    const contenido = JSON.stringify({ esquema: ESQUEMA, bacterias }, null, 2);
    const putRes = await fetch(apiBase, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ message: mensaje, content: utf8ToBase64(contenido), sha: sha, branch: cfg.branch }) });
    if (!putRes.ok) throw new Error((await putRes.json().catch(()=>({}))).message || `Error (${putRes.status})`);
    status.textContent = "Guardado. Los cambios pueden tardar 1-5 mins en verse en la web."; status.className = "status-text ok"; return true;
  } catch (err) { status.textContent = "Error: " + err.message; status.className = "status-text err"; return false; }
}

// CORRECCIÓN: Función moderna para codificar en Base64 sin usar código obsoleto
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
}

cargarConfigEnFormulario();
cargarDatos();
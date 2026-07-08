const DATA_PATH = "bacterias.json";
let ESQUEMA = {};
let bacterias = [];
let activeFilters = {};

async function cargarDatos() {
  try {
    const res = await fetch(DATA_PATH + "?_=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    ESQUEMA = json.esquema || {};
    bacterias = json.bacterias || [];
    document.getElementById("loadError").hidden = true;
  } catch (e) {
    ESQUEMA = {}; bacterias = [];
    document.getElementById("loadError").hidden = false;
    console.error("No se pudo cargar bacterias.json", e);
  }
  renderFiltros();
  renderResultados();
}

function agruparEsquema() {
  const grupos = {};
  const sinGrupo = [];
  Object.entries(ESQUEMA).forEach(([key, def]) => {
    if (def.grupo) {
      grupos[def.grupo] = grupos[def.grupo] || [];
      grupos[def.grupo].push([key, def]);
    } else { sinGrupo.push([key, def]); }
  });
  return { grupos, sinGrupo };
}

function renderFiltros() {
  const panel = document.getElementById("filtersPanel");
  panel.innerHTML = "";
  const { grupos, sinGrupo } = agruparEsquema();

  sinGrupo.forEach(([campo, def]) => panel.appendChild(construirGrupoFiltro(def.label, [[campo, def]])));
  Object.entries(grupos).forEach(([nombreGrupo, campos]) => panel.appendChild(construirGrupoFiltro(nombreGrupo, campos)));
}

function construirGrupoFiltro(titulo, campos) {
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
      label.className = "subfield-label"; label.textContent = def.label;
      wrap.appendChild(label);
    }
    const row = document.createElement("div");
    row.className = "chip-row";
    def.opciones.forEach(opt => {
      const chip = document.createElement("button");
      chip.type = "button"; chip.className = "chip";
      chip.textContent = opt; chip.dataset.value = opt;
      chip.addEventListener("click", () => toggleFiltro(campo, opt, def.tipo, chip));
      row.appendChild(chip);
    });
    wrap.appendChild(row); group.appendChild(wrap);
  });
  return group;
}

function toggleFiltro(campo, valor, tipo, chipEl) {
  if (tipo === "single") {
    if (activeFilters[campo] === valor) {
      delete activeFilters[campo]; chipEl.classList.remove("is-selected");
    } else {
      chipEl.parentElement.querySelectorAll(".chip").forEach(c => c.classList.remove("is-selected"));
      activeFilters[campo] = valor; chipEl.classList.add("is-selected");
    }
  } else {
    const arr = activeFilters[campo] || [];
    if (arr.includes(valor)) {
      activeFilters[campo] = arr.filter(v => v !== valor); chipEl.classList.remove("is-selected");
    } else {
      activeFilters[campo] = [...arr, valor]; chipEl.classList.add("is-selected");
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

function coincide(bact) {
  return Object.entries(activeFilters).every(([campo, valor]) => {
    const def = ESQUEMA[campo];
    if (!def) return true;
    const bv = bact[campo];
    if (def.tipo === "single") {
      if (bv === undefined || bv === "") return false;   // CORRECCIÓN: Ahora es estricto
      if (bv === "variable") return true;                 
      return bv === valor;
    } else {
      const arr = bv || [];
      return valor.every(v => arr.includes(v));
    }
  });
}

function renderResultados() {
  const match = bacterias.filter(coincide);
  const discard = bacterias.filter(b => !coincide(b));

  document.getElementById("counterNumber").textContent = bacterias.length ? match.length : "—";
  const nFiltros = Object.keys(activeFilters).length;
  document.getElementById("counterLabel").textContent = bacterias.length
    ? (nFiltros === 0 ? `de ${bacterias.length} bacterias en la base` : `coinciden de ${bacterias.length}`)
    : "no se pudo cargar bacterias.json";

  const grid = document.getElementById("resultsGrid");
  grid.innerHTML = "";
  if (bacterias.length && match.length === 0) {
    grid.innerHTML = `<div class="empty-state">Ninguna bacteria coincide. Prueba quitando algún criterio.</div>`;
  } else { match.forEach(b => grid.appendChild(bactCard(b, false))); }

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

function abrirFicha(b) {
  const filas = Object.entries(ESQUEMA).filter(([campo, def]) => {
      const v = b[campo]; return def.tipo === "multi" ? (v && v.length) : (v !== undefined && v !== "");
    }).map(([campo, def]) => {
      const v = b[campo]; const valorTexto = def.tipo === "multi" ? (v.join(", ") || "—") : v;
      return `<div class="modal-result"><span>${def.label}</span><span>${valorTexto}</span></div>`;
    }).join("");

  document.getElementById("modalBody").innerHTML = `
    <h2>${b.nombre}</h2>
    <div class="modal-genero">${b.genero || ""}</div>
    <div class="modal-section"><h4>Resultados</h4><div class="modal-result-grid">${filas || "<p>Sin resultados.</p>"}</div></div>
    ${b.notas ? `<div class="modal-section"><h4>Notas</h4><div class="modal-notes">${b.notas}</div></div>` : ""}
  `;
  document.getElementById("bactModal").hidden = false;
}

function cerrarFicha() { document.getElementById("bactModal").hidden = true; }
document.getElementById("modalClose").addEventListener("click", cerrarFicha);
document.getElementById("bactModal").addEventListener("click", (e) => { if (e.target.id === "bactModal") cerrarFicha(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarFicha(); });

cargarDatos();
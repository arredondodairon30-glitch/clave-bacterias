const DATA_PATH = "bacterias.json";

let ESQUEMA = {};
let bacterias = [];
let activeFilters = {};

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
  renderFiltros();
  renderResultados();
}

/* ---------------------------------------------------------
   Utilidad: agrupar esquema (ordenado alfabéticamente)
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
   RENDER: panel de filtros
   --------------------------------------------------------- */
function renderFiltros() {
  const panel = document.getElementById("filtersPanel");
  panel.innerHTML = "";
  const { grupos, sinGrupo } = agruparEsquema();

  sinGrupo.forEach(([campo, def]) => {
    panel.appendChild(construirGrupoFiltro(def.label, [[campo, def]]));
  });
  Object.entries(grupos).forEach(([nombreGrupo, campos]) => {
    panel.appendChild(construirGrupoFiltro(nombreGrupo, campos));
  });
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
      chip.setAttribute("aria-pressed", "false");
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
      chipEl.setAttribute("aria-pressed", "false");
    } else {
      chipEl.parentElement.querySelectorAll(".chip").forEach(c => {
        c.classList.remove("is-selected");
        c.setAttribute("aria-pressed", "false");
      });
      activeFilters[campo] = valor;
      chipEl.classList.add("is-selected");
      chipEl.setAttribute("aria-pressed", "true");
    }
  } else {
    const arr = activeFilters[campo] || [];
    if (arr.includes(valor)) {
      activeFilters[campo] = arr.filter(v => v !== valor);
      chipEl.classList.remove("is-selected");
      chipEl.setAttribute("aria-pressed", "false");
    } else {
      activeFilters[campo] = [...arr, valor];
      chipEl.classList.add("is-selected");
      chipEl.setAttribute("aria-pressed", "true");
    }
    if (activeFilters[campo].length === 0) delete activeFilters[campo];
  }
  renderResultados();
}

document.getElementById("btnReset").addEventListener("click", () => {
  activeFilters = {};
  document.querySelectorAll("#filtersPanel .chip.is-selected").forEach(c => {
    c.classList.remove("is-selected");
    c.setAttribute("aria-pressed", "false");
  });
  renderResultados();
});

/* ---------------------------------------------------------
   LÓGICA DE COINCIDENCIA (con fix para variable en multi)
   --------------------------------------------------------- */
function coincide(bact) {
  return Object.entries(activeFilters).every(([campo, valor]) => {
    const def = ESQUEMA[campo];
    if (!def) return true;
    const bv = bact[campo];
    if (def.tipo === "single") {
      if (bv === undefined || bv === "") return true;
      if (bv === "variable") return true;
      return bv === valor;
    } else {
      const arr = bv || [];
      if (arr.includes("variable")) return true; // FIX: variable en multi
      return valor.every(v => arr.includes(v));
    }
  });
}

/* ---------------------------------------------------------
   RENDER: resultados
   --------------------------------------------------------- */
function renderResultados() {
  const match = bacterias.filter(coincide);
  const discard = bacterias.filter(b => !coincide(b));
  const nFiltros = Object.keys(activeFilters).length;

  const counterNum = document.getElementById("counterNumber");
  const counterLabel = document.getElementById("counterLabel");
  counterNum.textContent = bacterias.length ? match.length : "—";
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

  const discardWrap = document.getElementById("discardedWrap");
  const discardGrid = document.getElementById("discardedGrid");
  discardGrid.innerHTML = "";
  discard.forEach(b => discardGrid.appendChild(bactCard(b, true)));
  document.getElementById("discardedCount").textContent = `(${discard.length})`;

  // FIX: Ocultar descartadas si no hay filtros activos
  discardWrap.hidden = (nFiltros === 0);
}

/* Tags dinámicos según esquema */
function bactCard(b, discarded) {
  const card = document.createElement("div");
  card.className = `bact-card gram-${b.gram || ""} ${discarded ? "bact-card--discarded" : ""}`;

  const tags = [];
  Object.entries(ESQUEMA).forEach(([key, def]) => {
    if (def.tipo === "single" && b[key] && b[key] !== "") {
      tags.push(`${def.label}: ${b[key]}`);
    } else if (def.tipo === "multi" && b[key] && b[key].length > 0) {
      tags.push(`${def.label}: ${b[key].join(", ")}`);
    }
  });
  const displayTags = tags.slice(0, 6);

  card.innerHTML = `
    <h4>${b.nombre}</h4>
    <div class="tag-row">${displayTags.map(t => `<span class="tag">${t}</span>`).join("")}</div>
    <p>${b.notas || ""}</p>
  `;
  card.addEventListener("click", () => abrirFicha(b));
  return card;
}

/* ---------------------------------------------------------
   FICHA FLOTANTE (modal) con focus trap y todos los campos
   --------------------------------------------------------- */
function abrirFicha(b) {
  const modal = document.getElementById("bactModal");
  const body = document.getElementById("modalBody");

  const filas = Object.entries(ESQUEMA)
    .map(([campo, def]) => {
      const v = b[campo];
      let valorTexto;
      if (def.tipo === "multi") {
        valorTexto = (v && v.length) ? v.join(", ") : "no aplica";
      } else {
        valorTexto = (v !== undefined && v !== "") ? v : "no aplica";
      }
      return `<div class="modal-result"><span>${def.label}</span><span>${valorTexto}</span></div>`;
    }).join("");

  body.innerHTML = `
    <h2>${b.nombre}</h2>
    <div class="modal-genero">${b.genero || ""}</div>
    <div class="modal-section">
      <h4>Resultados</h4>
      <div class="modal-result-grid">${filas}</div>
    </div>
    ${b.notas ? `<div class="modal-section"><h4>Notas</h4><div class="modal-notes">${b.notas}</div></div>` : ""}
  `;
  modal.hidden = false;

  // Focus trap
  const card = modal.querySelector('.modal-card');
  trapFocus(card);
  modal.querySelector('.modal-close').focus();
}

function trapFocus(element) {
  const focusable = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  element._trapHandler = (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  element.addEventListener('keydown', element._trapHandler);
}

function removeTrapFocus(element) {
  if (element._trapHandler) {
    element.removeEventListener('keydown', element._trapHandler);
    delete element._trapHandler;
  }
}

document.getElementById("modalClose").addEventListener("click", cerrarFicha);
document.getElementById("bactModal").addEventListener("click", (e) => {
  if (e.target.id === "bactModal") cerrarFicha();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarFicha(); });

function cerrarFicha() {
  const modal = document.getElementById("bactModal");
  const card = modal.querySelector('.modal-card');
  removeTrapFocus(card);
  modal.hidden = true;
}

/* ---------------------------------------------------------
   INICIO
   --------------------------------------------------------- */
cargarDatos();

// ============================================================
// ATE — app.js  |  Core: auth, routing, API, utilities
// ============================================================

// ── CONFIG ── URL do Web App publicado no Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbzOCzj09yc7qMTUPBkiYaeO4L7695K5moIA5jWvYpt6bWOTs1DW8VP3qdzDynR2of_q/exec";

// ── ESTADO GLOBAL ──
const ATE = {
  usuario: null,
  perfil: null,
  nome: null,
  colaboradores: [],
  sortDir: {},
  paginas: {},
  relatorioAtual: null,
  importDados: []
};

const POR_PAGINA = 15;

// ============================================================
// API
// ============================================================
async function api(action, data = {}) {
  try {
    mostrarLoading(true);

    // CORREÇÃO: Se for login, envia apenas os dados digitados. 
    // Se forem outras ações, mescla os dados do usuário logado vindo ANTES do ...data
    const dadosFinais = action === "login" 
      ? data 
      : { usuario: ATE.usuario, perfil: ATE.perfil, nome: ATE.nome, ...data };

    const payload = JSON.stringify({
      action,
      data: dadosFinais
    });

    const url = `${API_URL}?payload=${encodeURIComponent(payload)}`;
    console.log(`[ATE] → ${action}`, dadosFinais);

    // Mudando para POST: Os dados vão encapsulados no body de forma limpa e segura
    const resp = await fetch(API_URL, { 
      method: "POST",
      mode: "cors",
      body: payload,
      redirect: "follow"
    });

    const texto = await resp.text();
    console.log(`[ATE] ← ${action} (${resp.status}):`, texto.substring(0, 300));

    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${texto.substring(0, 100)}`);

    let json;
    try {
      json = JSON.parse(texto);
    } catch {
      throw new Error("Resposta inválida do servidor. Verifique se o Apps Script foi republicado corretamente.");
    }

    return json;

  } catch (err) {
    console.error(`[ATE] Erro em '${action}':`, err);
    toast(`Erro: ${err.message}`, "error");
    return { ok: false, msg: err.message };
  } finally {
    mostrarLoading(false);
  }
}
// ============================================================
// INTERCEPTADOR DO FORMULÁRIO DE LOGIN (ADICIONAR NO APP.JS)
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const formLogin = document.getElementById("form-login");
  
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault(); // Impede o HTML de atualizar a página ou perder os dados dos inputs
      await fazerLogin(); // Executa o login com os dados capturados com segurança
    });
  }
});
// ============================================================
// AUTH
// ============================================================
async function fazerLogin() {
  const usuario = document.getElementById("login-usuario").value.trim();
  const senha   = document.getElementById("login-senha").value;
  const erroEl  = document.getElementById("login-erro");
  const btnTxt  = document.getElementById("login-txt");

  if (!usuario || !senha) {
    erroEl.textContent = "Preencha usuário e senha.";
    erroEl.classList.remove("hidden");
    return;
  }

  erroEl.classList.add("hidden");
  btnTxt.textContent = "Entrando...";

  const res = await api("login", { usuario, senha });
  btnTxt.textContent = "Entrar";

  if (res.ok) {
    iniciarSessao(res);
  } else {
    erroEl.textContent = res.msg || "Credenciais inválidas.";
    erroEl.classList.remove("hidden");
  }
}

function iniciarSessao(res) {
  ATE.usuario = res.usuario;
  ATE.perfil  = res.perfil;
  ATE.nome    = res.nome;

  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("sidebar-nome").textContent   = res.nome;
  document.getElementById("sidebar-perfil").textContent = res.perfil;
  document.getElementById("sidebar-avatar").textContent = res.nome.charAt(0).toUpperCase();

  // Ocultar menus de admin para gestor
  if (res.perfil === "gestor") {
    document.querySelector('[data-page="importacao"]')?.classList.add("hidden");
  }

  navigateTo("dashboard");
}

function fazerLogout() {
  ATE.usuario = null; ATE.perfil = null; ATE.nome = null;
  ATE.colaboradores = [];
  document.getElementById("app").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("login-senha").value = "";
}

function toggleSenha() {
  const input = document.getElementById("login-senha");
  input.type = input.type === "password" ? "text" : "password";
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
const PAGE_TITLES = {
  dashboard: "Dashboard",
  colaboradores: "Colaboradores",
  avaliacoes: "Avaliações",
  importacao: "Importação",
  relatorios: "Relatórios",
  historico: "Histórico"
};

function navigateTo(page) {
  // Atualizar nav
  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.page === page);
  });

  // Trocar página
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${page}`)?.classList.add("active");
  document.getElementById("topbar-title").textContent = PAGE_TITLES[page] || page;

  // Fechar sidebar mobile
  if (window.innerWidth <= 768) document.getElementById("sidebar").classList.remove("open");

  // Carregar dados da página
  switch (page) {
    case "dashboard":     carregarDashboard(); break;
    case "colaboradores": carregarColaboradores(); break;
    case "avaliacoes":    carregarAvaliacoes(); break;
    case "historico":     carregarHistorico(); break;
  }
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// ============================================================
// TOASTS
// ============================================================
const TOAST_ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
};

function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `${TOAST_ICONS[type] || ""}<span>${msg}</span>`;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ============================================================
// LOADING
// ============================================================
function mostrarLoading(show) {
  document.getElementById("loading").classList.toggle("hidden", !show);
}

// ============================================================
// UTILITÁRIOS DE DATA
// ============================================================
function formatarData(str) {
  if (!str) return "—";
  if (str.includes("/")) return str;
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

function dataParaInput(str) {
  if (!str) return "";
  if (str.includes("-")) return str;
  const [d, m, y] = str.split("/");
  return `${y}-${m}-${d}`;
}

function inputParaData(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function calcularDatasAvaliacao(admissao) {
  const base = new Date(admissao + "T00:00:00");
  const add = (dias) => {
    const d = new Date(base); d.setDate(d.getDate() + dias);
    return d.toLocaleDateString("pt-BR");
  };
  return { p1: add(30), p2: add(60), p3: add(80) };
}

function statusBadgeHtml(status) {
  const map = {
    "EM DIA":                { cls: "badge-green",  label: "Em dia" },
    "PRÓXIMO DO VENCIMENTO": { cls: "badge-amber",  label: "Próximo" },
    "ATRASADO":              { cls: "badge-red",    label: "Atrasado" },
    "CONCLUÍDO":             { cls: "badge-blue",   label: "Concluído" },
    "PENDENTE":              { cls: "badge-gray",   label: "Pendente" },
    "REALIZADA":             { cls: "badge-green",  label: "Realizada" },
    "EM EXPERIÊNCIA":        { cls: "badge-blue",   label: "Em experiência" },
    "EFETIVADO":             { cls: "badge-green",  label: "Efetivado" },
    "DESLIGADO":             { cls: "badge-red",    label: "Desligado" },
    "APROVADO":              { cls: "badge-green",  label: "Aprovado" },
    "REPROVADO":             { cls: "badge-red",    label: "Reprovado" }
  };
  const m = map[status] || { cls: "badge-gray", label: status || "—" };
  return `<span class="badge ${m.cls}">${m.label}</span>`;
}

// ============================================================
// PAGINAÇÃO GENÉRICA
// ============================================================
function renderPaginacao(containerEl, total, paginaAtual, chave, callback) {
  const totalPags = Math.ceil(total / POR_PAGINA);
  if (totalPags <= 1) { containerEl.innerHTML = ""; return; }

  let html = `<button class="pag-btn" onclick="${callback}(${paginaAtual - 1})" ${paginaAtual <= 1 ? "disabled" : ""}>‹</button>`;
  for (let i = 1; i <= totalPags; i++) {
    if (i === 1 || i === totalPags || Math.abs(i - paginaAtual) <= 1) {
      html += `<button class="pag-btn ${i === paginaAtual ? "active" : ""}" onclick="${callback}(${i})">${i}</button>`;
    } else if (Math.abs(i - paginaAtual) === 2) {
      html += `<span style="padding:0 4px;color:var(--muted)">…</span>`;
    }
  }
  html += `<button class="pag-btn" onclick="${callback}(${paginaAtual + 1})" ${paginaAtual >= totalPags ? "disabled" : ""}>›</button>`;
  containerEl.innerHTML = html;
}

// ============================================================
// ORDENAÇÃO
// ============================================================
function ordenarPor(arr, campo) {
  ATE.sortDir[campo] = ATE.sortDir[campo] === "asc" ? "desc" : "asc";
  const dir = ATE.sortDir[campo] === "asc" ? 1 : -1;
  return [...arr].sort((a, b) => {
    const va = (a[campo] || "").toString().toLowerCase();
    const vb = (b[campo] || "").toString().toLowerCase();
    return va < vb ? -dir : va > vb ? dir : 0;
  });
}

// ============================================================
// EXPORTAR CSV
// ============================================================
function exportarCSV() {
  if (!ATE.relatorioAtual || !ATE.relatorioAtual.length) {
    toast("Nenhum dado para exportar", "warning"); return;
  }

  const cols = Object.keys(ATE.relatorioAtual[0]);
  const linhas = [cols.join(";")];
  ATE.relatorioAtual.forEach(r => linhas.push(cols.map(c => `"${(r[c] || "").toString().replace(/"/g, '""')}"`).join(";")));

  const blob = new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `ATE_relatorio_${Date.now()}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast("CSV exportado!", "success");
}

function imprimirRelatorio() { window.print(); }

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay:not(.hidden)").forEach(m => m.classList.add("hidden"));
  }
});

// Fechar modal ao clicar fora
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
});

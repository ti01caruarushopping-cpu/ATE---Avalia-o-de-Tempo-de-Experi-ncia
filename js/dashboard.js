// ============================================================
// ATE — dashboard.js  |  KPIs, gráficos, alertas
// ============================================================

async function carregarDashboard() {
  const res = await api("getDashboard");
  if (res.ok) renderDashboard(res);
  else toast(res.msg || "Erro ao carregar dashboard.", "error");
}

function renderDashboard(d) {
  document.getElementById("k-em-experiencia").textContent = d.emExperiencia ?? 0;
  document.getElementById("k-pendentes").textContent      = d.pendentes ?? 0;
  document.getElementById("k-vencidas").textContent       = d.vencidas ?? 0;
  document.getElementById("k-concluidos").textContent     = d.concluidos ?? 0;
  document.getElementById("k-aprovacao").textContent      = `${d.percentualAprovacao ?? 0}%`;

  // Notificações no topbar
  const total = (d.vencidas || 0) + (d.pendentes || 0);
  const badge = document.getElementById("notif-count");
  badge.textContent = total > 0 ? total : "";

  renderBarChart("chart-setor", d.porSetor || []);
  renderBarChart("chart-lider", d.porLider || []);
  renderAlerts(d);

  // Tornar KPI cards clicáveis
  _bindKpiCards();
}

// ──────────────────────────────────────────────
// KPI CARDS CLICÁVEIS
// ──────────────────────────────────────────────
function _bindKpiCards() {
  // Mapeamento: id do elemento de valor → filtro a aplicar em colaboradores
  const kpiMap = [
    {
      id:      "k-em-experiencia",
      label:   "Em Experiência",
      filtro:  () => _filtrarColaboradoresPorKpi("situacao", "EM EXPERIÊNCIA"),
      tooltip: "Ver colaboradores em experiência"
    },
    {
      id:      "k-pendentes",
      label:   "Pendentes",
      filtro:  () => _filtrarColaboradoresPorKpi("status", "PRÓXIMO DO VENCIMENTO"),
      tooltip: "Ver avaliações pendentes (próximas do vencimento)"
    },
    {
      id:      "k-vencidas",
      label:   "Vencidas",
      filtro:  () => _filtrarColaboradoresPorKpi("status", "ATRASADO"),
      tooltip: "Ver colaboradores com avaliações vencidas"
    },
    {
      id:      "k-concluidos",
      label:   "Concluídos",
      filtro:  () => _filtrarColaboradoresPorKpi("status", "CONCLUÍDO"),
      tooltip: "Ver colaboradores com processo concluído"
    },
    {
      id:      "k-aprovacao",
      label:   "Aprovados",
      filtro:  () => _filtrarColaboradoresPorKpi("situacao", "EFETIVADO"),
      tooltip: "Ver colaboradores efetivados (aprovados)"
    }
  ];

  kpiMap.forEach(({ id, filtro, tooltip }) => {
    // Sobe até o .kpi-card pai
    const valEl = document.getElementById(id);
    if (!valEl) return;
    const card = valEl.closest(".kpi-card");
    if (!card) return;

    // Estilo de interatividade
    card.style.cursor  = "pointer";
    card.title         = tooltip;
    card.style.transition = "transform .15s, box-shadow .15s, outline .1s";

    // Remove listener antigo (evita duplicatas em re-renders)
    card.onclick = null;
    card.onclick = () => {
      filtro();
    };

    // Feedback visual de hover já está no CSS, mas garantimos foco via teclado
    card.setAttribute("tabindex", "0");
    card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") filtro(); };
  });
}

function _filtrarColaboradoresPorKpi(tipo, valor) {
  // Navega para a aba de colaboradores
  navigateTo("colaboradores");

  // Aguarda a renderização e aplica o filtro
  setTimeout(() => {
    const filtroStatus   = document.getElementById("filtro-status");
    const busca          = document.getElementById("busca-colaborador");
    const filtroEmpresa  = document.getElementById("filtro-empresa");

    // Limpa filtros anteriores
    if (busca)         busca.value         = "";
    if (filtroEmpresa) filtroEmpresa.value = "";
    if (filtroStatus)  filtroStatus.value  = "";

    if (tipo === "status" && filtroStatus) {
      filtroStatus.value = valor;
    } else if (tipo === "situacao") {
      // Filtragem por situação final não tem select dedicado na tabela,
      // mas podemos usar o status_atual "CONCLUÍDO" para concluídos
      // e ajustar a busca textual quando necessário.
      // Para "EM EXPERIÊNCIA" e "EFETIVADO" usamos o mapeamento de status_atual:
      // - EM EXPERIÊNCIA → exibe todos que não são CONCLUÍDO (sem filtro de status)
      // - EFETIVADO      → usa o filtro "CONCLUÍDO" no status_atual (são os mesmos registros)
      if (valor === "EFETIVADO") {
        if (filtroStatus) filtroStatus.value = "CONCLUÍDO";
      }
      // Para "EM EXPERIÊNCIA" deixamos sem filtro de status pois todos os não-concluídos
      // já aparecem — o usuário verá a lista completa de ativos.
    }

    filtrarColaboradores();

    // Toast explicativo
    const msgs = {
      "ATRASADO":              "🔴 Mostrando colaboradores com avaliações vencidas",
      "PRÓXIMO DO VENCIMENTO": "🟡 Mostrando colaboradores com avaliações pendentes",
      "CONCLUÍDO":             "✅ Mostrando colaboradores com processo concluído",
      "EM EXPERIÊNCIA":        "🔵 Mostrando todos os colaboradores em experiência",
      "EFETIVADO":             "🟢 Mostrando colaboradores efetivados (aprovados)"
    };
    toast(msgs[valor] || `Filtrado por: ${valor}`, "info");
  }, 120);
}

function renderBarChart(containerId, dados) {
  const el = document.getElementById(containerId);
  if (!dados.length) { el.innerHTML = `<p style="color:var(--muted);font-size:.82rem;padding:20px 0">Sem dados.</p>`; return; }

  const max = Math.max(...dados.map(d => d.valor), 1);
  el.innerHTML = `<div class="bar-chart">${dados.map(d => `
    <div class="bar-row">
      <span class="bar-label" title="${d.label}">${d.label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round((d.valor / max) * 100)}%"></div>
      </div>
      <span class="bar-value">${d.valor}</span>
    </div>`).join("")}</div>`;
}

function renderAlerts(d) {
  const el = document.getElementById("alerts-list");
  const items = [];

  if (d.vencidas > 0) items.push({
    type: "red",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    msg: `<strong>${d.vencidas}</strong> avaliação(ões) em atraso — atenção imediata necessária.`
  });

  if (d.pendentes > 0) items.push({
    type: "amber",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    msg: `<strong>${d.pendentes}</strong> avaliação(ões) pendente(s) nos próximos dias.`
  });

  if (d.concluidos > 0) items.push({
    type: "green",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    msg: `<strong>${d.concluidos}</strong> colaborador(es) com processo concluído. Taxa de aprovação: <strong>${d.percentualAprovacao}%</strong>.`
  });

  if (!items.length) items.push({ type: "green", icon: "✅", msg: "Nenhum alerta no momento. Tudo em ordem!" });

  el.innerHTML = items.map(i => `
    <div class="alert-item ${i.type}">
      ${i.icon}
      <span>${i.msg}</span>
    </div>`).join("");
}

// ── DADOS DEMO ──
function _demoDashboard() {
  return {
    emExperiencia: 12,
    pendentes: 5,
    vencidas: 3,
    concluidos: 8,
    aprovados: 6,
    percentualAprovacao: 75,
    porSetor: [
      { label: "Administrativo", valor: 4 },
      { label: "Operações", valor: 3 },
      { label: "TI", valor: 2 },
      { label: "RH", valor: 2 },
      { label: "Financeiro", valor: 1 }
    ],
    porLider: [
      { label: "Davydson", valor: 4 },
      { label: "Crispim", valor: 3 },
      { label: "Karenina", valor: 3 },
      { label: "Thaisa", valor: 2 }
    ]
  };
}

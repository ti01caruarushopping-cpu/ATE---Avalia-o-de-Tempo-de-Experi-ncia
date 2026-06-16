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

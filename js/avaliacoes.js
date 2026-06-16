// ============================================================
// ATE — avaliacoes.js  |  Controle e formulário de avaliações
// ============================================================

const CRITERIOS = [
  "Assiduidade", "Pontualidade", "Relacionamento Interpessoal",
  "Comprometimento", "Produtividade", "Organização",
  "Conhecimento Técnico", "Postura Profissional",
  "Trabalho em Equipe", "Comunicação"
];

const NOTAS_LABEL = { 1: "Insatisfatório", 2: "Regular", 3: "Satisfatório", 4: "Excelente" };

let _avalFiltrados = [];
let _avalPagina = 1;
let _notasAtuais = {};

// ──────────────────────────────────────────────
// TABELA DE CONTROLE
// ──────────────────────────────────────────────
async function carregarAvaliacoes() {
  if (!ATE.colaboradores.length) await carregarColaboradores();
  _aplicarFiltroAvaliacoes();
}

function filtrarAvaliacoes() {
  _aplicarFiltroAvaliacoes();
}

function _aplicarFiltroAvaliacoes() {
  const busca  = (document.getElementById("busca-aval")?.value || "").toLowerCase();
  const status = document.getElementById("filtro-aval-status")?.value || "";
  const lider  = document.getElementById("filtro-aval-lider")?.value || "";

  // Atualizar select de líderes
  const lideres = [...new Set(ATE.colaboradores.map(c => c.lider_imediato).filter(Boolean))].sort();
  const sel = document.getElementById("filtro-aval-lider");
  if (sel && sel.options.length <= 1) {
    lideres.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l; opt.textContent = l;
      sel.appendChild(opt);
    });
  }

  _avalFiltrados = ATE.colaboradores.filter(c => {
    const matchBusca = !busca || c.nome?.toLowerCase().includes(busca);
    const matchLider = !lider || c.lider_imediato === lider;
    const matchStatus = !status || c.status_atual === status;
    return matchBusca && matchLider && matchStatus;
  });

  // Contar alertas
  const atrasadas = _avalFiltrados.filter(c => c.status_atual === "ATRASADO").length;
  const proximas  = _avalFiltrados.filter(c => c.status_atual === "PRÓXIMO DO VENCIMENTO").length;
  document.getElementById("badge-atrasadas").textContent = `${atrasadas} atrasada${atrasadas !== 1 ? "s" : ""}`;
  document.getElementById("badge-proximas").textContent  = `${proximas} próxima${proximas !== 1 ? "s" : ""}`;

  _avalPagina = 1;
  _renderTabelaAvaliacoes();
}

function _renderTabelaAvaliacoes() {
  const tbody  = document.getElementById("tbody-avaliacoes");
  const inicio = (_avalPagina - 1) * POR_PAGINA;
  const pagina = _avalFiltrados.slice(inicio, inicio + POR_PAGINA);

  if (!pagina.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-row">Nenhum colaborador encontrado.</td></tr>`;
    document.getElementById("pag-avaliacoes").innerHTML = "";
    return;
  }

  tbody.innerHTML = pagina.map(c => {
    const tipo = _tipoProximo(c);
    return `
    <tr>
      <td><strong style="color:var(--text)">${c.nome}</strong></td>
      <td>${c.setor || "—"}</td>
      <td>${c.lider_imediato || "—"}</td>
      <td>${_avalCelula(c.data_primeira_avaliacao, c.status_primeira)}</td>
      <td>${_avalCelula(c.data_segunda_avaliacao, c.status_segunda)}</td>
      <td>${_avalCelula(c.data_terceira_avaliacao, c.status_terceira)}</td>
      <td>${statusBadgeHtml(c.status_atual)}</td>
      <td>
        ${tipo ? `
        <button class="btn-primary" style="padding:6px 12px;font-size:.78rem" onclick="abrirModalAvaliacao('${c.id}','${tipo}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M9 11l3 3L22 4"/></svg>
          Avaliar
        </button>` : `<span class="badge badge-blue">Concluído</span>`}
      </td>
    </tr>`;
  }).join("");

  renderPaginacao(
    document.getElementById("pag-avaliacoes"),
    _avalFiltrados.length, _avalPagina, "aval", "irPaginaAval"
  );
}

function irPaginaAval(p) {
  _avalPagina = p;
  _renderTabelaAvaliacoes();
}

function _avalCelula(data, status) {
  if (!data) return "—";
  const dot = status === "REALIZADA" ? "done" : "pending";
  const label = status === "REALIZADA" ? "Realizada" : data;
  return `<div class="aval-status-item"><div class="aval-dot ${dot}"></div><span style="font-size:.78rem;font-family:var(--mono)">${label}</span></div>`;
}

function _tipoProximo(c) {
  if (c.status_primeira !== "REALIZADA") return "1ª AVALIAÇÃO";
  if (c.status_segunda  !== "REALIZADA") return "2ª AVALIAÇÃO";
  if (c.status_terceira !== "REALIZADA") return "3ª AVALIAÇÃO";
  return null;
}

// ──────────────────────────────────────────────
// MODAL DE AVALIAÇÃO
// ──────────────────────────────────────────────
function abrirModalAvaliacao(idColab, tipo) {
  if (!tipo) { toast("Todas as avaliações já foram realizadas.", "info"); return; }

  const colab = ATE.colaboradores.find(c => c.id === idColab);
  if (!colab) return;

  _notasAtuais = {};

  document.getElementById("aval-id-colaborador").value = idColab;
  document.getElementById("aval-tipo").value           = tipo;
  document.getElementById("modal-aval-title").textContent = `${tipo} — ${colab.nome}`;
  document.getElementById("modal-aval-sub").textContent   = `${colab.setor} · ${colab.cargo} · Líder: ${colab.lider_imediato}`;

  // Data padrão = hoje
  const hoje = new Date();
  document.getElementById("aval-data").value = hoje.toISOString().split("T")[0];
  document.getElementById("aval-avaliador").value = ATE.nome || ATE.usuario;

  // Renderizar critérios
  const grid = document.getElementById("criterios-grid");
  grid.innerHTML = CRITERIOS.map(c => `
    <div class="criterio-row" id="cr-${_slug(c)}">
      <span class="criterio-nome">${c}</span>
      <div class="notas-row">
        ${[1,2,3,4].map(n => `
          <button type="button" class="nota-btn" data-criterio="${c}" data-nota="${n}"
            title="${NOTAS_LABEL[n]}" onclick="selecionarNota(this,'${c}',${n})">
            ${n}
          </button>`).join("")}
      </div>
      <div class="criterio-obs">
        <input type="text" placeholder="Observação (opcional)" id="obs-${_slug(c)}" />
      </div>
    </div>`).join("");

  _atualizarResultado();
  document.getElementById("modal-avaliacao").classList.remove("hidden");
}

function fecharModalAvaliacao() {
  document.getElementById("modal-avaliacao").classList.add("hidden");
}

function selecionarNota(btn, criterio, nota) {
  // Deselect siblings
  btn.closest(".notas-row").querySelectorAll(".nota-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  _notasAtuais[criterio] = nota;
  _atualizarResultado();
}

function _atualizarResultado() {
  const notas = Object.values(_notasAtuais);
  if (!notas.length) {
    document.getElementById("media-geral").textContent    = "—";
    document.getElementById("pct-geral").textContent      = "—";
    document.getElementById("resultado-final").textContent = "—";
    document.getElementById("resultado-final").className  = "badge";
    return;
  }

  const media = notas.reduce((a, b) => a + b, 0) / notas.length;
  const pct   = Math.round((media / 4) * 100);
  const result = media >= 3 ? "APROVADO" : "REPROVADO";

  document.getElementById("media-geral").textContent     = media.toFixed(2);
  document.getElementById("pct-geral").textContent       = `${pct}%`;
  document.getElementById("resultado-final").textContent  = result;
  document.getElementById("resultado-final").className   = `badge ${result === "APROVADO" ? "badge-green" : "badge-red"}`;
}

async function confirmarAvaliacao() {
  // Validar: todos critérios com nota
  const faltando = CRITERIOS.filter(c => !_notasAtuais[c]);
  if (faltando.length) {
    toast(`Avalie todos os critérios. Faltam: ${faltando.length}`, "warning");
    // Destacar faltando
    faltando.forEach(c => {
      const row = document.getElementById(`cr-${_slug(c)}`);
      if (row) { row.style.border = "2px solid var(--red)"; setTimeout(() => row.style.border = "", 2000); }
    });
    return;
  }

  const idColab = document.getElementById("aval-id-colaborador").value;
  const tipo    = document.getElementById("aval-tipo").value;
  const data    = document.getElementById("aval-data").value;
  const avaliador = document.getElementById("aval-avaliador").value;

  const criterios = CRITERIOS.map(c => ({
    criterio: c, nota: _notasAtuais[c],
    observacao: document.getElementById(`obs-${_slug(c)}`)?.value || ""
  }));

  if (API_URL.includes("SEU_DEPLOYMENT_ID")) {
    _demoSalvarAvaliacao(idColab, tipo);
    fecharModalAvaliacao();
    toast("Avaliação registrada com sucesso!", "success");
    return;
  }

  const res = await api("salvarAvaliacao", {
    id_colaborador: idColab, tipo_avaliacao: tipo,
    data_avaliacao: inputParaData(data), avaliador, criterios
  });

  if (res.ok) {
    fecharModalAvaliacao();
    toast(`Avaliação salva! Média: ${res.media} — ${res.resultado}`, "success");
    await carregarColaboradores();
  } else {
    toast(res.msg || "Erro ao salvar avaliação.", "error");
  }
}

// ── RELATÓRIOS (usado em relatorios.js mas definido aqui) ──
async function gerarRelatorio(tipo) {
  const titles = {
    por_setor:  "Colaboradores por Setor",
    vencidas:   "Avaliações Vencidas",
    pendentes:  "Avaliações Pendentes",
    aprovados:  "Aprovados / Efetivados",
    reprovados: "Reprovados / Desligados"
  };

  document.getElementById("report-title").textContent = titles[tipo] || tipo;

  let dados = [];
  if (API_URL.includes("SEU_DEPLOYMENT_ID")) {
    dados = _filtrarRelatorioDemo(tipo);
  } else {
    const res = await api("gerarRelatorio", { tipo });
    if (!res.ok) { toast("Erro ao gerar relatório", "error"); return; }
    dados = tipo === "por_setor" ? _flattenPorSetor(res.data) : res.data;
  }

  ATE.relatorioAtual = dados;

  const cols = ["nome", "setor", "cargo", "lider_imediato", "empresa", "data_admissao", "situacao_final"];
  const thead = document.getElementById("thead-relatorio");
  thead.innerHTML = `<tr>${cols.map(c => `<th>${c.replace(/_/g," ").toUpperCase()}</th>`).join("")}</tr>`;

  const tbody = document.getElementById("tbody-relatorio");
  if (!dados.length) {
    tbody.innerHTML = `<tr><td colspan="${cols.length}" class="empty-row">Sem registros.</td></tr>`;
  } else {
    tbody.innerHTML = dados.map(r => `
      <tr>${cols.map(c => `<td>${r[c] || "—"}</td>`).join("")}</tr>`).join("");
  }

  document.getElementById("report-result").classList.remove("hidden");
}

function _flattenPorSetor(obj) {
  return Object.values(obj).flat();
}

function _filtrarRelatorioDemo(tipo) {
  const c = ATE.colaboradores;
  switch (tipo) {
    case "vencidas":   return c.filter(x => x.status_atual === "ATRASADO");
    case "pendentes":  return c.filter(x => ["EM DIA","PRÓXIMO DO VENCIMENTO"].includes(x.status_atual));
    case "aprovados":  return c.filter(x => x.situacao_final === "EFETIVADO");
    case "reprovados": return c.filter(x => x.situacao_final === "DESLIGADO");
    default:           return c;
  }
}

// ── HISTÓRICO ──
let _histDados = [], _histPagina = 1;

async function carregarHistorico() {
  if (API_URL.includes("SEU_DEPLOYMENT_ID")) {
    _histDados = _demoHistorico();
    filtrarHistorico();
    return;
  }
  const res = await api("getHistorico");
  if (res.ok) { _histDados = res.data || []; filtrarHistorico(); }
}

function filtrarHistorico() {
  const busca = (document.getElementById("busca-historico")?.value || "").toLowerCase();
  const filtrado = busca
    ? _histDados.filter(h => h.acao?.toLowerCase().includes(busca) || h.detalhes?.toLowerCase().includes(busca) || h.id_colaborador?.includes(busca) || h.usuario?.toLowerCase().includes(busca))
    : _histDados;

  _histPagina = 1;
  _renderHistorico(filtrado);
}

function _renderHistorico(dados) {
  const tbody = document.getElementById("tbody-historico");
  const inicio = (_histPagina - 1) * POR_PAGINA;
  const pagina = dados.slice(inicio, inicio + POR_PAGINA);

  if (!pagina.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = pagina.map(h => {
    const acaoCls = h.acao?.includes("AVALIAÇÃO") ? "AVALIAÇÃO" : (h.acao || "DEFAULT");
    const colab = ATE.colaboradores.find(c => c.id === h.id_colaborador);
    return `
    <tr>
      <td style="font-family:var(--mono);font-size:.78rem;white-space:nowrap">${h.data_hora || "—"}</td>
      <td>${colab ? colab.nome : (h.id_colaborador || "—")}</td>
      <td><span class="acao-badge ${acaoCls}">${h.acao || "—"}</span></td>
      <td>${h.usuario || "—"}</td>
      <td style="font-size:.8rem;color:var(--muted)">${h.detalhes || "—"}</td>
    </tr>`;
  }).join("");

  renderPaginacao(
    document.getElementById("pag-historico"),
    dados.length, _histPagina, "hist", "irPaginaHist"
  );
}

function irPaginaHist(p) { _histPagina = p; filtrarHistorico(); }

// ── UTILITÁRIO ──
function _slug(str) { return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""); }

// ── DEMO ──
function _demoSalvarAvaliacao(idColab, tipo) {
  const c = ATE.colaboradores.find(x => x.id === idColab);
  if (!c) return;
  if (tipo === "1ª AVALIAÇÃO") c.status_primeira = "REALIZADA";
  if (tipo === "2ª AVALIAÇÃO") c.status_segunda  = "REALIZADA";
  if (tipo === "3ª AVALIAÇÃO") c.status_terceira = "REALIZADA";
  // Recalcular status
  const prox = _tipoProximo(c);
  c.status_atual = prox ? "EM DIA" : "CONCLUÍDO";
  c.proxima_avaliacao = prox ? (prox === "2ª AVALIAÇÃO" ? c.data_segunda_avaliacao : c.data_terceira_avaliacao) : null;
}

function _demoHistorico() {
  const acoes = ["CADASTRO","EDIÇÃO","AVALIAÇÃO REALIZADA","EXCLUSÃO"];
  return Array.from({ length: 20 }, (_, i) => ({
    id: `h${i}`, id_colaborador: `demo-${i % 8}`,
    acao: acoes[i % 4],
    usuario: ["admin","gestor","Karenina","Davydson"][i % 4],
    data_hora: new Date(Date.now() - i * 3600000 * 6).toLocaleString("pt-BR"),
    detalhes: `Registro de atividade #${i + 1} do sistema ATE.`
  }));
}

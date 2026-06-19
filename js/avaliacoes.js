// ============================================================
// ATE — avaliacoes.js  |  Controle e formulário de avaliações
// ============================================================

let _avalFiltrados = [];
let _avalPagina = 1;

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
    const matchBusca  = !busca  || c.nome?.toLowerCase().includes(busca);
    const matchLider  = !lider  || c.lider_imediato === lider;
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
          Registrar
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
// MODAL DE AVALIAÇÃO — Simplificado (sem critérios/notas)
// ──────────────────────────────────────────────
function abrirModalAvaliacao(idColab, tipo) {
  if (!tipo) { toast("Todas as avaliações já foram realizadas.", "info"); return; }

  const colab = ATE.colaboradores.find(c => c.id === idColab);
  if (!colab) return;

  document.getElementById("aval-id-colaborador").value = idColab;
  document.getElementById("aval-tipo").value           = tipo;
  document.getElementById("modal-aval-title").textContent = `${tipo} — ${colab.nome}`;
  document.getElementById("modal-aval-sub").textContent   =
    `${colab.setor} · ${colab.cargo} · Líder: ${colab.lider_imediato}`;

  // Data padrão = hoje
  const hoje = new Date();
  document.getElementById("aval-data").value       = hoje.toISOString().split("T")[0];
  document.getElementById("aval-avaliador").value  = "";
  document.getElementById("aval-lancador").value   = ATE.nome || ATE.usuario;

  // Resultado simplificado: APROVADO por padrão (RH registra conforme avaliação do gestor)
  document.getElementById("aval-resultado-select").value = "APROVADO";

  // Observação em branco
  document.getElementById("aval-observacao").value = "";

  document.getElementById("modal-avaliacao").classList.remove("hidden");
  document.getElementById("aval-avaliador").focus();
}

function fecharModalAvaliacao() {
  document.getElementById("modal-avaliacao").classList.add("hidden");
}

async function confirmarAvaliacao() {
  const idColab    = document.getElementById("aval-id-colaborador").value;
  const tipo       = document.getElementById("aval-tipo").value;
  const data       = document.getElementById("aval-data").value;
  const avaliador  = document.getElementById("aval-avaliador").value.trim();
  const lancador   = document.getElementById("aval-lancador").value.trim();
  const resultado  = document.getElementById("aval-resultado-select").value;
  const observacao = document.getElementById("aval-observacao").value.trim();

  if (!data) {
    toast("Informe a data da avaliação.", "warning"); return;
  }
  if (!avaliador) {
    toast("Informe o nome do avaliador (gestor).", "warning"); return;
  }

  // Envia para o backend com um único critério sintético
  const res = await api("salvarAvaliacao", {
    id_colaborador: idColab,
    tipo_avaliacao: tipo,
    data_avaliacao: inputParaData(data),
    avaliador,
    lancador,
    criterios: [{
      criterio: "Avaliação Geral",
      nota: resultado === "APROVADO" ? 4 : 1,
      observacao: observacao || `Lançado por: ${lancador}`
    }]
  });

  if (res.ok) {
    fecharModalAvaliacao();
    toast(`Avaliação registrada com sucesso — ${resultado}`, "success");
    await carregarColaboradores();
  } else {
    toast(res.msg || "Erro ao salvar avaliação.", "error");
  }
}

// ── RELATÓRIOS ──
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
  const res = await api("gerarRelatorio", { tipo });
  if (!res.ok) { toast("Erro ao gerar relatório", "error"); return; }
  dados = tipo === "por_setor" ? _flattenPorSetor(res.data) : (res.data || []);

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

// ── HISTÓRICO ──
let _histDados = [], _histPagina = 1;

async function carregarHistorico() {
  const res = await api("getHistorico");
  if (res.ok) { _histDados = res.data || []; filtrarHistorico(); }
  else toast(res.msg || "Erro ao carregar histórico.", "error");
}

function filtrarHistorico() {
  const busca = (document.getElementById("busca-historico")?.value || "").toLowerCase();
  const filtrado = busca
    ? _histDados.filter(h =>
        h.acao?.toLowerCase().includes(busca) ||
        h.detalhes?.toLowerCase().includes(busca) ||
        h.id_colaborador?.includes(busca) ||
        h.usuario?.toLowerCase().includes(busca))
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
function _slug(str) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

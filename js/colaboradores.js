// ============================================================
// ATE — colaboradores.js  |  CRUD de colaboradores
// ============================================================

let _colabFiltrados = [];
let _colabPagina = 1;

async function carregarColaboradores() {
  const res = await api("getColaboradores");
  if (res.ok) {
    ATE.colaboradores = res.data || [];
    _renderColaboradores();
  } else {
    toast(res.msg || "Erro ao carregar colaboradores.", "error");
  }
}

function _renderColaboradores() {
  // Atualizar filtro de empresa
  const empresas = [...new Set(ATE.colaboradores.map(c => c.empresa).filter(Boolean))];
  const selEmpresa = document.getElementById("filtro-empresa");
  const curEmp = selEmpresa.value;
  selEmpresa.innerHTML = `<option value="">Todas as empresas</option>` +
    empresas.map(e => `<option value="${e}" ${e === curEmp ? "selected" : ""}>${e}</option>`).join("");

  filtrarColaboradores();
}

function filtrarColaboradores() {
  const busca  = (document.getElementById("busca-colaborador")?.value || "").toLowerCase();
  const status = document.getElementById("filtro-status")?.value || "";
  const emp    = document.getElementById("filtro-empresa")?.value || "";

  _colabFiltrados = ATE.colaboradores.filter(c => {
    const matchBusca  = !busca  || c.nome?.toLowerCase().includes(busca) || c.setor?.toLowerCase().includes(busca) || c.cargo?.toLowerCase().includes(busca);
    const matchStatus = !status || c.status_atual === status;
    const matchEmp    = !emp    || c.empresa === emp;
    return matchBusca && matchStatus && matchEmp;
  });

  _colabPagina = 1;
  _renderTabelaColaboradores();
}

function ordenarTabela(campo) {
  _colabFiltrados = ordenarPor(_colabFiltrados, campo);
  _renderTabelaColaboradores();
}

function _renderTabelaColaboradores() {
  const tbody = document.getElementById("tbody-colaboradores");
  const inicio = (_colabPagina - 1) * POR_PAGINA;
  const pagina = _colabFiltrados.slice(inicio, inicio + POR_PAGINA);

  if (!pagina.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">Nenhum colaborador encontrado.</td></tr>`;
    document.getElementById("pag-colaboradores").innerHTML = "";
    return;
  }

  tbody.innerHTML = pagina.map(c => `
    <tr>
      <td><strong style="color:var(--text)">${c.nome}</strong></td>
      <td>${c.setor || "—"}</td>
      <td>${c.cargo || "—"}</td>
      <td>${c.lider_imediato || "—"}</td>
      <td>${c.empresa || "—"}</td>
      <td style="font-family:var(--mono);font-size:.8rem">${c.data_admissao || "—"}</td>
      <td style="font-family:var(--mono);font-size:.8rem">${c.proxima_avaliacao || "—"}</td>
      <td>${statusBadgeHtml(c.status_atual)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon eval" title="Realizar avaliação" onclick="abrirModalAvaliacao('${c.id}','${_tipoAvaliacao(c)}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          </button>
          <button class="btn-icon edit" title="Editar" onclick="abrirModalColaborador('${c.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon hist" title="Histórico" onclick="verHistoricoColab('${c.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          ${ATE.perfil === "administrador" ? `
          <button class="btn-icon del" title="Excluir" onclick="excluirColaborador('${c.id}','${c.nome.replace(/'/g,"\\'")}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>` : ""}
        </div>
      </td>
    </tr>`).join("");

  renderPaginacao(
    document.getElementById("pag-colaboradores"),
    _colabFiltrados.length, _colabPagina, "colab", "irPaginaColab"
  );
}

function irPaginaColab(p) {
  _colabPagina = p;
  _renderTabelaColaboradores();
}

function _tipoAvaliacao(c) {
  if (c.status_primeira !== "REALIZADA") return "1ª AVALIAÇÃO";
  if (c.status_segunda  !== "REALIZADA") return "2ª AVALIAÇÃO";
  if (c.status_terceira !== "REALIZADA") return "3ª AVALIAÇÃO";
  return "";
}

// ──────────────────────────────────────────────
// LISTAS DINÂMICAS — Setor e Líder Imediato
// Extraídas dos colaboradores já cadastrados, para popular os <select>
// ──────────────────────────────────────────────
function _listaSetoresUnicos() {
  return [...new Set(ATE.colaboradores.map(c => (c.setor || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function _listaLideresUnicos() {
  return [...new Set(ATE.colaboradores.map(c => (c.lider_imediato || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function _popularSelectColab(selectEl, lista, valorAtual) {
  const opcoesExtras = valorAtual && !lista.includes(valorAtual) ? [valorAtual] : [];
  const todasOpcoes = [...lista, ...opcoesExtras];
  selectEl.innerHTML = `<option value="">Selecione</option>` +
    todasOpcoes.map(v => `<option value="${v.replace(/"/g,'&quot;')}" ${v === valorAtual ? "selected" : ""}>${v}</option>`).join("");
}

function _popularListasColaborador(valorSetorAtual = "", valorLiderAtual = "") {
  const selSetor = document.getElementById("colab-setor");
  const selLider = document.getElementById("colab-lider");
  _popularSelectColab(selSetor, _listaSetoresUnicos(), valorSetorAtual);
  _popularSelectColab(selLider, _listaLideresUnicos(), valorLiderAtual);
}

// ──────────────────────────────────────────────
// MODAL COLABORADOR
// ──────────────────────────────────────────────
function abrirModalColaborador(id = null) {
  const modal = document.getElementById("modal-colaborador");
  const title = document.getElementById("modal-colab-title");

  document.getElementById("colab-id").value        = "";
  document.getElementById("colab-nome").value      = "";
  document.getElementById("colab-admissao").value  = "";
  document.getElementById("colab-empresa").value   = "";
  document.getElementById("datas-preview").innerHTML = "";

  if (id) {
    const c = ATE.colaboradores.find(x => x.id === id);
    if (!c) return;
    title.textContent = "Editar Colaborador";
    document.getElementById("colab-id").value       = c.id;
    document.getElementById("colab-nome").value     = c.nome;
    document.getElementById("colab-admissao").value = dataParaInput(c.data_admissao);
    document.getElementById("colab-empresa").value  = c.empresa;
    _popularListasColaborador(c.setor, c.lider_imediato);
    atualizarDatasPreview();
  } else {
    title.textContent = "Novo Colaborador";
    _popularListasColaborador("", "");
  }

  modal.classList.remove("hidden");
  document.getElementById("colab-nome").focus();
}

function fecharModalColaborador() {
  document.getElementById("modal-colaborador").classList.add("hidden");
}

// Preview das datas ao alterar admissão
document.getElementById("colab-admissao")?.addEventListener("input", atualizarDatasPreview);

function atualizarDatasPreview() {
  const admissao = document.getElementById("colab-admissao").value;
  const preview  = document.getElementById("datas-preview");
  if (!admissao) { preview.innerHTML = ""; return; }

  const datas = calcularDatasAvaliacao(admissao);
  preview.innerHTML = `
    <div class="dp-item"><span class="dp-label">1ª Avaliação (30 dias)</span><span class="dp-val">${datas.p1}</span></div>
    <div class="dp-item"><span class="dp-label">2ª Avaliação (60 dias)</span><span class="dp-val">${datas.p2}</span></div>
    <div class="dp-item"><span class="dp-label">3ª Avaliação (80 dias)</span><span class="dp-val">${datas.p3}</span></div>`;
}

async function salvarColaborador() {
  const id      = document.getElementById("colab-id").value;
  const nome    = document.getElementById("colab-nome").value.trim();
  const admissao = document.getElementById("colab-admissao").value;
  const setor   = document.getElementById("colab-setor").value;
  const cargo   = document.getElementById("colab-cargo").value.trim();
  const lider   = document.getElementById("colab-lider").value;
  const empresa = document.getElementById("colab-empresa").value;

  if (!nome || !admissao || !setor || !cargo || !lider || !empresa) {
    toast("Preencha todos os campos obrigatórios.", "warning"); return;
  }

  const payload = { nome, data_admissao: inputParaData(admissao), setor, cargo, lider_imediato: lider, empresa };
  const action = id ? "editarColaborador" : "salvarColaborador";
  const res = await api(action, { ...payload, id });
  if (res.ok) {
    fecharModalColaborador();
    toast(id ? "Colaborador atualizado!" : "Colaborador cadastrado!", "success");
    carregarColaboradores();
  } else {
    toast(res.msg || "Erro ao salvar.", "error");
  }
}

async function excluirColaborador(id, nome) {
  if (!confirm(`Excluir "${nome}"? Esta ação não pode ser desfeita.`)) return;

  const res = await api("excluirColaborador", { id });
  if (res.ok) {
    toast("Colaborador excluído.", "success");
    carregarColaboradores();
  } else {
    toast(res.msg || "Erro ao excluir.", "error");
  }
}

function verHistoricoColab(id) {
  navigateTo("historico");
  setTimeout(() => {
    document.getElementById("busca-historico").value = id;
    filtrarHistorico();
  }, 100);
}

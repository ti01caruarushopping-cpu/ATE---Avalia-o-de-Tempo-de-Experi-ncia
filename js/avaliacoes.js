// ============================================================
// ATE — avaliacoes.js  |  Controle, formulário de avaliações e Ficha do Colaborador
// ============================================================

// ── CRITÉRIOS OFICIAIS DA FICHA DE DESEMPENHO ──
// Nome curto usado nos botões de seleção de nota
const CRITERIOS = [
  "Assiduidade",
  "Pontualidade",
  "Comunicação",
  "Relacionamento interpessoal",
  "Espírito de equipe",
  "Habilidade técnica",
  "Maturidade emocional",
  "Responsabilidade profissional",
  "Criatividade",
  "Organização",
  "Colaborativo",
  "Ponto eletrônico"
];

// Descrição completa exibida na Ficha do Colaborador (coluna Critério)
const CRITERIOS_FICHA = [
  "Assiduidade: Cumprir todos os dias de trabalho.",
  "Pontualidade: Cumpre os horários de acordo com a escala, sendo pontual.",
  "Comunicação: Habilidade em saber ouvir e facilidade de entendimento.",
  "Relacionamento interpessoal: Relaciona-se de forma adequada com todos da empresa.",
  "Espírito de equipe: Capacidade de trabalhar em equipe.",
  "Habilidade técnica: Conhecimento técnico e prático na função desenvolvida.",
  "Maturidade emocional: Equilíbrio emocional e comportamental em suas relações de trabalho.",
  "Respo. profissional: Comportamento ético e moral no ambiente de trabalho.",
  "Criatividade: Imaginação útil, capacidade de imaginar ideias criativas, aplicáveis ao trabalho.",
  "Organização: Capacidade de controlar e programar as suas atividades.",
  "Colaborativo: Dispondo-se de mudança de plantão ou hora extra.",
  "Ponto eletrônico: Registra o ponto de forma correta, obedecendo o horário a qual foi escalado."
];

const CRITERIO_DESCRICOES = {
  "Assiduidade": "Cumprir todos os dias de trabalho.",
  "Pontualidade": "Cumpre os horários de acordo com a escala, sendo pontual.",
  "Comunicação": "Habilidade em saber ouvir e facilidade de entendimento.",
  "Relacionamento interpessoal": "Relaciona-se de forma adequada com todos da empresa.",
  "Espírito de equipe": "Capacidade de trabalhar em equipe.",
  "Habilidade técnica": "Conhecimento técnico e prático na função desenvolvida.",
  "Maturidade emocional": "Equilíbrio emocional e comportamental em suas relações de trabalho.",
  "Responsabilidade profissional": "Comportamento ético e moral no ambiente de trabalho.",
  "Criatividade": "Imaginação útil, capacidade de imaginar ideias criativas, aplicáveis ao trabalho.",
  "Organização": "Capacidade de controlar e programar as suas atividades.",
  "Colaborativo": "Dispondo-se de mudança de plantão ou hora extra.",
  "Ponto eletrônico": "Registra o ponto de forma correta, obedecendo o horário a qual foi escalado."
};

const NOTAS_LABEL = { 1: "Insatisfatório", 2: "Intermediário", 3: "Satisfatório", 4: "Excelente" };

const RECOMENDACOES = [
  { value: "PERMANECER",   label: "Permanecer no cargo — está capacitado" },
  { value: "RETREINAR",    label: "Ser novamente treinado e avaliado, dando-o uma nova oportunidade no mesmo cargo" },
  { value: "REMANEJAR",    label: "Ser remanejado para outro cargo de acordo com perfil técnico" },
  { value: "DESLIGAR",     label: "Ser desligado" }
];

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
        <div class="action-btns">
          ${tipo ? `
          <button class="btn-primary" style="padding:6px 12px;font-size:.78rem" onclick="abrirModalAvaliacao('${c.id}','${tipo}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M9 11l3 3L22 4"/></svg>
            Avaliar
          </button>` : `<span class="badge badge-blue">Concluído</span>`}
          <button class="btn-icon hist" title="Ver Ficha" onclick="abrirFichaColaborador('${c.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
        </div>
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
// MODAL DE AVALIAÇÃO — 12 critérios + Data/Avaliador/Lançador
// ──────────────────────────────────────────────
function abrirModalAvaliacao(idColab, tipo) {
  if (!tipo) { toast("Todas as avaliações já foram realizadas.", "info"); return; }

  const colab = ATE.colaboradores.find(c => c.id === idColab);
  if (!colab) return;

  _notasAtuais = {};

  document.getElementById("aval-id-colaborador").value = idColab;
  document.getElementById("aval-tipo").value           = tipo;
  document.getElementById("modal-aval-title").textContent = `${tipo} — ${colab.nome}`;
  document.getElementById("modal-aval-sub").textContent   =
    `${colab.setor} · ${colab.cargo} · Líder: ${colab.lider_imediato}`;

  const hoje = new Date();
  document.getElementById("aval-data").value      = hoje.toISOString().split("T")[0];
  document.getElementById("aval-avaliador").value = "";
  document.getElementById("aval-lancador").value  = ATE.nome || ATE.usuario;

  const grid = document.getElementById("criterios-grid");
  grid.innerHTML = CRITERIOS.map(c => `
    <div class="criterio-row" id="cr-${_slug(c)}">
      <span class="criterio-nome" title="${CRITERIO_DESCRICOES[c]}">${c}</span>
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
  btn.closest(".notas-row").querySelectorAll(".nota-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  _notasAtuais[criterio] = nota;
  _atualizarResultado();
}

function _atualizarResultado() {
  const notas = Object.values(_notasAtuais);
  if (!notas.length) {
    document.getElementById("media-geral").textContent     = "—";
    document.getElementById("pct-geral").textContent       = "—";
    document.getElementById("resultado-final").textContent = "—";
    document.getElementById("resultado-final").className   = "badge";
    return;
  }

  const media  = notas.reduce((a, b) => a + b, 0) / notas.length;
  const pct    = Math.round((media / 4) * 100);
  const result = media >= 3 ? "APROVADO" : "REPROVADO";

  document.getElementById("media-geral").textContent     = media.toFixed(2);
  document.getElementById("pct-geral").textContent       = `${pct}%`;
  document.getElementById("resultado-final").textContent = result;
  document.getElementById("resultado-final").className   = `badge ${result === "APROVADO" ? "badge-green" : "badge-red"}`;
}

async function confirmarAvaliacao() {
  const faltando = CRITERIOS.filter(c => !_notasAtuais[c]);
  if (faltando.length) {
    toast(`Avalie todos os critérios. Faltam: ${faltando.length}`, "warning");
    faltando.forEach(c => {
      const row = document.getElementById(`cr-${_slug(c)}`);
      if (row) { row.style.border = "2px solid var(--red)"; setTimeout(() => row.style.border = "", 2000); }
    });
    return;
  }

  const idColab   = document.getElementById("aval-id-colaborador").value;
  const tipo      = document.getElementById("aval-tipo").value;
  const data      = document.getElementById("aval-data").value;
  const avaliador = document.getElementById("aval-avaliador").value.trim();
  const lancador  = document.getElementById("aval-lancador").value.trim();

  if (!avaliador) { toast("Informe o nome do avaliador (gestor).", "warning"); return; }
  if (!lancador)  { toast("Informe quem está lançando a avaliação (RH).", "warning"); return; }

  const criterios = CRITERIOS.map(c => ({
    criterio: c, nota: _notasAtuais[c],
    observacao: document.getElementById(`obs-${_slug(c)}`)?.value || ""
  }));

  const res = await api("salvarAvaliacao", {
    id_colaborador: idColab, tipo_avaliacao: tipo,
    data_avaliacao: inputParaData(data), avaliador, lancador, criterios
  });

  if (res.ok) {
    fecharModalAvaliacao();
    toast(`Avaliação salva! Média: ${res.media} — ${res.resultado}`, "success");
    await carregarColaboradores();
  } else {
    toast(res.msg || "Erro ao salvar avaliação.", "error");
  }
}

// ──────────────────────────────────────────────
// FICHA COMPLETA DO COLABORADOR
// ──────────────────────────────────────────────
let _fichaAtual = null;

async function abrirFichaColaborador(idColab) {
  const res = await api("getFichaColaborador", { id_colaborador: idColab });
  if (!res.ok) { toast(res.msg || "Erro ao carregar ficha.", "error"); return; }

  _fichaAtual = res;
  _renderFichaColaborador(res);
  document.getElementById("modal-ficha").classList.remove("hidden");
}

function fecharFichaColaborador() {
  document.getElementById("modal-ficha").classList.add("hidden");
  _fichaAtual = null;
}

// ──────────────────────────────────────────────
// IMPRESSÃO DA FICHA
// ──────────────────────────────────────────────
function imprimirFichaColaborador() {
  const fichaEl = document.getElementById("modal-ficha");
  if (!fichaEl || fichaEl.classList.contains("hidden")) {
    toast("Nenhuma ficha aberta para imprimir.", "warning");
    return;
  }

  // Captura o conteúdo atual da ficha
  const conteudo = document.querySelector("#modal-ficha .modal-body")?.innerHTML || "";
  const titulo   = document.getElementById("ficha-titulo")?.textContent || "Ficha do Colaborador";
  const subtitulo = document.getElementById("ficha-subtitulo")?.textContent || "";

  const janela = window.open("", "_blank", "width=1000,height=750");
  janela.document.write(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Ficha — ${titulo}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    :root {
      --primary:       #0F52BA;
      --primary-dark:  #0A3D8F;
      --primary-light: #E8F0FE;
      --green:   #1E7E44; --green-bg:#E6F4EA;
      --red:     #C62828; --red-bg:  #FDECEA;
      --amber:   #B45309; --amber-bg:#FEF3C7;
      --blue:    #1565C0; --blue-bg: #E3F2FD;
      --purple:  #6D28D9; --purple-bg:#EDE9FE;
      --surface: #FFFFFF; --bg: #F3F6FC;
      --border:  #DDE3EE; --muted: #6B7A99;
      --text:    #1A2340; --text-sec: #3D4F75;
      --radius:  10px; --radius-lg: 16px;
      --font: 'Inter', system-ui, sans-serif;
      --mono: 'JetBrains Mono', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font); color: var(--text); font-size: 13px; line-height: 1.5; background: #fff; padding: 24px 32px; }

    /* Cabeçalho de impressão */
    .print-header {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 3px solid var(--primary); padding-bottom: 14px; margin-bottom: 20px;
    }
    .print-brand { display: flex; align-items: center; gap: 12px; }
    .print-brand-icon {
      width: 44px; height: 44px; border-radius: 10px;
      background: var(--primary); display: flex; align-items: center; justify-content: center;
    }
    .print-brand-icon svg { width: 28px; height: 28px; }
    .print-brand h1 { font-size: 1.4rem; font-weight: 700; color: var(--primary); }
    .print-brand p  { font-size: 0.75rem; color: var(--muted); }
    .print-meta { text-align: right; font-size: 0.75rem; color: var(--muted); }
    .print-meta strong { color: var(--text); }

    /* Título da ficha */
    .print-titulo { font-size: 1.15rem; font-weight: 700; color: var(--text); margin-bottom: 2px; }
    .print-subtitulo { font-size: 0.82rem; color: var(--muted); margin-bottom: 18px; }

    /* Dados cadastrais */
    .ficha-dados-grid {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 12px; background: var(--bg);
      border-radius: var(--radius); padding: 14px 16px; margin-bottom: 20px;
    }
    .ficha-dado { display: flex; flex-direction: column; gap: 2px; }
    .ficha-dado label { font-size: 0.65rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
    .ficha-dado span  { font-size: 0.82rem; font-weight: 600; color: var(--text); }

    /* Título de seção */
    .ficha-section-title {
      font-size: 0.9rem; font-weight: 700; color: var(--text);
      margin: 20px 0 10px; padding-bottom: 6px;
      border-bottom: 2px solid var(--border);
    }

    /* Grid de avaliações */
    .ficha-aval-grid {
      display: grid; grid-template-columns: 2fr repeat(3, 1fr);
      gap: 1px; background: var(--border);
      border-radius: var(--radius); overflow: hidden;
      border: 1px solid var(--border); margin-bottom: 14px;
    }
    .ficha-aval-col { display: flex; flex-direction: column; background: var(--surface); }
    .ficha-aval-col-label { background: var(--surface); }

    .ficha-aval-col-header {
      padding: 8px 10px; font-size: 0.72rem; font-weight: 700;
      background: var(--primary); color: #fff;
      display: flex; flex-direction: column; gap: 2px;
      text-align: center; min-height: 51px; justify-content: center;
    }
    .ficha-aval-col-label .ficha-aval-col-header { background: var(--primary-dark); }
    .ficha-aval-data { font-size: 0.63rem; font-weight: 500; opacity: .85; font-family: var(--mono); }

    .ficha-crit-row {
      padding: 7px 10px; font-size: 0.72rem;
      border-bottom: 1px solid #F0F3FA;
      text-align: center; display: flex; align-items: center; justify-content: center;
      min-height: 41px;
    }
    /* Coluna de labels: texto à esquerda, menor, pode quebrar linha */
    .ficha-aval-col-label .ficha-crit-row {
      justify-content: flex-start; text-align: left;
      font-weight: 500; color: var(--text-sec);
      font-size: 0.68rem; line-height: 1.35;
      padding: 5px 8px;
    }
    .ficha-crit-row:last-child { border-bottom: none; }
    .ficha-crit-vazio { color: var(--border); }
    .ficha-crit-nota { font-weight: 700; font-family: var(--mono); font-size: 0.82rem; }
    .ficha-crit-nota.nota-1 { color: var(--red); }
    .ficha-crit-nota.nota-2 { color: var(--amber); }
    .ficha-crit-nota.nota-3 { color: var(--blue); }
    .ficha-crit-nota.nota-4 { color: var(--green); }
    .ficha-crit-media    { background: var(--bg); font-weight: 700; font-family: var(--mono); }
    .ficha-crit-resultado { background: var(--bg); }

    /* Meta avaliações */
    .ficha-aval-meta { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }
    .ficha-meta-item {
      font-size: 0.75rem; color: var(--text-sec);
      background: var(--bg); padding: 6px 10px; border-radius: 6px;
    }

    /* Recomendação */
    .recomendacao-opcoes { display: flex; flex-direction: column; gap: 6px; }
    .recomendacao-opcao {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 8px 12px; border-radius: 6px;
      border: 1.5px solid var(--border); font-size: 0.78rem; color: var(--text);
    }
    .recomendacao-opcao.selected {
      border-color: var(--primary); background: var(--primary-light); font-weight: 600;
    }
    .recomendacao-opcao input[type="radio"] { margin-top: 2px; accent-color: var(--primary); }

    /* Badges */
    .badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 99px;
      font-size: 0.68rem; font-weight: 700; letter-spacing: .3px;
    }
    .badge-green  { background: var(--green-bg);  color: var(--green); }
    .badge-red    { background: var(--red-bg);    color: var(--red); }
    .badge-amber  { background: var(--amber-bg);  color: var(--amber); }
    .badge-blue   { background: var(--blue-bg);   color: var(--blue); }
    .badge-purple { background: var(--purple-bg); color: var(--purple); }
    .badge-gray   { background: #F0F3FA;           color: var(--muted); }

    /* Alert */
    .alert-item {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; border-radius: 6px; font-size: 0.78rem;
    }
    .alert-item.amber { background: var(--amber-bg); color: var(--amber); }
    .alert-item svg   { width: 14px; height: 14px; flex-shrink: 0; }

    /* Rodapé */
    .print-footer {
      margin-top: 24px; padding-top: 12px;
      border-top: 1px solid var(--border);
      display: flex; justify-content: space-between;
      font-size: 0.68rem; color: var(--muted);
    }
    .assinatura-linha {
      display: flex; gap: 40px; margin-top: 32px;
    }
    .assinatura-item {
      flex: 1; border-top: 1px solid var(--border);
      padding-top: 6px; font-size: 0.72rem; color: var(--muted); text-align: center;
    }

    /* Ocultar botões e controles */
    button, input[type="button"], .modal-footer,
    [style*="border-top:none"] button { display: none !important; }

    @media print {
      body { padding: 12px 20px; }
      @page { margin: 10mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <div class="print-brand">
      <div class="print-brand-icon">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 8C13.37 8 8 13.37 8 20s5.37 12 12 12 12-5.37 12-12S26.63 8 20 8zm0 4a3 3 0 110 6 3 3 0 010-6zm0 17.2c-4.17 0-7.87-2.13-10-5.37.05-3.32 6.67-5.13 10-5.13 3.32 0 9.95 1.81 10 5.13-2.13 3.24-5.83 5.37-10 5.37z" fill="#ffffff"/>
        </svg>
      </div>
      <div>
        <h1>ATE — Avaliação de Tempo de Experiência</h1>
        <p>Caruaru Shopping · Recursos Humanos</p>
      </div>
    </div>
    <div class="print-meta">
      <p>Emitido em: <strong>${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong></p>
      <p>Usuário: <strong>${(typeof ATE !== "undefined" ? ATE.nome || ATE.usuario : "") || "—"}</strong></p>
    </div>
  </div>

  <div class="print-titulo">${titulo}</div>
  <div class="print-subtitulo">${subtitulo}</div>

  ${conteudo}

  <div class="assinatura-linha">
    <div class="assinatura-item">Assinatura do Colaborador</div>
    <div class="assinatura-item">Assinatura do Gestor</div>
    <div class="assinatura-item">Assinatura do RH</div>
  </div>

  <div class="print-footer">
    <span>ATE · Sistema de Avaliação de Tempo de Experiência · Caruaru Shopping</span>
    <span>Documento gerado automaticamente — ${new Date().toLocaleDateString("pt-BR")}</span>
  </div>

  <script>
    // Aguarda fontes e imprime
    document.fonts.ready.then(() => {
      setTimeout(() => { window.print(); }, 400);
    });
  <\/script>
</body>
</html>`);
  janela.document.close();
}

function _renderFichaColaborador(res) {
  const c = res.colaborador;

  document.getElementById("ficha-titulo").textContent = c.nome;
  document.getElementById("ficha-subtitulo").innerHTML =
    `${c.cargo} · ${c.setor} · ${c.empresa}`;

  // Dados cadastrais
  document.getElementById("ficha-dados").innerHTML = `
    <div class="ficha-dado"><label>Nome Completo</label><span>${c.nome}</span></div>
    <div class="ficha-dado"><label>Setor</label><span>${c.setor || "—"}</span></div>
    <div class="ficha-dado"><label>Cargo</label><span>${c.cargo || "—"}</span></div>
    <div class="ficha-dado"><label>Líder Imediato</label><span>${c.lider_imediato || "—"}</span></div>
    <div class="ficha-dado"><label>Empresa</label><span>${c.empresa || "—"}</span></div>
    <div class="ficha-dado"><label>Data de Admissão</label><span>${c.data_admissao || "—"}</span></div>
    <div class="ficha-dado"><label>Status Atual</label><span>${statusBadgeHtml(res.status_atual)}</span></div>
    <div class="ficha-dado"><label>Situação Final</label><span>${statusBadgeHtml(c.situacao_final)}</span></div>
  `;

  // Avaliações — coluna de critérios usa CRITERIOS_FICHA (descrição completa)
  const wrap = document.getElementById("ficha-avaliacoes");
  wrap.innerHTML = `
    <div class="ficha-aval-grid">
      <div class="ficha-aval-col ficha-aval-col-label">
        <div class="ficha-aval-col-header">Critério de Avaliação</div>
        ${CRITERIOS_FICHA.map(texto => `<div class="ficha-crit-row">${texto}</div>`).join("")}
        <div class="ficha-crit-row ficha-crit-media">Média</div>
        <div class="ficha-crit-row ficha-crit-resultado">Resultado</div>
      </div>
      ${res.avaliacoes.map(av => `
        <div class="ficha-aval-col">
          <div class="ficha-aval-col-header">
            ${av.tipo}
            ${av.preenchida ? `<span class="ficha-aval-data">${av.data_avaliacao}</span>` : `<span class="ficha-aval-data">—</span>`}
          </div>
          ${CRITERIOS.map(crit => {
            if (!av.preenchida) return `<div class="ficha-crit-row ficha-crit-vazio">—</div>`;
            const item = av.criterios.find(x => x.criterio === crit);
            const nota = item ? item.nota : "—";
            return `<div class="ficha-crit-row ficha-crit-nota nota-${nota}">${nota}</div>`;
          }).join("")}
          <div class="ficha-crit-row ficha-crit-media">${av.preenchida ? av.media : "—"}</div>
          <div class="ficha-crit-row ficha-crit-resultado">${av.preenchida ? statusBadgeHtml(av.resultado) : "—"}</div>
        </div>
      `).join("")}
    </div>
    <div class="ficha-aval-meta">
      ${res.avaliacoes.filter(av => av.preenchida).map(av => `
        <div class="ficha-meta-item">
          <strong>${av.tipo}</strong> — Avaliador: ${av.avaliador || "—"} · Lançado por: ${av.lancador || "—"}
        </div>
      `).join("") || `<p style="color:var(--muted);font-size:.82rem">Nenhuma avaliação registrada ainda.</p>`}
    </div>
  `;

  // Recomendação final — só habilitada se a 3ª avaliação foi preenchida
  const av3 = res.avaliacoes.find(a => a.tipo === "3ª AVALIAÇÃO");
  const podeRecomendar = av3 && av3.preenchida;
  const recSelecionada = c.recomendacao_final || "";

  document.getElementById("ficha-recomendacao").innerHTML = `
    <p style="font-size:.82rem;color:var(--muted);margin-bottom:14px">
      De acordo com o resultado final da avaliação acima, o colaborador deverá:
    </p>
    ${!podeRecomendar ? `
      <div class="alert-item amber" style="margin-bottom:14px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>Disponível após o registro da 3ª avaliação.</span>
      </div>` : ""}
    <div class="recomendacao-opcoes">
      ${RECOMENDACOES.map(r => `
        <label class="recomendacao-opcao ${recSelecionada === r.value ? "selected" : ""} ${!podeRecomendar ? "disabled" : ""}">
          <input type="radio" name="recomendacao" value="${r.value}" ${recSelecionada === r.value ? "checked" : ""} ${!podeRecomendar ? "disabled" : ""} onchange="_marcarRecomendacao(this)">
          <span>${r.label}</span>
        </label>
      `).join("")}
    </div>
    <div class="form-group" style="margin-top:14px">
      <label>Observações da recomendação (opcional)</label>
      <input type="text" id="ficha-recomendacao-obs" value="${(c.recomendacao_obs || "").replace(/"/g,'&quot;')}" ${!podeRecomendar ? "disabled" : ""} placeholder="Detalhes sobre a decisão..." />
    </div>
    <div class="modal-footer" style="padding:16px 0 0;border-top:none">
      <button class="btn-primary" ${!podeRecomendar ? "disabled" : ""} onclick="salvarRecomendacaoFicha('${c.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
        Salvar Recomendação
      </button>
    </div>
  `;
}

function _marcarRecomendacao(input) {
  document.querySelectorAll(".recomendacao-opcao").forEach(l => l.classList.remove("selected"));
  input.closest(".recomendacao-opcao").classList.add("selected");
}

async function salvarRecomendacaoFicha(idColab) {
  const selecionada = document.querySelector('input[name="recomendacao"]:checked');
  if (!selecionada) { toast("Selecione uma recomendação.", "warning"); return; }

  const obs = document.getElementById("ficha-recomendacao-obs")?.value || "";

  const res = await api("salvarRecomendacao", {
    id_colaborador: idColab,
    recomendacao_final: selecionada.value,
    recomendacao_obs: obs
  });

  if (res.ok) {
    toast("Recomendação salva com sucesso!", "success");
    await carregarColaboradores();
    abrirFichaColaborador(idColab);
  } else {
    toast(res.msg || "Erro ao salvar recomendação.", "error");
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
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

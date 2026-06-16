// ============================================================
// ATE - Avaliação de Tempo de Experiência
// Google Apps Script Backend - Code.gs
// ============================================================

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SS = SpreadsheetApp.getActiveSpreadsheet();

// ---- Nomes das abas ----
const ABA_COLABORADORES = "Colaboradores";
const ABA_AVALIACOES    = "Avaliacoes";
const ABA_HISTORICO     = "Historico";
const ABA_USUARIOS      = "Usuarios";

// ============================================================
// ROTEADOR PRINCIPAL
// ============================================================

// O Google Apps Script redireciona POST para GET em alguns casos.
// A solução é enviar tudo via GET com o payload em parâmetro,
// e manter doPost como fallback.

function _rotear(e) {
  try {
    // Tenta ler do POST (postData.contents)
    let payload;
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
    // Fallback: parâmetro GET "payload"
    else if (e && e.parameter && e.parameter.payload) {
      payload = JSON.parse(decodeURIComponent(e.parameter.payload));
    }
    // Nenhum dado — retorna status de saúde
    else {
      return _resp({ ok: true, msg: "ATE API online. Use payload via GET ou POST." });
    }

    const { action, data } = payload;
    let result;

    switch (action) {
      case "login":                result = login(data); break;
      case "getDashboard":         result = getDashboard(data); break;
      case "getColaboradores":     result = getColaboradores(data); break;
      case "salvarColaborador":    result = salvarColaborador(data); break;
      case "editarColaborador":    result = editarColaborador(data); break;
      case "excluirColaborador":   result = excluirColaborador(data); break;
      case "getAvaliacoes":        result = getAvaliacoes(data); break;
      case "salvarAvaliacao":      result = salvarAvaliacao(data); break;
      case "getHistorico":         result = getHistorico(data); break;
      case "importarDados":        result = importarDados(data); break;
      case "gerarRelatorio":       result = gerarRelatorio(data); break;
      default:                     result = { ok: false, msg: "Ação desconhecida: " + action };
    }

    return _resp(result);

  } catch (err) {
    return _resp({ ok: false, msg: err.message });
  }
}

function _resp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) { return _rotear(e); }
function doGet(e)  { return _rotear(e); }

// ============================================================
// UTILITÁRIOS
// ============================================================
function gerarId() {
  return Utilities.getUuid();
}

function agora() {
  return Utilities.formatDate(new Date(), "America/Recife", "dd/MM/yyyy HH:mm:ss");
}

function formatarData(data) {
  if (!data) return "";
  if (data instanceof Date) return Utilities.formatDate(data, "America/Recife", "dd/MM/yyyy");
  return data;
}

function parsearData(str) {
  if (!str) return null;
  const partes = str.split("/");
  if (partes.length === 3) return new Date(partes[2], partes[1] - 1, partes[0]);
  return new Date(str);
}

function adicionarDias(data, dias) {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

function registrarHistorico(idColaborador, acao, usuario, detalhes) {
  const aba = SS.getSheetByName(ABA_HISTORICO);
  aba.appendRow([
    gerarId(),
    idColaborador,
    acao,
    usuario,
    agora(),
    detalhes
  ]);
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================
function login(data) {
  const aba = SS.getSheetByName(ABA_USUARIOS);
  if (!aba) return { ok: false, msg: "Aba Usuarios não encontrada" };

  const rows = aba.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const [id, usuario, senha, perfil, nome, ativo] = rows[i];
    if (usuario === data.usuario && senha === data.senha && ativo === true) {
      return { ok: true, perfil, nome, usuario, id };
    }
  }
  return { ok: false, msg: "Usuário ou senha inválidos" };
}

// ============================================================
// DASHBOARD
// ============================================================
function getDashboard(data) {
  const colabs = _todosColaboradores();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let emExperiencia = 0, pendentes = 0, vencidas = 0, concluidos = 0, aprovados = 0;
  const porSetor = {}, porLider = {};

  colabs.forEach(c => {
    if (c.situacao_final === "EFETIVADO" || c.situacao_final === "DESLIGADO") {
      concluidos++;
      if (c.situacao_final === "EFETIVADO") aprovados++;
      return;
    }

    emExperiencia++;

    // Contar por setor
    porSetor[c.setor] = (porSetor[c.setor] || 0) + 1;
    porLider[c.lider_imediato] = (porLider[c.lider_imediato] || 0) + 1;

    // Verificar datas de avaliação pendentes
    ["data_primeira_avaliacao", "data_segunda_avaliacao", "data_terceira_avaliacao"].forEach((campo, idx) => {
      const statusCampo = ["status_primeira", "status_segunda", "status_terceira"][idx];
      if (c[statusCampo] === "REALIZADA") return;

      const dataAval = parsearData(c[campo]);
      if (!dataAval) return;

      const diff = Math.floor((dataAval - hoje) / (1000 * 60 * 60 * 24));
      if (diff < 0) vencidas++;
      else pendentes++;
    });
  });

  return {
    ok: true,
    emExperiencia,
    pendentes,
    vencidas,
    concluidos,
    aprovados,
    percentualAprovacao: concluidos > 0 ? Math.round((aprovados / concluidos) * 100) : 0,
    porSetor: Object.entries(porSetor).map(([k, v]) => ({ label: k, valor: v })),
    porLider: Object.entries(porLider).map(([k, v]) => ({ label: k, valor: v }))
  };
}

// ============================================================
// COLABORADORES
// ============================================================
function _todosColaboradores() {
  const aba = SS.getSheetByName(ABA_COLABORADORES);
  if (!aba) return [];
  const rows = aba.getDataRange().getValues();
  if (rows.length <= 1) return [];

  return rows.slice(1).map(r => ({
    id: r[0], nome: r[1], setor: r[2], cargo: r[3], lider_imediato: r[4],
    empresa: r[5], data_admissao: formatarData(r[6]),
    data_primeira_avaliacao: formatarData(r[7]),
    data_segunda_avaliacao: formatarData(r[8]),
    data_terceira_avaliacao: formatarData(r[9]),
    status_primeira: r[10], status_segunda: r[11], status_terceira: r[12],
    situacao_final: r[13], data_cadastro: r[14], usuario_cadastro: r[15]
  }));
}

function getColaboradores(data) {
  let colabs = _todosColaboradores();

  // Filtros de gestor (vê apenas seus liderados)
  if (data && data.perfil === "gestor" && data.usuario) {
    colabs = colabs.filter(c => c.lider_imediato === data.usuario || c.lider_imediato === data.nome);
  }

  // Enriquecer com status calculado
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  colabs = colabs.map(c => {
    const proxima = _proximaAvaliacao(c, hoje);
    return { ...c, proxima_avaliacao: proxima.data, status_atual: proxima.status };
  });

  return { ok: true, data: colabs };
}

function _proximaAvaliacao(c, hoje) {
  const avaliacoes = [
    { data: c.data_primeira_avaliacao, status: c.status_primeira },
    { data: c.data_segunda_avaliacao, status: c.status_segunda },
    { data: c.data_terceira_avaliacao, status: c.status_terceira }
  ];

  for (const av of avaliacoes) {
    if (av.status === "REALIZADA") continue;
    if (!av.data) continue;

    const dataAval = parsearData(av.data);
    const diff = Math.floor((dataAval - hoje) / (1000 * 60 * 60 * 24));

    let status;
    if (diff < 0) status = "ATRASADO";
    else if (diff <= 7) status = "PRÓXIMO DO VENCIMENTO";
    else status = "EM DIA";

    return { data: av.data, status };
  }

  return { data: null, status: "CONCLUÍDO" };
}

function salvarColaborador(data) {
  const aba = SS.getSheetByName(ABA_COLABORADORES);
  const admissao = parsearData(data.data_admissao);

  const id = gerarId();
  const dataCadastro = agora();

  aba.appendRow([
    id,
    data.nome,
    data.setor,
    data.cargo,
    data.lider_imediato,
    data.empresa,
    formatarData(admissao),
    formatarData(adicionarDias(admissao, 30)),
    formatarData(adicionarDias(admissao, 60)),
    formatarData(adicionarDias(admissao, 80)),
    "PENDENTE",
    "PENDENTE",
    "PENDENTE",
    "EM EXPERIÊNCIA",
    dataCadastro,
    data.usuario
  ]);

  registrarHistorico(id, "CADASTRO", data.usuario, `Colaborador ${data.nome} cadastrado`);
  return { ok: true, id };
}

function editarColaborador(data) {
  const aba = SS.getSheetByName(ABA_COLABORADORES);
  const rows = aba.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      const admissao = parsearData(data.data_admissao);
      aba.getRange(i + 1, 2, 1, 12).setValues([[
        data.nome, data.setor, data.cargo, data.lider_imediato, data.empresa,
        formatarData(admissao),
        formatarData(adicionarDias(admissao, 30)),
        formatarData(adicionarDias(admissao, 60)),
        formatarData(adicionarDias(admissao, 80)),
        data.status_primeira || rows[i][10],
        data.status_segunda || rows[i][11],
        data.status_terceira || rows[i][12]
      ]]);

      if (data.situacao_final) {
        aba.getRange(i + 1, 14).setValue(data.situacao_final);
      }

      registrarHistorico(data.id, "EDIÇÃO", data.usuario, `Colaborador ${data.nome} editado`);
      return { ok: true };
    }
  }
  return { ok: false, msg: "Colaborador não encontrado" };
}

function excluirColaborador(data) {
  const aba = SS.getSheetByName(ABA_COLABORADORES);
  const rows = aba.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      const nome = rows[i][1];
      aba.deleteRow(i + 1);
      registrarHistorico(data.id, "EXCLUSÃO", data.usuario, `Colaborador ${nome} excluído`);
      return { ok: true };
    }
  }
  return { ok: false, msg: "Colaborador não encontrado" };
}

// ============================================================
// AVALIAÇÕES
// ============================================================
function getAvaliacoes(data) {
  const aba = SS.getSheetByName(ABA_AVALIACOES);
  if (!aba) return { ok: true, data: [] };

  const rows = aba.getDataRange().getValues();
  let avaliacoes = rows.slice(1).map(r => ({
    id_avaliacao: r[0], id_colaborador: r[1], tipo_avaliacao: r[2],
    data_avaliacao: formatarData(r[3]), avaliador: r[4],
    criterio: r[5], nota: r[6], observacao: r[7],
    resultado: r[8], data_registro: r[9]
  }));

  if (data && data.id_colaborador) {
    avaliacoes = avaliacoes.filter(a => a.id_colaborador === data.id_colaborador);
  }

  return { ok: true, data: avaliacoes };
}

function salvarAvaliacao(data) {
  const abaAval = SS.getSheetByName(ABA_AVALIACOES);
  const abaColab = SS.getSheetByName(ABA_COLABORADORES);

  // Calcular média e resultado
  const notas = data.criterios.map(c => parseFloat(c.nota));
  const media = notas.reduce((a, b) => a + b, 0) / notas.length;
  const resultado = media >= 3 ? "APROVADO" : "REPROVADO";
  const idAval = gerarId();
  const dataReg = agora();

  // Salvar cada critério
  data.criterios.forEach(c => {
    abaAval.appendRow([
      idAval, data.id_colaborador, data.tipo_avaliacao,
      data.data_avaliacao, data.avaliador,
      c.criterio, c.nota, c.observacao,
      resultado, dataReg
    ]);
  });

  // Atualizar status na aba de colaboradores
  const rows = abaColab.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id_colaborador) {
      const colStatus = { "1ª AVALIAÇÃO": 11, "2ª AVALIAÇÃO": 12, "3ª AVALIAÇÃO": 13 };
      const col = colStatus[data.tipo_avaliacao];
      if (col) abaColab.getRange(i + 1, col).setValue("REALIZADA");

      // Se 3ª avaliação, definir situação final
      if (data.tipo_avaliacao === "3ª AVALIAÇÃO") {
        abaColab.getRange(i + 1, 14).setValue(resultado === "APROVADO" ? "EFETIVADO" : "DESLIGADO");
      }
      break;
    }
  }

  registrarHistorico(
    data.id_colaborador,
    "AVALIAÇÃO REALIZADA",
    data.avaliador,
    `${data.tipo_avaliacao} realizada. Média: ${media.toFixed(2)} - ${resultado}`
  );

  return { ok: true, id_avaliacao: idAval, media: media.toFixed(2), resultado };
}

// ============================================================
// HISTÓRICO
// ============================================================
function getHistorico(data) {
  const aba = SS.getSheetByName(ABA_HISTORICO);
  if (!aba) return { ok: true, data: [] };

  const rows = aba.getDataRange().getValues();
  let historico = rows.slice(1).map(r => ({
    id: r[0], id_colaborador: r[1], acao: r[2],
    usuario: r[3], data_hora: r[4], detalhes: r[5]
  }));

  if (data && data.id_colaborador) {
    historico = historico.filter(h => h.id_colaborador === data.id_colaborador);
  }

  return { ok: true, data: historico.reverse() };
}

// ============================================================
// IMPORTAÇÃO
// ============================================================
function importarDados(data) {
  const aba = SS.getSheetByName(ABA_COLABORADORES);
  const existentes = _todosColaboradores();
  const nomesExistentes = existentes.map(c => c.nome.toLowerCase().trim());

  let novos = 0, atualizados = 0, ignorados = 0, erros = 0;
  const relatorio = [];

  data.registros.forEach(reg => {
    try {
      const nomeNorm = reg.nome.toLowerCase().trim();
      const idx = nomesExistentes.indexOf(nomeNorm);

      if (idx === -1) {
        // Novo registro
        const admissao = parsearData(reg.data_admissao);
        if (!admissao) {
          erros++;
          relatorio.push({ nome: reg.nome, resultado: "ERRO", motivo: "Data de admissão inválida" });
          return;
        }
        aba.appendRow([
          gerarId(), reg.nome, reg.setor, reg.cargo, reg.lider_imediato,
          reg.empresa, formatarData(admissao),
          reg.data_primeira_avaliacao || formatarData(adicionarDias(admissao, 30)),
          reg.data_segunda_avaliacao || formatarData(adicionarDias(admissao, 60)),
          reg.data_terceira_avaliacao || formatarData(adicionarDias(admissao, 80)),
          reg.status_primeira || "PENDENTE",
          reg.status_segunda || "PENDENTE",
          reg.status_terceira || "PENDENTE",
          reg.situacao_final || "EM EXPERIÊNCIA",
          agora(), "IMPORTAÇÃO"
        ]);
        novos++;
        relatorio.push({ nome: reg.nome, resultado: "NOVO" });
      } else {
        // Atualizar registro existente
        const colab = existentes[idx];
        editarColaborador({ ...reg, id: colab.id, usuario: "IMPORTAÇÃO" });
        atualizados++;
        relatorio.push({ nome: reg.nome, resultado: "ATUALIZADO" });
      }
    } catch (e) {
      erros++;
      relatorio.push({ nome: reg.nome, resultado: "ERRO", motivo: e.message });
    }
  });

  return { ok: true, novos, atualizados, ignorados, erros, relatorio };
}

// ============================================================
// RELATÓRIOS
// ============================================================
function gerarRelatorio(data) {
  const colabs = _todosColaboradores();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let resultado = colabs;

  switch (data.tipo) {
    case "por_setor":
      const porSetor = {};
      colabs.forEach(c => {
        if (!porSetor[c.setor]) porSetor[c.setor] = [];
        porSetor[c.setor].push(c);
      });
      return { ok: true, data: porSetor };

    case "vencidas":
      resultado = colabs.filter(c => {
        const p = _proximaAvaliacao(c, hoje);
        return p.status === "ATRASADO";
      });
      break;

    case "pendentes":
      resultado = colabs.filter(c => {
        const p = _proximaAvaliacao(c, hoje);
        return p.status === "EM DIA" || p.status === "PRÓXIMO DO VENCIMENTO";
      });
      break;

    case "aprovados":
      resultado = colabs.filter(c => c.situacao_final === "EFETIVADO");
      break;

    case "reprovados":
      resultado = colabs.filter(c => c.situacao_final === "DESLIGADO");
      break;
  }

  return { ok: true, data: resultado };
}

// ============================================================
// INICIALIZAÇÃO DAS PLANILHAS
// ============================================================
function inicializarPlanilhas() {
  _criarAba(ABA_COLABORADORES, [
    "id", "nome", "setor", "cargo", "lider_imediato", "empresa",
    "data_admissao", "data_primeira_avaliacao", "data_segunda_avaliacao",
    "data_terceira_avaliacao", "status_primeira", "status_segunda",
    "status_terceira", "situacao_final", "data_cadastro", "usuario_cadastro"
  ]);

  _criarAba(ABA_AVALIACOES, [
    "id_avaliacao", "id_colaborador", "tipo_avaliacao", "data_avaliacao",
    "avaliador", "criterio", "nota", "observacao", "resultado", "data_registro"
  ]);

  _criarAba(ABA_HISTORICO, [
    "id", "id_colaborador", "acao", "usuario", "data_hora", "detalhes"
  ]);

  _criarAba(ABA_USUARIOS, ["id", "usuario", "senha", "perfil", "nome", "ativo"]);

  // Usuários padrão
  const abaU = SS.getSheetByName(ABA_USUARIOS);
  if (abaU.getLastRow() === 1) {
    abaU.appendRow([gerarId(), "admin", "admin2026", "administrador", "Administrador RH", true]);
    abaU.appendRow([gerarId(), "gestor", "gestor2026", "gestor", "Gestor Padrão", true]);
  }

  SpreadsheetApp.getUi().alert("✅ Planilhas inicializadas com sucesso!");
}

function _criarAba(nome, cabecalhos) {
  let aba = SS.getSheetByName(nome);
  if (!aba) {
    aba = SS.insertSheet(nome);
    aba.appendRow(cabecalhos);
    aba.getRange(1, 1, 1, cabecalhos.length).setFontWeight("bold").setBackground("#1a73e8").setFontColor("#ffffff");
  }
  return aba;
}

// Menu no Sheets
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚙️ ATE Sistema")
    .addItem("Inicializar Planilhas", "inicializarPlanilhas")
    .addToUi();
}

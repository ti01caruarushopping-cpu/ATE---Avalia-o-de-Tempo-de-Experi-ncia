// ============================================================
// ATE — importacao.js  |  Upload e parsing de planilhas
// ============================================================

// Carrega SheetJS dinamicamente sob demanda
let _sheetJsLoaded = false;

async function _carregarSheetJS() {
  if (_sheetJsLoaded) return true;
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => { _sheetJsLoaded = true; resolve(true); };
    s.onerror = () => { toast("Erro ao carregar biblioteca de leitura de planilhas.", "error"); resolve(false); };
    document.head.appendChild(s);
  });
}

// ──────────────────────────────────────────────
// MAPEAMENTO DE STATUS DA PLANILHA → SISTEMA
// A planilha usa: FEITO, ENVIADO, DESLIGADO, ATRASADO, PERTO DA DATA, EM DIA
// O sistema usa: REALIZADA, PENDENTE
// ──────────────────────────────────────────────
function _normalizarStatus(val) {
  if (!val) return "PENDENTE";
  const v = String(val).trim().toUpperCase();
  // Valores que indicam avaliação concluída
  if (["FEITO", "FEITA", "REALIZADO", "REALIZADA", "F", "DONE", "CONCLUIDO", "CONCLUÍDA",
       "ENVIADO", "ENVIADA", "E", "DESLIGADO", "DESLIGADA", "D"].includes(v)) {
    return "REALIZADA";
  }
  // Valores explícitos de pendente
  if (["PENDENTE", "ATRASADO", "EM DIA", "PERTO DA DATA", "PRÓXIMO DO VENCIMENTO", ""].includes(v)) {
    return "PENDENTE";
  }
  // Fallback: se tiver conteúdo desconhecido, assume PENDENTE
  return "PENDENTE";
}

// Mapeamento de situação final
function _normalizarSituacaoFinal(val, status1, status2, status3) {
  if (!val) {
    // Inferir pela situação das avaliações
    if (status3 === "REALIZADA") return "EFETIVADO";
    return "EM EXPERIÊNCIA";
  }
  const v = String(val).trim().toUpperCase();
  if (["EFETIVADO", "APROVADO"].includes(v)) return "EFETIVADO";
  if (["DESLIGADO", "REPROVADO", "DEMITIDO"].includes(v)) return "DESLIGADO";
  if (["EM EXPERIÊNCIA", "EM EXPERIENCIA"].includes(v)) return "EM EXPERIÊNCIA";
  return "EM EXPERIÊNCIA";
}

// ──────────────────────────────────────────────
// DRAG & DROP
// ──────────────────────────────────────────────
function dragOver(e) {
  e.preventDefault();
  document.getElementById("import-drop").classList.add("drag-over");
}

function dropFile(e) {
  e.preventDefault();
  document.getElementById("import-drop").classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) processarArquivoObj(file);
}

function processarArquivo(e) {
  const file = e.target.files[0];
  if (file) processarArquivoObj(file);
  e.target.value = "";
}

async function processarArquivoObj(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (!["xlsx","xls","csv"].includes(ext)) {
    toast("Formato inválido. Use .xlsx, .xls ou .csv", "error"); return;
  }

  mostrarLoading(true);

  try {
    let registros;
    if (ext === "csv") {
      registros = await _lerCSV(file);
    } else {
      const ok = await _carregarSheetJS();
      if (!ok) return;
      registros = await _lerExcel(file);
    }

    if (!registros || !registros.length) {
      toast("Nenhum dado encontrado na planilha.", "warning"); return;
    }

    ATE.importDados = registros;
    _mostrarPreview(file.name, registros);

  } catch (err) {
    console.error(err);
    toast(`Erro ao ler arquivo: ${err.message}`, "error");
  } finally {
    mostrarLoading(false);
  }
}

// ──────────────────────────────────────────────
// LEITURA DE ARQUIVOS
// ──────────────────────────────────────────────
async function _lerExcel(file) {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: "array", cellDates: true });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rows.map(_normalizarLinha).filter(r => r.nome);
}

async function _lerCSV(file) {
  const text = await file.text();
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_"));

  return lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return _normalizarLinha(obj);
  }).filter(r => r.nome);
}

// Normaliza chaves de diferentes formatos de planilha
function _normalizarLinha(row) {
  const norm = {};
  const mapa = {
    nome:                    ["nome","name","colaborador","funcionário","funcionario","nome completo"],
    setor:                   ["setor","departamento","area","área","sector"],
    cargo:                   ["cargo","função","funcao","position","role"],
    lider_imediato:          ["lider_imediato","lider","líder","gestor","superior","responsavel","responsável"],
    empresa:                 ["empresa","company","entidade","unidade"],
    data_admissao:           ["data_admissao","data admissão","data de admissão","admissao","admissão","data_inicio","data inicio","hire_date"],
    data_primeira_avaliacao: ["data_primeira_avaliacao","1ª avaliação","primeira avaliação","1a avaliacao","30 dias"],
    data_segunda_avaliacao:  ["data_segunda_avaliacao","2ª avaliação","segunda avaliação","2a avaliacao","60 dias"],
    data_terceira_avaliacao: ["data_terceira_avaliacao","3ª avaliação","terceira avaliação","3a avaliacao","80 dias"],
    // A planilha do RH usa duas colunas por avaliação: uma letra (f/e/d) e o texto completo
    // Prioriza o campo de texto (status_primeira) sobre o de letra (status_primeira1)
    _status_primeira_raw:    ["status_primeira","status 1ª","status primeira","status_primeira1","status 1a"],
    _status_segunda_raw:     ["status_segunda","status 2ª","status segunda","status_segunda1","status 2a"],
    _status_terceira_raw:    ["status_terceira","status 3ª","status terceira","status_terceira1","status 3a"],
    situacao_final:          ["situacao_final","situação final","situacao","situação","resultado final","sit.","situação"],
    empresa_col:             ["empresa"]
  };

  // Normalizar chaves da linha para lowercase/underscore
  const rowNorm = {};
  Object.keys(row).forEach(k => {
    rowNorm[k.toLowerCase().trim().replace(/\s+/g,"_").replace(/[ãáàâ]/g,"a").replace(/[éêè]/g,"e").replace(/[íî]/g,"i").replace(/[óôõ]/g,"o").replace(/[úû]/g,"u").replace(/[ç]/g,"c").replace(/[\.]/g,"")] = row[k];
  });

  // Mapear campos principais
  const camposSimples = ["nome","setor","cargo","lider_imediato","empresa",
    "data_admissao","data_primeira_avaliacao","data_segunda_avaliacao","data_terceira_avaliacao"];
  
  camposSimples.forEach(campo => {
    const aliases = mapa[campo] || [];
    for (const alias of aliases) {
      const key = alias.toLowerCase().replace(/\s+/g,"_").replace(/[ãáàâ]/g,"a").replace(/[éêè]/g,"e").replace(/[íî]/g,"i").replace(/[óôõ]/g,"o").replace(/[úû]/g,"u").replace(/[ç]/g,"c").replace(/[\.]/g,"");
      const v = rowNorm[key] ?? rowNorm[alias.replace(/\s/g,"_")] ?? rowNorm[alias.replace(/[^a-z0-9]/g,"")];
      if (v !== undefined && v !== "") {
        norm[campo] = _formatarCelula(campo, v);
        break;
      }
    }
  });

  // Mapear status das avaliações — tenta texto longo primeiro, depois letra
  const statusFields = [
    ["status_primeira", ["status_primeira","status_primeira1","status_1a","status_1a_avaliacao"]],
    ["status_segunda",  ["status_segunda","status_segunda1","status_2a","status_2a_avaliacao"]],
    ["status_terceira", ["status_terceira","status_terceira1","status_3a","status_3a_avaliacao"]]
  ];

  statusFields.forEach(([campo, aliases]) => {
    let rawVal = "";
    for (const alias of aliases) {
      const v = rowNorm[alias];
      if (v !== undefined && v !== "") { rawVal = v; break; }
    }
    norm[campo] = _normalizarStatus(rawVal);
  });

  // Mapear situação final
  let sitRaw = rowNorm["situacao_final"] || rowNorm["situacao"] || rowNorm["situacao_final"] || rowNorm["sit"] || "";
  norm.situacao_final = _normalizarSituacaoFinal(sitRaw, norm.status_primeira, norm.status_segunda, norm.status_terceira);

  // Empresa: se não encontrada, deixar vazio para preenchimento manual
  if (!norm.empresa) norm.empresa = "";

  return norm;
}

function _formatarCelula(campo, val) {
  if (!val && val !== 0) return "";
  // Converter datas
  if (campo.startsWith("data_")) {
    if (val instanceof Date) return val.toLocaleDateString("pt-BR");
    if (typeof val === "number") {
      // Excel serial date (número como 46065)
      const d = new Date((val - 25569) * 86400000);
      return d.toLocaleDateString("pt-BR");
    }
    return String(val).trim();
  }
  return String(val).trim();
}

// ──────────────────────────────────────────────
// PREVIEW
// ──────────────────────────────────────────────
function _mostrarPreview(filename, registros) {
  document.getElementById("import-drop").classList.add("hidden");
  document.getElementById("import-preview").classList.remove("hidden");
  document.getElementById("import-filename").textContent = `📄 ${filename}`;
  document.getElementById("import-count").textContent    = `${registros.length} registro(s) encontrado(s)`;

  const tbody = document.getElementById("tbody-preview");
  const amostra = registros.slice(0, 10);
  tbody.innerHTML = amostra.map(r => `
    <tr>
      <td>${r.nome || "—"}</td>
      <td>${r.setor || "—"}</td>
      <td>${r.cargo || "—"}</td>
      <td>${r.lider_imediato || "—"}</td>
      <td>${r.empresa || "<span style='color:var(--amber)'>não informada</span>"}</td>
      <td style="font-family:var(--mono);font-size:.78rem">${r.data_admissao || "—"}</td>
    </tr>`).join("");

  if (registros.length > 10) {
    tbody.innerHTML += `<tr><td colspan="6" class="empty-row" style="font-style:normal">
      … e mais ${registros.length - 10} registro(s) não exibidos no preview.
    </td></tr>`;
  }
}

// ──────────────────────────────────────────────
// AÇÕES
// ──────────────────────────────────────────────
function cancelarImportacao() {
  ATE.importDados = [];
  document.getElementById("import-drop").classList.remove("hidden");
  document.getElementById("import-preview").classList.add("hidden");
  document.getElementById("import-result").classList.add("hidden");
}

async function confirmarImportacao() {
  if (!ATE.importDados.length) { toast("Nenhum dado para importar.", "warning"); return; }

  // Validar campos obrigatórios
  const invalidos = ATE.importDados.filter(r => !r.nome || !r.data_admissao);
  if (invalidos.length) {
    toast(`${invalidos.length} registro(s) sem nome ou data de admissão serão ignorados.`, "warning");
  }

  const validos = ATE.importDados.filter(r => r.nome && r.data_admissao);

  const res = await api("importarDados", { registros: validos });
  if (res.ok) {
    _mostrarResultado(res);
    carregarColaboradores();
  } else {
    toast(res.msg || "Erro na importação.", "error");
  }
}

function _mostrarResultado(res) {
  document.getElementById("import-preview").classList.add("hidden");
  document.getElementById("import-result").classList.remove("hidden");

  document.getElementById("r-novos").textContent       = res.novos || 0;
  document.getElementById("r-atualizados").textContent = res.atualizados || 0;
  document.getElementById("r-ignorados").textContent   = res.ignorados || 0;
  document.getElementById("r-erros").textContent       = res.erros || 0;

  const log = document.getElementById("import-log");
  if (res.relatorio && res.relatorio.length) {
    log.innerHTML = res.relatorio.map(r => `
      <div class="import-log-row">
        <span class="log-badge ${r.resultado}">${r.resultado}</span>
        <span>${r.nome}</span>
        ${r.motivo ? `<span style="color:var(--red);font-size:.75rem">— ${r.motivo}</span>` : ""}
      </div>`).join("");
  } else {
    log.innerHTML = `<p style="color:var(--muted);font-size:.8rem">Sem detalhes de log.</p>`;
  }

  toast(`Importação concluída! ${res.novos} novos, ${res.atualizados} atualizados.`, "success");
}

function novaImportacao() {
  ATE.importDados = [];
  document.getElementById("import-drop").classList.remove("hidden");
  document.getElementById("import-result").classList.add("hidden");
  document.getElementById("import-preview").classList.add("hidden");
}

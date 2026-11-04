// Roda o coletor como processo filho do servidor do app, guarda o andamento para a tela e
// agenda a coleta diária. Usado só pelo server.js.
const { spawn } = require("child_process");
const path = require("path");
const db = require("./db");
const config = require("./config");
const trava = require("./trava");

const RAIZ = path.join(__dirname, "..");
const MAX_LINHAS = 400;
const AGENDA_PADRAO = { ativo: true, hora: 6, minuto: 0 };

const estado = {
  rodando: false,
  origem: null,
  inicio: null,
  fim: null,
  codigo: null,
  aguardandoVerificacao: false,
  linhas: [],
};

function registrar(texto) {
  for (const linha of String(texto).split("\n")) {
    if (!linha.trim()) continue;
    estado.linhas.push(linha);
    if (/>> O site pediu uma verificação/.test(linha)) estado.aguardandoVerificacao = true;
    else if (/^\s+(OLX|Webmotors):/.test(linha)) estado.aguardandoVerificacao = false;
  }
  if (estado.linhas.length > MAX_LINHAS) estado.linhas.splice(0, estado.linhas.length - MAX_LINHAS);
}

function iniciar(origem = "manual") {
  if (estado.rodando) return { ok: false, motivo: "Já existe uma coleta em andamento." };
  const externa = trava.emAndamento();
  if (externa) return { ok: false, motivo: "Já existe uma coleta em andamento (iniciada pelo terminal)." };

  Object.assign(estado, {
    rodando: true,
    origem,
    inicio: new Date().toISOString(),
    fim: null,
    codigo: null,
    aguardandoVerificacao: false,
    linhas: [],
  });
  const filho = spawn(process.execPath, ["--no-warnings", path.join(RAIZ, "coletor", "index.js")], {
    cwd: RAIZ,
    env: { ...process.env, VEICULOMAIS_ORIGEM: origem },
  });
  filho.stdout.on("data", registrar);
  filho.stderr.on("data", registrar);
  filho.on("error", (e) => registrar(`Falha ao iniciar a coleta: ${e.message}`));
  filho.on("close", (codigo) => {
    estado.rodando = false;
    estado.aguardandoVerificacao = false;
    estado.fim = new Date().toISOString();
    estado.codigo = codigo;
  });
  return { ok: true };
}

function agenda() {
  return { ...AGENDA_PADRAO, ...(config.ler().agenda || {}) };
}

function gravarAgenda(entrada) {
  const hora = Number(entrada.hora);
  const minuto = Number(entrada.minuto);
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) throw new Error("hora inválida");
  if (!Number.isInteger(minuto) || minuto < 0 || minuto > 59) throw new Error("minuto inválido");
  const nova = { ativo: Boolean(entrada.ativo), hora, minuto };
  config.gravar({ agenda: nova });
  return nova;
}

// Decide se a coleta agendada deve rodar agora. Pura, para poder testar.
//   agora: Date; agenda: { ativo, hora, minuto }; jaAgendadaEm: "AAAA-MM-DD" da última coleta agendada;
//   ultima: { data, inicio } da última coleta concluída (qualquer origem) ou null.
function deveRodar(agora, agenda, jaAgendadaEm, ultima) {
  if (!agenda.ativo) return { rodar: false };
  const hoje = db.hoje(agora);
  if (jaAgendadaEm === hoje) return { rodar: false };
  const horario = new Date(agora);
  horario.setHours(agenda.hora, agenda.minuto, 0, 0);
  if (agora < horario) return { rodar: false };
  // uma coleta feita hoje depois do horário (pelo botão ou pelo terminal) já conta como a do dia
  if (ultima && ultima.data === hoje && new Date(ultima.inicio) >= horario) return { rodar: false, marcar: true };
  return { rodar: true };
}

// Roda a cada minuto. Se o Mac estava dormindo no horário, a coleta acontece assim que ele acordar.
function verificarAgenda(agora = new Date()) {
  if (estado.rodando) return false;
  let ultima = null;
  try {
    const banco = db.abrir({ somenteLeitura: true });
    if (banco) {
      ultima = db.ultimaColeta(banco);
      banco.close();
    }
  } catch {
    // banco ainda não existe
  }
  const decisao = deveRodar(agora, agenda(), config.ler().ultimaColetaAgendada, ultima);
  const hoje = db.hoje(agora);
  if (decisao.marcar) config.gravar({ ultimaColetaAgendada: hoje });
  if (!decisao.rodar) return false;
  const r = iniciar("agendada");
  if (r.ok) config.gravar({ ultimaColetaAgendada: hoje });
  return r.ok;
}

function iniciarAgendador() {
  setTimeout(() => verificarAgenda(), 15000);
  return setInterval(() => verificarAgenda(), 60000);
}

module.exports = { estado, iniciar, agenda, gravarAgenda, deveRodar, verificarAgenda, iniciarAgendador, registrar };

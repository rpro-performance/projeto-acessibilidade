// Impede duas coletas ao mesmo tempo (a agendada, a do botão e a do terminal usam a mesma trava).
const fs = require("fs");
const path = require("path");
const { DIR } = require("./db");

const ARQUIVO = path.join(DIR, "coleta.lock");

function vivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

// Devolve o pid da coleta em andamento, ou null.
function emAndamento() {
  try {
    const pid = Number(fs.readFileSync(ARQUIVO, "utf8"));
    if (pid && vivo(pid)) return pid;
  } catch {
    // sem trava
  }
  return null;
}

function adquirir() {
  const outro = emAndamento();
  if (outro && outro !== process.pid) return false;
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(ARQUIVO, String(process.pid));
  const soltar = () => {
    try {
      if (Number(fs.readFileSync(ARQUIVO, "utf8")) === process.pid) fs.unlinkSync(ARQUIVO);
    } catch {
      // já solta
    }
  };
  process.on("exit", soltar);
  return true;
}

module.exports = { ARQUIVO, emAndamento, adquirir };

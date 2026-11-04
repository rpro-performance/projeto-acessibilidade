// Notificação do sistema (Central de Notificações no Mac). Em outros sistemas só escreve no log.
const { execFile } = require("child_process");

function notificar(titulo, mensagem) {
  if (process.platform !== "darwin") return;
  const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `display notification "${esc(mensagem)}" with title "${esc(titulo)}" sound name "Glass"`;
  execFile("osascript", ["-e", script], () => {});
}

module.exports = { notificar };

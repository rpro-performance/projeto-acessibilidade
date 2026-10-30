// Configuração local do usuário em ~/.veiculomais/config.json (ex.: chave da Anthropic).
const fs = require("fs");
const path = require("path");
const { DIR } = require("./db");

const ARQUIVO = path.join(DIR, "config.json");

function ler() {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
  } catch {
    return {};
  }
}

function gravar(parcial) {
  fs.mkdirSync(DIR, { recursive: true });
  const atual = ler();
  const novo = { ...atual, ...parcial };
  fs.writeFileSync(ARQUIVO, JSON.stringify(novo, null, 2) + "\n", { mode: 0o600 });
  return novo;
}

// Aplica ao ambiente o que estiver no arquivo e ainda não estiver definido.
function aplicarAmbiente() {
  const c = ler();
  if (c.anthropicApiKey && !process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = c.anthropicApiKey;
  if (c.mercadolivreToken && !process.env.MERCADOLIVRE_TOKEN) process.env.MERCADOLIVRE_TOKEN = c.mercadolivreToken;
}

module.exports = { ARQUIVO, ler, gravar, aplicarAmbiente };

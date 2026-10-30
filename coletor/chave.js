#!/usr/bin/env node
// Guarda a chave da Anthropic em ~/.veiculomais/config.json para o resumo por IA.
//   npm run chave
const readline = require("readline");
const config = require("../src/config");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Cole a chave da Anthropic (começa com sk-ant-) e aperte Enter: ", (resposta) => {
  rl.close();
  const chave = resposta.trim().replace(/^["']|["']$/g, "");
  if (!chave.startsWith("sk-ant-")) {
    console.log("Isso não parece uma chave da Anthropic (deveria começar com sk-ant-). Nada foi gravado.");
    process.exit(1);
  }
  config.gravar({ anthropicApiKey: chave });
  console.log(`Chave guardada em ${config.ARQUIVO}. O coletor e o agendamento vão usá-la automaticamente.`);
  if (!chave.startsWith("sk-ant-api")) {
    console.log("Atenção: chaves de API do console da Anthropic começam com sk-ant-api03-. Se o resumo falhar por autenticação, gere uma em console.anthropic.com > API Keys.");
  }
});

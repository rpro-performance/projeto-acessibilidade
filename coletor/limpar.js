#!/usr/bin/env node
// Apaga do banco os anúncios de uma fonte (útil depois de corrigir um conector que leu dados errados).
//   node coletor/limpar.js olx
const db = require("../src/db");
const fonte = process.argv[2];
if (!fonte) {
  console.log("Uso: node coletor/limpar.js <fonte>   (ex.: olx, webmotors)");
  process.exit(1);
}
const banco = db.abrir();
const precos = banco.prepare("DELETE FROM precos WHERE chave LIKE ?").run(`${fonte}:%`).changes;
const anuncios = banco.prepare("DELETE FROM anuncios WHERE fonte = ?").run(fonte).changes;
console.log(`Removidos ${anuncios} anúncios e ${precos} registros de preço da fonte "${fonte}".`);
banco.close();

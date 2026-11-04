#!/usr/bin/env node
// Mostra o resultado da última coleta num bloco curto, para conferir ou colar numa conversa.
//   npm run relatorio
const db = require("../src/db");

const banco = db.abrir({ somenteLeitura: true });
if (!banco) {
  console.log("Nenhuma coleta encontrada ainda. Rode: npm run coletar");
  process.exit(0);
}
const ultima = db.ultimaColeta(banco);
if (!ultima) {
  console.log("Nenhuma coleta concluída ainda. Rode: npm run coletar");
  process.exit(0);
}

const brl = (v) => (v == null ? "?" : `R$ ${Math.round(v).toLocaleString("pt-BR")}`);
console.log(`Última coleta: ${ultima.data} (${ultima.inicio} até ${ultima.fim})\n`);

console.log("Fontes:");
for (const s of ultima.status) {
  const linha = s.ok
    ? `${s.lidos} lidos, ${s.aceitos} aceitos, ${s.novos} novos, ${s.quedas} quedas, ${s.sumidos} sumiram`
    : `FALHOU: ${s.erro}`;
  console.log(`  ${s.busca} · ${s.fonte}: ${linha}`);
}

const c = db.contagens(banco, ultima.data);
console.log(`\nTotais: ${c.ativos} ativos, ${c.novos} novos, ${c.quedas} quedas, ${c.abaixoFipe} abaixo da FIPE, ${c.sumiram} sumiram`);

// amostra por fonte, para conferir se preço e cidade estão sendo lidos certo
const fontes = banco.prepare("SELECT fonte, COUNT(*) n, COUNT(DISTINCT preco) precos, SUM(cidade IS NOT NULL) com_cidade FROM anuncios WHERE ativo = 1 GROUP BY fonte").all();
console.log("\nQualidade por fonte (anúncios ativos):");
for (const f of fontes) {
  console.log(`  ${f.fonte}: ${f.n} anúncios, ${f.precos} preços diferentes, ${f.com_cidade} com cidade`);
}
for (const f of fontes) {
  const amostra = banco.prepare("SELECT titulo, ano_modelo, km, preco, cidade, estado FROM anuncios WHERE ativo = 1 AND fonte = ? ORDER BY RANDOM() LIMIT 3").all(f.fonte);
  console.log(`\n  Exemplos ${f.fonte}:`);
  for (const a of amostra) {
    console.log(`    ${a.titulo} · ${a.ano_modelo || "?"} · ${a.km != null ? a.km.toLocaleString("pt-BR") + " km" : "? km"} · ${brl(a.preco)} · ${a.cidade || "?"}/${a.estado || "?"}`);
  }
}

console.log(`\nResumo do dia:\n${ultima.resumo || "(sem resumo)"}`);
banco.close();

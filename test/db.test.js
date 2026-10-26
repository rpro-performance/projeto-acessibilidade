const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

process.env.VEICULOMAIS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "vm-test-"));
const db = require("../src/db");
const { anuncio } = require("../src/normalize");
const { avaliar } = require("../coletor/avaliar");
const { resumoSimples } = require("../coletor/resumo");

const base = { fonte: "x", fonteNome: "X", marca: "Volkswagen", modelo: "Jetta", versao: "GLI", anoModelo: 2020, km: 50000, cidade: "Campinas", estado: "SP" };

test("coleta de dois dias: novos, queda de preço e sumidos", () => {
  const banco = db.abrir();
  const ontem = "2026-10-25";
  const hoje = "2026-10-26";

  // dia 1: dois anúncios
  const a1 = anuncio({ ...base, id: "1", url: "u1", preco: 150000 });
  const a2 = anuncio({ ...base, id: "2", url: "u2", preco: 160000 });
  assert.equal(db.upsertAnuncio(banco, a1, "Jetta", ontem).novo, true);
  assert.equal(db.upsertAnuncio(banco, a2, "Jetta", ontem).novo, true);
  assert.equal(db.marcarSumidos(banco, "x", "Jetta", ontem), 0);

  // dia 2: a1 caiu de preço, a2 sumiu, a3 é novo
  const r1 = db.upsertAnuncio(banco, anuncio({ ...base, id: "1", url: "u1", preco: 140000 }), "Jetta", hoje);
  assert.equal(r1.novo, false);
  assert.equal(r1.precoAnterior, 150000);
  const r3 = db.upsertAnuncio(banco, anuncio({ ...base, id: "3", url: "u3", preco: 170000 }), "Jetta", hoje);
  assert.equal(r3.novo, true);
  assert.equal(db.marcarSumidos(banco, "x", "Jetta", hoje), 1);

  db.atualizarFipe(banco, "x:1", 155000, -10);

  const c = db.contagens(banco, hoje);
  assert.deepEqual(c, { ativos: 2, novos: 1, quedas: 1, abaixoFipe: 1, sumiram: 1 });

  const quedas = db.listar(banco, { tipo: "quedas", data: hoje });
  assert.equal(quedas.length, 1);
  assert.equal(quedas[0].precoAnterior, 150000);
  assert.equal(quedas[0].fipe.diferencaPct, -10);
  assert.equal(db.listar(banco, { tipo: "sumiram", data: hoje })[0].id, "2");
  assert.deepEqual(db.historicoPreco(banco, "x:1").map((p) => p.preco), [150000, 140000]);

  // outra fonte com falha não marca nada como sumido
  assert.equal(db.marcarSumidos(banco, "y", "Jetta", hoje), 0);

  // relatório e resumo
  const id = db.iniciarColeta(banco, hoje);
  const rel = avaliar(banco, hoje);
  assert.equal(rel.oportunidades[0].id, "1");
  assert.ok(rel.oportunidades[0].motivos.some((m) => m.includes("abaixo da FIPE")));
  assert.equal(rel.porBusca[0].total, 2);
  const texto = resumoSimples(rel);
  assert.match(texto, /1 caíram de preço/);
  db.concluirColeta(banco, id, [{ fonte: "x", ok: true }], rel, texto);
  const ultima = db.ultimaColeta(banco);
  assert.equal(ultima.data, hoje);
  assert.equal(ultima.relatorio.contagens.sumiram, 1);
  const salvas = db.buscasSalvas(banco);
  assert.equal(salvas.length, 1);
  assert.equal(salvas[0].busca, "Jetta");
  assert.equal(salvas[0].n, 2);
  banco.close();
});

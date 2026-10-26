const test = require("node:test");
const assert = require("node:assert/strict");

const { anuncio, numero, inferirCambio } = require("../src/normalize");
const { agrupar } = require("../src/dedup");
const { passaFiltros, lerFiltros, ordenar } = require("../src/search");
const problemas = require("../src/problemas");
const { lerObjetoJson, slug } = require("../src/http");

test("numero converte formatos brasileiros", () => {
  assert.equal(numero("R$ 38.000"), 38000);
  assert.equal(numero("231.000"), 231000);
  assert.equal(numero(149990), 149990);
  assert.equal(numero(""), null);
});

test("inferirCambio deduz pelo nome da versão", () => {
  assert.equal(inferirCambio("2.0 GLI 350 TSI (Aut)"), "Automático");
  assert.equal(inferirCambio("Trendline 1.4 TSI 16V 4p Mec."), "Manual");
  assert.equal(inferirCambio("1.0 Flex"), null);
});

test("anuncio normaliza campos e descarta referências internas", () => {
  const a = anuncio({
    id: 1, fonte: "x", fonteNome: "X", marca: "VOLKSWAGEN", modelo: "JETTA",
    versao: "Gli 350 Tsi Aut.", descricao: "$a4", preco: "R$ 150.000", km: "10.000",
    combustivel: "MultiFlex", estado: "sp", anoModelo: 2020,
  });
  assert.equal(a.marca, "Volkswagen");
  assert.equal(a.descricao, "");
  assert.equal(a.cambio, "Automático");
  assert.equal(a.combustivel, "Flex");
  assert.equal(a.estado, "SP");
  assert.equal(a.anoModelo, 2020);
  assert.equal(a.ano, null);
});

test("agrupar junta o mesmo carro de fontes diferentes", () => {
  const base = { marca: "Volkswagen", modelo: "Jetta", anoModelo: 2020, preco: 150000, km: 50100, cidade: "São Paulo" };
  const lista = [
    { ...base, id: "1", fonte: "a", fonteNome: "A", url: "u1", foto: null },
    { ...base, id: "2", fonte: "b", fonteNome: "B", url: "u2", km: 50400, foto: "f" },
    { ...base, id: "3", fonte: "a", fonteNome: "A", url: "u3", preco: 160000 },
  ];
  const g = agrupar(lista);
  assert.equal(g.length, 2);
  assert.equal(g[0].fontes.length, 2);
  assert.equal(g[0].foto, "f");
});

test("passaFiltros respeita modelo, ano, preço e câmbio", () => {
  const a = anuncio({ id: 1, fonte: "x", fonteNome: "X", marca: "Volkswagen", modelo: "Jetta", versao: "2.0 GLI 350 TSI (Aut)", anoModelo: 2020, preco: 150000, km: 50000, cidade: "Campinas", estado: "SP" });
  const f = (q) => lerFiltros(new URLSearchParams(q));
  assert.equal(passaFiltros(a, f("marca=Volkswagen&modelo=Jetta GLI")), true);
  assert.equal(passaFiltros(a, f("modelo=Jetta Comfortline")), false);
  assert.equal(passaFiltros(a, f("modelo=Jetta&anoDe=2021")), false);
  assert.equal(passaFiltros(a, f("modelo=Jetta&precoAte=140000")), false);
  assert.equal(passaFiltros(a, f("modelo=Jetta&cambio=manual")), false);
  assert.equal(passaFiltros(a, f("modelo=Jetta&local=campinas, sp")), true);
  assert.equal(passaFiltros(a, f("modelo=Jetta&local=Curitiba")), false);
});

test("ordenar por preço e km", () => {
  const l = [{ preco: 3, km: 1 }, { preco: 1, km: null }, { preco: 2, km: 0 }];
  assert.deepEqual(ordenar([...l], "preco-asc").map((x) => x.preco), [1, 2, 3]);
  assert.deepEqual(ordenar([...l], "km-asc").map((x) => x.preco), [2, 3, 1]);
});

test("problemas conhecidos filtra por modelo e ano", () => {
  const f = problemas.paraModelo("Volkswagen", "Jetta GLI", 2020);
  assert.ok(f && f.problemas.length > 0);
  assert.ok(f.problemas.every((p) => p.anoAte == null || p.anoAte >= 2020));
  assert.equal(problemas.paraModelo("Volkswagen", "Inexistente", null), null);
});

test("lerObjetoJson e slug", () => {
  const t = 'xx "dataBySegment":{"id":1,"a":{"b":"}"},"c":[1,2]} yy';
  assert.deepEqual(lerObjetoJson(t, t.indexOf("{")), { id: 1, a: { b: "}" }, c: [1, 2] });
  assert.equal(slug("Chaves na Mão / Jetta GLI"), "chaves-na-mao-jetta-gli");
});

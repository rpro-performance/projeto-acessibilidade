const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

process.env.VEICULOMAIS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "vm-app-"));
const { deveRodar } = require("../src/coleta");
const buscas = require("../src/buscas");

const agenda = { ativo: true, hora: 6, minuto: 0 };
const em = (s) => new Date(s);

test("agenda: não roda antes do horário nem desligada", () => {
  assert.equal(deveRodar(em("2026-11-04T05:59:00"), agenda, null, null).rodar, false);
  assert.equal(deveRodar(em("2026-11-04T07:00:00"), { ...agenda, ativo: false }, null, null).rodar, false);
});

test("agenda: roda depois do horário, inclusive ao acordar mais tarde", () => {
  assert.equal(deveRodar(em("2026-11-04T06:00:00"), agenda, null, null).rodar, true);
  assert.equal(deveRodar(em("2026-11-04T09:40:00"), agenda, "2026-11-03", null).rodar, true);
});

test("agenda: uma vez por dia", () => {
  assert.equal(deveRodar(em("2026-11-04T10:00:00"), agenda, "2026-11-04", null).rodar, false);
});

test("agenda: coleta manual feita hoje depois do horário conta como a do dia", () => {
  const ultima = { data: "2026-11-04", inicio: em("2026-11-04T08:00:00").toISOString() };
  assert.deepEqual(deveRodar(em("2026-11-04T09:00:00"), agenda, null, ultima), { rodar: false, marcar: true });
  const antes = { data: "2026-11-04", inicio: em("2026-11-04T02:00:00").toISOString() };
  assert.equal(deveRodar(em("2026-11-04T09:00:00"), agenda, null, antes).rodar, true);
});

test("buscas: valida, limpa e mantém o nome", () => {
  const r = buscas.validar({
    buscas: [{ nome: "Jetta GLI", marca: "Volkswagen", modelo: "Jetta GLI", anoDe: "2019", precoAte: "200.000", kmAte: "" }],
    fontes: ["olx", "inexistente"],
  });
  assert.deepEqual(r.buscas[0], { nome: "Jetta GLI", marca: "Volkswagen", modelo: "Jetta GLI", anoDe: 2019, precoAte: 200000 });
  assert.deepEqual(r.fontes, ["olx"]);
  assert.equal(buscas.validar({ buscas: [{ marca: "Honda", modelo: "Civic" }], fontes: ["olx"] }).buscas[0].nome, "Honda Civic");
  assert.throws(() => buscas.validar({ buscas: [{ marca: "Honda" }], fontes: ["olx"] }), /modelo/);
  assert.throws(() => buscas.validar({ buscas: [{ modelo: "Civic" }, { modelo: "Civic" }], fontes: ["olx"] }), /mesmo nome/);
  assert.throws(() => buscas.validar({ buscas: [{ modelo: "Civic" }], fontes: [] }), /pelo menos um site/);
});

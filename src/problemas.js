// Ficha de problemas conhecidos por marca/modelo, lida de data/problemas-conhecidos.json.

const fs = require("fs");
const path = require("path");

const arquivo = path.join(__dirname, "..", "data", "problemas-conhecidos.json");
let base = [];
try {
  base = JSON.parse(fs.readFileSync(arquivo, "utf8"));
} catch {
  base = [];
}

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function paraModelo(marca, modelo, ano) {
  const m = norm(marca);
  const mod = norm(modelo);
  if (!mod) return null;
  const fichas = base.filter((f) => (!m || norm(f.marca) === m) && mod.startsWith(norm(f.modelo)));
  if (!fichas.length) return null;
  const itens = [];
  for (const f of fichas) {
    for (const p of f.problemas) {
      const dentro =
        !ano || ((p.anoDe == null || ano >= p.anoDe) && (p.anoAte == null || ano <= p.anoAte));
      if (dentro) itens.push(p);
    }
  }
  if (!itens.length) return null;
  return { marca: fichas[0].marca, modelo: fichas[0].modelo, problemas: itens };
}

module.exports = { paraModelo };

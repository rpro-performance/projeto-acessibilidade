// Lista de buscas acompanhadas pelo coletor. A cópia do usuário fica em ~/.veiculomais/buscas.json
// (editada pela tela de Configurações); se ainda não existir, usa o padrão do projeto.
const fs = require("fs");
const path = require("path");
const { DIR } = require("./db");

const ARQUIVO = path.join(DIR, "buscas.json");
const PADRAO = path.join(__dirname, "..", "coletor", "buscas.json");
const FONTES = ["mobiauto", "napista", "chavesnamao", "olx", "webmotors", "mercadolivre"];
const CAMPOS_NUMERICOS = ["anoDe", "anoAte", "precoDe", "precoAte", "kmAte"];

function ler() {
  const arquivo = fs.existsSync(ARQUIVO) ? ARQUIVO : PADRAO;
  return JSON.parse(fs.readFileSync(arquivo, "utf8"));
}

function numero(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function texto(v, max = 60) {
  return String(v || "").replace(/[<>]/g, "").trim().slice(0, max);
}

// Valida e limpa o que vem da tela antes de gravar. Lança erro com mensagem em português.
function validar(entrada) {
  if (!entrada || !Array.isArray(entrada.buscas)) throw new Error("formato inválido: falta a lista de buscas");
  if (entrada.buscas.length > 30) throw new Error("no máximo 30 buscas");
  const buscas = [];
  for (const b of entrada.buscas) {
    const busca = { nome: texto(b.nome), marca: texto(b.marca), modelo: texto(b.modelo) };
    if (!busca.modelo) throw new Error("toda busca precisa de um modelo");
    if (!busca.nome) busca.nome = [busca.marca, busca.modelo].filter(Boolean).join(" ");
    for (const c of CAMPOS_NUMERICOS) {
      const n = numero(b[c]);
      if (n != null) busca[c] = n;
    }
    for (const c of ["cambio", "combustivel", "local"]) {
      const t = texto(b[c]);
      if (t) busca[c] = t;
    }
    buscas.push(busca);
  }
  const nomes = buscas.map((b) => b.nome.toLowerCase());
  if (new Set(nomes).size !== nomes.length) throw new Error("há duas buscas com o mesmo nome");

  const atual = ler();
  const fontes = Array.isArray(entrada.fontes) ? entrada.fontes.filter((f) => FONTES.includes(f)) : atual.fontes;
  if (!fontes || !fontes.length) throw new Error("escolha pelo menos um site");
  return {
    buscas,
    fontes,
    paginasPorFonte: atual.paginasPorFonte || { padrao: 2, webmotors: 1 },
    ritmoMs: atual.ritmoMs || { min: 2500, max: 6000 },
  };
}

function gravar(entrada) {
  const limpo = validar(entrada);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify(limpo, null, 2) + "\n");
  return limpo;
}

module.exports = { ARQUIVO, PADRAO, FONTES, ler, gravar, validar };

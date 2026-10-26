// Consulta à Tabela FIPE via API pública (parallelum.com.br), com cache em memória.
// Usada para mostrar o preço de referência do modelo pesquisado.

const { fetchJson } = require("./http");

const BASE = "https://parallelum.com.br/fipe/api/v1/carros";
const TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map();

async function cacheado(chave, fn) {
  const hit = cache.get(chave);
  if (hit && hit.expira > Date.now()) return hit.valor;
  const valor = await fn();
  cache.set(chave, { valor, expira: Date.now() + TTL_MS });
  return valor;
}

function tokens(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter(Boolean);
}

// Pontua o quanto o nome FIPE combina com o que o usuário digitou.
function pontuar(nomeFipe, procurado) {
  const a = tokens(nomeFipe);
  const b = tokens(procurado);
  if (!b.length) return 0;
  let pontos = 0;
  for (const t of b) if (a.includes(t)) pontos += 2;
  // penaliza nomes muito mais longos (versões cheias de siglas)
  pontos -= Math.max(0, a.length - b.length) * 0.1;
  return pontos;
}

async function marcas() {
  return cacheado("marcas", () => fetchJson(`${BASE}/marcas`));
}

async function modelos(codigoMarca) {
  return cacheado(`modelos:${codigoMarca}`, async () => {
    const r = await fetchJson(`${BASE}/marcas/${codigoMarca}/modelos`);
    return r.modelos || [];
  });
}

async function anos(codigoMarca, codigoModelo) {
  return cacheado(`anos:${codigoMarca}:${codigoModelo}`, () =>
    fetchJson(`${BASE}/marcas/${codigoMarca}/modelos/${codigoModelo}/anos`)
  );
}

async function valor(codigoMarca, codigoModelo, codigoAno) {
  return cacheado(`valor:${codigoMarca}:${codigoModelo}:${codigoAno}`, () =>
    fetchJson(`${BASE}/marcas/${codigoMarca}/modelos/${codigoModelo}/anos/${codigoAno}`)
  );
}

// Devolve o preço FIPE mais próximo de { marca, modelo, ano } ou null se não achar.
async function referencia({ marca, modelo, ano }) {
  if (!marca || !modelo) return null;
  const listaMarcas = await marcas();
  const procurados = tokens(marca);
  const m =
    listaMarcas.find((x) => tokens(x.nome).join(" ") === procurados.join(" ")) ||
    listaMarcas.find((x) => tokens(x.nome).some((t) => procurados.includes(t))) ||
    listaMarcas.find((x) => tokens(x.nome).some((t) => procurados.some((p) => t.startsWith(p) || p.startsWith(t))));
  if (!m) return null;

  const listaModelos = await modelos(m.codigo);
  const candidatos = listaModelos
    .map((x) => ({ ...x, pontos: pontuar(x.nome, modelo) }))
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos);
  if (!candidatos.length) return null;

  // Entre os melhores candidatos, prefere o que tem o ano pedido na tabela
  // (evita casar "Civic" com uma versão dos anos 90 quando se procura um 2020).
  const alvo = ano ? Number(ano) : null;
  let escolhido = null;
  let anoEscolhido = null;
  for (const cand of candidatos.slice(0, 8)) {
    const listaAnos = await anos(m.codigo, cand.codigo);
    if (!listaAnos.length) continue;
    const exato = alvo ? listaAnos.find((x) => x.nome.startsWith(String(alvo))) : null;
    if (exato) {
      escolhido = cand;
      anoEscolhido = exato;
      break;
    }
    if (!escolhido) {
      escolhido = cand;
      anoEscolhido = alvo
        ? listaAnos.reduce((melhor, x) => {
            const d = Math.abs(Number(x.nome.slice(0, 4)) - alvo);
            return d < melhor.d ? { d, x } : melhor;
          }, { d: Infinity, x: listaAnos[0] }).x
        : listaAnos[0];
    }
    if (!alvo) break;
  }
  if (!escolhido) return null;

  const v = await valor(m.codigo, escolhido.codigo, anoEscolhido.codigo);
  const numero = Number(String(v.Valor || "").replace(/[^\d,]/g, "").replace(",", "."));
  return {
    marca: v.Marca,
    modelo: v.Modelo,
    ano: v.AnoModelo,
    combustivel: v.Combustivel,
    valor: Number.isFinite(numero) ? numero : null,
    valorFormatado: v.Valor,
    mesReferencia: v.MesReferencia,
    codigoFipe: v.CodigoFipe,
  };
}

module.exports = { referencia, marcas, modelos, anos, valor };

// Orquestra a busca: dispara todas as fontes em paralelo, normaliza, filtra, agrupa duplicados,
// ordena e anexa preço FIPE e problemas conhecidos.

const { fontes, porChave } = require("./connectors");
const { agrupar } = require("./dedup");
const fipe = require("./fipe");
const problemas = require("./problemas");

function lerFiltros(params) {
  const g = (k) => (params.get(k) || "").trim();
  const n = (k) => {
    const v = g(k).replace(/\./g, "");
    return v ? Number(v) : null;
  };
  const fontesPedidas = params.getAll("fonte").filter(Boolean);
  return {
    marca: g("marca"),
    modelo: g("modelo"),
    anoDe: n("anoDe"),
    anoAte: n("anoAte"),
    precoDe: n("precoDe"),
    precoAte: n("precoAte"),
    kmAte: n("kmAte"),
    cambio: g("cambio").toLowerCase(),
    combustivel: g("combustivel").toLowerCase(),
    local: g("local").toLowerCase(),
    ordem: g("ordem") || "relevancia",
    fontes: fontesPedidas.length ? fontesPedidas : fontes.map((f) => f.chave),
  };
}

function tokens(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter(Boolean);
}

function semAcento(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function passaFiltros(a, f) {
  // o texto digitado em "modelo" precisa aparecer no título/versão (ex.: "jetta gli")
  const alvo = tokens([a.marca, a.modelo, a.versao, a.titulo].join(" ")).join(" ");
  for (const t of tokens(f.modelo)) if (!alvo.includes(t)) return false;
  if (f.marca && !tokens(a.marca).join(" ").includes(tokens(f.marca)[0] || "")) return false;

  const ano = a.anoModelo ?? a.ano;
  if (f.anoDe && ano != null && ano < f.anoDe) return false;
  if (f.anoAte && ano != null && ano > f.anoAte) return false;
  if (f.precoDe && a.preco != null && a.preco < f.precoDe) return false;
  if (f.precoAte && a.preco != null && a.preco > f.precoAte) return false;
  if (f.kmAte && a.km != null && a.km > f.kmAte) return false;
  if (f.cambio && a.cambio && semAcento(a.cambio).slice(0, 4) !== f.cambio.slice(0, 4)) return false;
  if (f.combustivel && a.combustivel && semAcento(a.combustivel).slice(0, 4) !== f.combustivel.slice(0, 4)) return false;
  if (f.local) {
    const l = semAcento([a.cidade, a.estado].filter(Boolean).join(" "));
    const pedacos = f.local.split(/[,\s]+/).filter(Boolean).map(semAcento);
    if (!pedacos.some((p) => l.includes(p))) return false;
  }
  return true;
}

function marcaMaisComum(lista) {
  const contagem = new Map();
  for (const a of lista) if (a.marca) contagem.set(a.marca, (contagem.get(a.marca) || 0) + 1);
  let melhor = "";
  let max = 0;
  for (const [marca, n] of contagem) if (n > max) { max = n; melhor = marca; }
  return melhor;
}

function maisComum(lista, pegar) {
  const contagem = new Map();
  for (const a of lista) {
    const v = pegar(a);
    if (v) contagem.set(v, (contagem.get(v) || 0) + 1);
  }
  let melhor = null;
  let max = 0;
  for (const [v, n] of contagem) if (n > max) { max = n; melhor = v; }
  return melhor;
}

function ordenar(lista, ordem) {
  const asc = (k) => (a, b) => (a[k] ?? Infinity) - (b[k] ?? Infinity);
  const desc = (k) => (a, b) => (b[k] ?? -Infinity) - (a[k] ?? -Infinity);
  switch (ordem) {
    case "preco-asc": return lista.sort(asc("preco"));
    case "preco-desc": return lista.sort(desc("preco"));
    case "ano-desc": return lista.sort(desc("anoModelo"));
    case "km-asc": return lista.sort(asc("km"));
    default: return lista; // relevância: ordem de chegada (fontes já ordenam por relevância)
  }
}

async function buscar(params) {
  const f = lerFiltros(params);
  if (!f.marca && !f.modelo) {
    return { erro: "Informe pelo menos a marca ou o modelo.", filtros: f, anuncios: [], fontes: [] };
  }

  const inicio = Date.now();

  // Sem marca, descobre a marca pelos resultados do Na Pista (busca por texto livre)
  // para que as fontes que exigem marca+modelo também participem.
  let resultadosPrevios = [];
  if (!f.marca && f.fontes.includes("napista")) {
    const t0 = Date.now();
    try {
      const lista = await porChave.napista.buscar(f);
      resultadosPrevios.push({ fonte: "napista", nome: "Na Pista", ok: true, total: lista.length, ms: Date.now() - t0, lista });
      f.marca = marcaMaisComum(lista.filter((a) => passaFiltros(a, { ...f, marca: "" })));
    } catch (e) {
      resultadosPrevios.push({ fonte: "napista", nome: "Na Pista", ok: false, total: 0, ms: Date.now() - t0, erro: e.message, lista: [] });
    }
  }

  const execucoes = f.fontes
    .filter((chave) => porChave[chave] && !resultadosPrevios.some((r) => r.fonte === chave))
    .map(async (chave) => {
      const fonte = porChave[chave];
      const t0 = Date.now();
      try {
        const lista = await fonte.buscar(f);
        return { fonte: chave, nome: fonte.nome, ok: true, total: lista.length, ms: Date.now() - t0, lista };
      } catch (e) {
        return {
          fonte: chave,
          nome: fonte.nome,
          ok: false,
          total: 0,
          ms: Date.now() - t0,
          erro: e.message,
          configuracao: Boolean(e.configuracao),
          lista: [],
        };
      }
    });

  const resultadosNovos = await Promise.all(execucoes);

  const resultados = [...resultadosPrevios, ...resultadosNovos];
  const brutos = resultados.flatMap((r) => r.lista);
  const filtrados = brutos.filter((a) => passaFiltros(a, f));
  const agrupados = ordenar(agrupar(filtrados), f.ordem);

  // Preço FIPE do modelo: usa o ano pedido ou o ano mais comum entre os anúncios encontrados.
  // A versão mais comum entre os anúncios ajuda a casar o nome certo na tabela FIPE.
  const anoFipe = f.anoDe || f.anoAte || maisComum(filtrados, (a) => a.anoModelo ?? a.ano);
  const versaoFipe = maisComum(filtrados, (a) => a.versao);
  const fipeRef = await fipe
    .referencia({ marca: f.marca, modelo: `${f.modelo} ${versaoFipe || ""}`.trim(), ano: anoFipe })
    .catch(() => null);

  for (const a of agrupados) {
    a.fipe = fipeRef && fipeRef.valor && a.preco ? {
      valor: fipeRef.valor,
      diferencaPct: Math.round(((a.preco - fipeRef.valor) / fipeRef.valor) * 100),
    } : null;
  }

  const marcaFicha = f.marca || agrupados[0]?.marca;
  const ficha = problemas.paraModelo(marcaFicha, f.modelo || agrupados[0]?.modelo, f.anoDe || null);

  return {
    filtros: f,
    fontes: resultados.map(({ lista, ...r }) => r),
    totalBruto: brutos.length,
    total: agrupados.length,
    duplicadosAgrupados: filtrados.length - agrupados.length,
    fipe: fipeRef,
    problemasConhecidos: ficha,
    anuncios: agrupados,
    ms: Date.now() - inicio,
  };
}

module.exports = { buscar, lerFiltros, passaFiltros, ordenar };

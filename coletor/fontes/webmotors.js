// Webmotors (www.webmotors.com.br) lida pelo navegador do usuário.
// A página de estoque busca os anúncios numa API interna (/api/search/car); capturamos essa resposta
// enquanto a página carrega. Se não vier, lemos os cards no DOM. Escrito sem acesso direto ao site
// (ele bloqueia servidores); em caso de falha salva HTML e captura em ~/.veiculomais/debug.

const { anuncio } = require("../../src/normalize");
const { slug } = require("../../src/http");
const { pausa, rolar, pareceBloqueio, aguardarHumano, salvarDebug } = require("../navegador");

const BASE = "https://www.webmotors.com.br";

function montarUrl(q, pagina) {
  const modeloBase = (q.modelo || "").split(/\s+/)[0];
  const caminho = [slug(q.marca), slug(modeloBase)].filter(Boolean).join("/");
  const p = new URLSearchParams({ tipoveiculo: "carros" });
  if (q.anoDe) p.set("anode", String(q.anoDe));
  if (q.anoAte) p.set("anoate", String(q.anoAte));
  if (q.precoDe) p.set("precode", String(q.precoDe));
  if (q.precoAte) p.set("precoate", String(q.precoAte));
  if (pagina > 1) p.set("page", String(pagina));
  return `${BASE}/carros/estoque/${caminho}?${p}`;
}

function deApi(item) {
  const s = item.Specification || {};
  const seller = item.Seller || {};
  const fotos = (item.Media && item.Media.Photos) || [];
  const foto = fotos.length ? fotos[0].PhotoPath || fotos[0].Url || null : null;
  const make = s.Make?.Value;
  const model = s.Model?.Value;
  const version = s.Version?.Value;
  const anoFab = s.YearFabrication;
  const anoMod = s.YearModel;
  const url =
    item.Url ||
    `${BASE}/comprar/${slug(make)}/${slug(model)}/${slug(version)}/${s.NumberPorts || 4}-portas/${anoFab}-${anoMod}/${item.UniqueId}`;
  return anuncio({
    id: item.UniqueId || item.Id,
    fonte: "webmotors",
    fonteNome: "Webmotors",
    url,
    titulo: s.Title,
    marca: make,
    modelo: model,
    versao: version,
    ano: anoFab,
    anoModelo: anoMod,
    km: s.Odometer,
    preco: item.Prices?.SearchPrice ?? item.Prices?.Price,
    cambio: s.Transmission?.Value,
    combustivel: s.Fuel?.Value,
    cor: s.Color?.Primary,
    cidade: seller.City,
    estado: seller.State,
    foto,
    descricao: item.LongComment || "",
    vendedor: seller.FantasyName || seller.SellerType,
  });
}

async function extrairDom(page, q) {
  const cards = await page.evaluate(() => {
    const vistos = new Set();
    const saida = [];
    for (const a of document.querySelectorAll('a[href*="/comprar/"]')) {
      const href = a.href;
      if (vistos.has(href)) continue;
      const card = a.closest("article, li, div") || a;
      const texto = card.innerText || "";
      if (!/R\$\s?[\d.]+/.test(texto)) continue;
      vistos.add(href);
      const titulo = (card.querySelector("h2, h3") || a).innerText.trim();
      const img = card.querySelector("img");
      saida.push({ href, titulo, texto, foto: img ? img.src : null });
    }
    return saida;
  });
  return cards.map((c) => {
    const preco = (c.texto.match(/R\$\s?([\d.]+)/) || [])[1];
    const anos = c.texto.match(/\b(20\d{2}|19\d{2})\s*\/\s*(20\d{2}|19\d{2})\b/);
    const ano = anos ? anos[1] : (c.texto.match(/\b(19|20)\d{2}\b/) || [])[0];
    const km = (c.texto.match(/([\d.]+)\s*km/i) || [])[1];
    const local = (c.texto.match(/\n([^\n]+ - [A-Z]{2})\b/) || [])[1] || "";
    const [cidade, uf] = local.split(" - ");
    return anuncio({
      id: (c.href.match(/\/(\d{6,})(?:[/?#]|$)/) || [])[1] || c.href,
      fonte: "webmotors",
      fonteNome: "Webmotors",
      url: c.href,
      titulo: c.titulo,
      marca: q.marca,
      modelo: q.modelo,
      ano,
      anoModelo: anos ? anos[2] : ano,
      km,
      preco,
      cambio: /autom[aá]tic/i.test(c.texto) ? "Automático" : /manual/i.test(c.texto) ? "Manual" : null,
      combustivel: (c.texto.match(/flex|gasolina|diesel|h[ií]brido|el[eé]trico/i) || [])[0],
      cidade,
      estado: uf,
      foto: c.foto,
    });
  });
}

async function buscar(contexto, q, { paginas = 2, ritmo = { min: 2500, max: 6000 }, visivel = true } = {}) {
  const page = await contexto.newPage();
  const resultados = [];
  const capturados = [];
  page.on("response", async (res) => {
    try {
      if (!/\/api\/search\/car/i.test(res.url())) return;
      const dados = await res.json();
      const lista = dados.SearchResults || dados.searchResults || dados.results;
      if (Array.isArray(lista)) capturados.push(...lista);
    } catch {
      // resposta que não é JSON: ignora
    }
  });
  try {
    for (let n = 1; n <= paginas; n++) {
      capturados.length = 0;
      await page.goto(montarUrl(q, n), { waitUntil: "domcontentloaded", timeout: 60000 });
      await pausa(ritmo.min, ritmo.max);
      await rolar(page);
      if (await pareceBloqueio(page)) {
        const liberou = visivel && (await aguardarHumano(page));
        if (!liberou) {
          const base = await salvarDebug(page, "webmotors-bloqueio");
          throw new Error(`Webmotors pediu verificação humana e ela não foi resolvida (captura em ${base}.png)`);
        }
        await rolar(page);
      }
      if (!capturados.length) await page.waitForSelector('a[href*="/comprar/"]', { timeout: 15000 }).catch(() => {});
      let lista = capturados.length ? capturados.map(deApi) : await extrairDom(page, q);
      const vistos = new Set(resultados.map((a) => a.id));
      lista = lista.filter((a) => (vistos.has(a.id) ? false : vistos.add(a.id)));
      if (!lista.length) {
        const base = await salvarDebug(page, "webmotors-vazio");
        if (n === 1) throw new Error(`nenhum anúncio reconhecido na Webmotors (página salva em ${base}.html)`);
        break;
      }
      resultados.push(...lista);
      if (lista.length < 10) break;
    }
  } finally {
    await page.close().catch(() => {});
  }
  return resultados;
}

module.exports = { chave: "webmotors", nome: "Webmotors", navegador: true, buscar };

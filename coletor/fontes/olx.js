// OLX (www.olx.com.br) lida pelo navegador do usuário.
// Estratégias, em ordem: JSON embutido (__NEXT_DATA__ -> pageProps.ads), depois os cards no DOM.
// Escrito sem acesso direto ao site (ele bloqueia servidores); se nada for extraído, salva HTML e
// captura de tela em ~/.veiculomais/debug para ajuste.

const { anuncio } = require("../../src/normalize");
const { pausa, rolar, pareceBloqueio, aguardarHumano, salvarDebug } = require("../navegador");

const BASE = "https://www.olx.com.br";

function montarUrl(q, pagina) {
  const termos = [q.marca, q.modelo].filter(Boolean).join(" ");
  const p = new URLSearchParams({ q: termos, sf: "1" }); // sf=1: mais recentes primeiro
  if (q.precoDe) p.set("ps", String(q.precoDe));
  if (q.precoAte) p.set("pe", String(q.precoAte));
  if (pagina > 1) p.set("o", String(pagina));
  return `${BASE}/autos-e-pecas/carros-vans-e-utilitarios?${p}`;
}

function prop(ad, nome) {
  const p = (ad.properties || []).find((x) => x.name === nome);
  return p ? p.value : null;
}

function deNextData(ad, q) {
  const local = ad.locationDetails || {};
  const localTexto = String(ad.location || "");
  const [cidadeTxt, ufTxt] = localTexto.split(" - ");
  const imagem = (ad.images && ad.images[0] && (ad.images[0].original || ad.images[0].originalWebP)) || ad.thumbnail || null;
  const ano = prop(ad, "regdate");
  return anuncio({
    id: ad.listId || ad.id || ad.url,
    fonte: "olx",
    fonteNome: "OLX",
    url: ad.url || ad.friendlyUrl,
    titulo: ad.subject || ad.title,
    marca: prop(ad, "vehicle_brand") || q.marca,
    modelo: prop(ad, "vehicle_model") || q.modelo,
    versao: prop(ad, "vehicle_version") || "",
    ano,
    anoModelo: ano,
    km: prop(ad, "mileage"),
    preco: ad.price,
    cambio: prop(ad, "gearbox"),
    combustivel: prop(ad, "fuel"),
    cor: prop(ad, "carcolor"),
    cidade: local.municipality || cidadeTxt,
    estado: local.uf || ufTxt,
    foto: imagem,
    descricao: ad.body || "",
    vendedor: ad.professionalAd ? "Loja" : "Particular",
    publicadoEm: ad.date ? new Date(ad.date * 1000).toISOString() : null,
  });
}

async function extrairNextData(page) {
  const texto = await page.$eval("#__NEXT_DATA__", (el) => el.textContent).catch(() => null);
  if (!texto) return null;
  try {
    const dados = JSON.parse(texto);
    const ads = dados?.props?.pageProps?.ads;
    return Array.isArray(ads) ? ads : null;
  } catch {
    return null;
  }
}

// Alguns layouts expõem a lista como JSON-LD (ItemList de Product/Car).
async function extrairJsonLd(page, q) {
  const blocos = await page.$$eval('script[type="application/ld+json"]', (els) => els.map((e) => e.textContent));
  const itens = [];
  for (const b of blocos) {
    try {
      const d = JSON.parse(b);
      const lista = d.itemListElement || (Array.isArray(d) ? d : []);
      for (const it of lista) {
        const item = it.item || it;
        if (!item || !item.url) continue;
        const offer = item.offers || {};
        itens.push(
          anuncio({
            id: (item.url.match(/-(\d{6,})/) || [])[1] || item.url,
            fonte: "olx",
            fonteNome: "OLX",
            url: item.url,
            titulo: item.name,
            marca: item.brand?.name || q.marca,
            modelo: item.model || q.modelo,
            ano: item.vehicleModelDate || item.productionDate,
            anoModelo: item.vehicleModelDate,
            km: item.mileageFromOdometer?.value,
            preco: offer.price,
            foto: Array.isArray(item.image) ? item.image[0] : item.image,
            descricao: item.description,
          })
        );
      }
    } catch {
      // bloco que não é lista de anúncios
    }
  }
  return itens;
}

async function extrairDom(page, q) {
  const cards = await page.evaluate(() => {
    const vistos = new Set();
    const saida = [];
    for (const a of document.querySelectorAll('a[href*="olx.com.br/"]')) {
      const href = a.href;
      if (!/-\d{7,}(?:[?#]|$)/.test(href) || vistos.has(href)) continue;
      const card = a.closest("li, article, section, div") || a;
      const texto = card.innerText || "";
      if (!/R\$\s?[\d.]+/.test(texto)) continue;
      vistos.add(href);
      const titulo = (a.querySelector("h2, h3") || card.querySelector("h2, h3") || a).innerText.trim();
      const img = card.querySelector("img");
      saida.push({ href, titulo, texto, foto: img ? img.src : null });
    }
    return saida;
  });
  return cards.map((c) => {
    const preco = (c.texto.match(/R\$\s?([\d.]+)/) || [])[1];
    const ano = (c.texto.match(/\b(19|20)\d{2}\b/) || [])[0];
    const km = (c.texto.match(/([\d.]+)\s*km/i) || [])[1];
    const local = (c.texto.match(/\n([^\n]+ - [A-Z]{2})\b/) || [])[1] || "";
    const [cidade, uf] = local.split(" - ");
    return anuncio({
      id: (c.href.match(/-(\d{6,})/) || [])[1] || c.href,
      fonte: "olx",
      fonteNome: "OLX",
      url: c.href,
      titulo: c.titulo,
      marca: q.marca,
      modelo: q.modelo,
      ano,
      anoModelo: ano,
      km,
      preco,
      cambio: /autom[aá]tico/i.test(c.texto) ? "Automático" : /manual/i.test(c.texto) ? "Manual" : null,
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
  try {
    for (let n = 1; n <= paginas; n++) {
      await page.goto(montarUrl(q, n), { waitUntil: "domcontentloaded", timeout: 60000 });
      await pausa(ritmo.min, ritmo.max);
      if (await pareceBloqueio(page)) {
        const liberou = visivel && (await aguardarHumano(page));
        if (!liberou) {
          const base = await salvarDebug(page, "olx-bloqueio");
          throw new Error(`OLX pediu verificação humana e ela não foi resolvida (captura em ${base}.png)`);
        }
      }
      await page.waitForSelector('a[href*="olx.com.br/"]', { timeout: 15000 }).catch(() => {});
      await rolar(page);
      let lista = null;
      const ads = await extrairNextData(page);
      if (ads) lista = ads.map((ad) => deNextData(ad, q)).filter((a) => a.url);
      if (!lista || !lista.length) lista = await extrairJsonLd(page, q);
      if (!lista || !lista.length) lista = await extrairDom(page, q);
      if (!lista.length) {
        const base = await salvarDebug(page, "olx-vazio");
        if (n === 1) throw new Error(`nenhum anúncio reconhecido na OLX (página salva em ${base}.html)`);
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

module.exports = { chave: "olx", nome: "OLX", navegador: true, buscar };

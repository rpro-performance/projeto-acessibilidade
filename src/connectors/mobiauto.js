// Conector Mobiauto (www.mobiauto.com.br).
// A página de listagem é Next.js e traz os anúncios em __NEXT_DATA__ (props.pageProps.deals.results).
// Precisa de marca e modelo para montar a URL. Filtros de ano/preço são aplicados depois, no app.

const { fetchTexto, extrairNextData, slug } = require("../http");
const { anuncio } = require("../normalize");

const BASE = "https://www.mobiauto.com.br";

function foto(imagens) {
  const primeira = Array.isArray(imagens) && imagens.length ? imagens[0] : null;
  if (!primeira || !primeira.imageId) return null;
  return `https://image1.mobiauto.com.br/images/api/images/v1.0/${primeira.imageId}/transform/fl_progressive,f_webp,q_70,w_640`;
}

function mapear(r) {
  const trim = r.trim || {};
  const make = trim.make?.name || "";
  const model = trim.model?.name || "";
  const dealer = r.dealer || {};
  const loc = dealer.location || {};
  const ano = trim.productionYear || trim.model?.year || null;
  const local = [slug(loc.state), slug(loc.city)].filter(Boolean).join("-");
  const url = `${BASE}/comprar/carros/${local}/${slug(make)}/${slug(model)}/${ano || ""}/${slug(trim.name)}/detalhes/${r.id}`;
  return anuncio({
    id: r.id,
    fonte: "mobiauto",
    fonteNome: "Mobiauto",
    url,
    marca: make,
    modelo: model,
    versao: trim.name,
    ano,
    anoModelo: trim.model?.year,
    km: r.km,
    preco: r.price,
    cambio: trim.transmission?.name,
    combustivel: trim.fuel?.name,
    cidade: loc.city,
    estado: loc.state,
    foto: foto(r.images),
    vendedor: dealer.name,
    descricao: [trim.bodystyle?.name, trim.doors ? `${trim.doors} portas` : null, r.deal0km ? "0 km" : null]
      .filter(Boolean)
      .join(" · "),
  });
}

async function buscar(q) {
  if (!q.marca || !q.modelo) {
    throw new Error("Mobiauto precisa de marca e modelo");
  }
  const modeloBase = q.modelo.split(/\s+/)[0];
  const url = `${BASE}/comprar/carros-usados/brasil/${slug(q.marca)}/${slug(modeloBase)}`;
  const r = await fetchTexto(url);
  if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
  const dados = extrairNextData(r.texto);
  const resultados = dados?.props?.pageProps?.deals?.results;
  if (!Array.isArray(resultados)) throw new Error("estrutura da página mudou");
  return resultados.map(mapear);
}

module.exports = { chave: "mobiauto", nome: "Mobiauto", buscar };

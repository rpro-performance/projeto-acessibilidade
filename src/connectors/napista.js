// Conector Na Pista (napista.com.br).
// Aceita busca por texto livre: /busca/<termos>?pn=<página>. Os anúncios vêm em
// __NEXT_DATA__ (props.pageProps.searchResult.offers), 48 por página.

const { fetchTexto, extrairNextData } = require("../http");
const { anuncio } = require("../normalize");

const BASE = "https://napista.com.br";
const PAGINAS = 2;

function mapear(o) {
  const loc = o.location || {};
  const foto = Array.isArray(o.photos) && o.photos.length ? o.photos[0].url : null;
  return anuncio({
    id: o.id,
    fonte: "napista",
    fonteNome: "Na Pista",
    url: `${BASE}/anuncios/${o.id}`,
    marca: o.makeName,
    modelo: o.modelName,
    versao: o.compVersionName || o.versionName,
    ano: o.manufacturedYear,
    anoModelo: o.modelYear,
    km: o.mileage,
    preco: o.price,
    cidade: loc.city,
    estado: loc.uf,
    foto,
    vendedor: o.seller,
    publicadoEm: o.createdDate,
    descricao: o.newVehicle ? "0 km" : "",
  });
}

async function buscar(q) {
  const termos = [q.marca, q.modelo].filter(Boolean).join(" ").trim();
  if (!termos) throw new Error("informe marca ou modelo");
  const paginas = [];
  for (let pn = 1; pn <= PAGINAS; pn++) {
    paginas.push(fetchTexto(`${BASE}/busca/${encodeURIComponent(termos)}?pn=${pn}`));
  }
  const respostas = await Promise.allSettled(paginas);
  const resultados = [];
  let algumaOk = false;
  for (const resp of respostas) {
    if (resp.status !== "fulfilled" || resp.value.status >= 400) continue;
    const dados = extrairNextData(resp.value.texto);
    const offers = dados?.props?.pageProps?.searchResult?.offers;
    if (!Array.isArray(offers)) continue;
    algumaOk = true;
    resultados.push(...offers.map(mapear));
  }
  if (!algumaOk) {
    const primeira = respostas[0];
    throw new Error(
      primeira.status === "rejected" ? primeira.reason.message : `HTTP ${primeira.value.status}`
    );
  }
  return resultados;
}

module.exports = { chave: "napista", nome: "Na Pista", buscar };

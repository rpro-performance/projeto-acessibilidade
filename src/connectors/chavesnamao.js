// Conector Chaves na Mão (www.chavesnamao.com.br).
// A listagem é renderizada com React Server Components; cada card aparece no payload
// "flight" como {"dataBySegment":{...}}. Paginação por ?pg=N, 15 anúncios por página.

const { fetchTexto, extrairFlight, lerObjetoJson, slug } = require("../http");
const { anuncio } = require("../normalize");

const BASE = "https://www.chavesnamao.com.br";
const PAGINAS = 2;

// Os anúncios aparecem no payload de duas formas: inline ({"dataBySegment":{...}})
// ou numa lista compartilhada ("items":[{...},{...}]) referenciada pelos cards. Lemos as duas.
function extrairCards(html) {
  const flight = extrairFlight(html);
  const vistos = new Set();
  const cards = [];
  const adicionar = (obj) => {
    if (!obj || !obj.id || obj.segment !== "VEHICLE" || vistos.has(obj.id)) return;
    vistos.add(obj.id);
    cards.push({ obj, flight });
  };

  for (const marcador of ['"dataBySegment":', '"items":']) {
    let pos = flight.indexOf(marcador);
    while (pos !== -1) {
      const ini = pos + marcador.length;
      const c = flight[ini];
      if (c === "{") adicionar(lerObjetoJson(flight, ini));
      else if (c === "[") {
        const lista = lerObjetoJson(flight, ini);
        if (Array.isArray(lista)) lista.forEach(adicionar);
      }
      pos = flight.indexOf(marcador, ini);
    }
  }
  return cards;
}

function foto(flight, id) {
  const re = new RegExp(`https://www\\.chavesnamao\\.com\\.br/imn/[^"\\s\\\\]*/veiculos/\\d+/${id}/[^"\\s\\\\]*\\.(?:jpg|jpeg|png|webp)`);
  const m = flight.match(re);
  return m ? m[0] : null;
}

function mapear({ obj, flight }) {
  return anuncio({
    id: obj.id,
    fonte: "chavesnamao",
    fonteNome: "Chaves na Mão",
    url: obj.url ? BASE + obj.url : null,
    titulo: obj.title,
    marca: obj.brand?.name,
    modelo: obj.model?.name,
    versao: obj.version?.name,
    ano: obj.year || obj.modelYear,
    anoModelo: obj.modelYear,
    km: obj.mileage,
    preco: obj.prices?.rawPrice ?? obj.prices?.main,
    cambio: obj.transmission?.name,
    combustivel: obj.fuel?.name,
    cor: obj.color?.name,
    cidade: obj.location?.city?.name,
    estado: obj.location?.state?.acronym,
    foto: foto(flight, obj.id),
    descricao: obj.description,
    vendedor: obj.publisher?.name,
  });
}

async function buscar(q) {
  if (!q.marca && !q.modelo) throw new Error("informe marca ou modelo");
  const modeloBase = (q.modelo || "").split(/\s+/)[0];
  const caminho = [slug(q.marca), slug(modeloBase)].filter(Boolean).join("-");
  const paginas = [];
  for (let pg = 1; pg <= PAGINAS; pg++) {
    paginas.push(fetchTexto(`${BASE}/carros/brasil/${caminho}/?pg=${pg}`));
  }
  const respostas = await Promise.allSettled(paginas);
  const resultados = [];
  let algumaOk = false;
  for (const resp of respostas) {
    if (resp.status !== "fulfilled" || resp.value.status >= 400) continue;
    algumaOk = true;
    resultados.push(...extrairCards(resp.value.texto).map(mapear));
  }
  if (!algumaOk) {
    const primeira = respostas[0];
    throw new Error(
      primeira.status === "rejected" ? primeira.reason.message : `HTTP ${primeira.value.status}`
    );
  }
  return resultados;
}

module.exports = { chave: "chavesnamao", nome: "Chaves na Mão", buscar };

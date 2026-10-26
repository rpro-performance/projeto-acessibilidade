// Conector Mercado Livre (API oficial).
// A busca pública (/sites/MLB/search) exige token de aplicação desde 2024.
// Crie um app em https://developers.mercadolivre.com.br e informe o token em MERCADOLIVRE_TOKEN.

const { fetchJson } = require("../http");
const { anuncio } = require("../normalize");

const CATEGORIA_CARROS = "MLB1744";

function atributo(item, id) {
  const a = (item.attributes || []).find((x) => x.id === id);
  return a ? a.value_name : null;
}

function mapear(item) {
  return anuncio({
    id: item.id,
    fonte: "mercadolivre",
    fonteNome: "Mercado Livre",
    url: item.permalink,
    titulo: item.title,
    marca: atributo(item, "BRAND"),
    modelo: atributo(item, "MODEL"),
    versao: atributo(item, "TRIM") || atributo(item, "VERSION"),
    ano: atributo(item, "VEHICLE_YEAR"),
    km: atributo(item, "KILOMETERS"),
    preco: item.price,
    cambio: atributo(item, "TRANSMISSION"),
    combustivel: atributo(item, "FUEL_TYPE"),
    cor: atributo(item, "COLOR"),
    cidade: item.location?.city?.name,
    estado: item.location?.state?.id ? String(item.location.state.id).replace("BR-", "") : null,
    foto: item.thumbnail ? item.thumbnail.replace(/-I\.jpg$/, "-O.jpg") : null,
    vendedor: item.seller?.nickname,
    publicadoEm: item.stop_time ? null : null,
  });
}

async function buscar(q) {
  const token = process.env.MERCADOLIVRE_TOKEN;
  if (!token) {
    const err = new Error("defina MERCADOLIVRE_TOKEN para habilitar esta fonte");
    err.configuracao = true;
    throw err;
  }
  const termos = [q.marca, q.modelo].filter(Boolean).join(" ");
  const params = new URLSearchParams({ category: CATEGORIA_CARROS, q: termos, limit: "50" });
  const dados = await fetchJson(`https://api.mercadolibre.com/sites/MLB/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (dados.results || []).map(mapear);
}

module.exports = { chave: "mercadolivre", nome: "Mercado Livre", buscar };

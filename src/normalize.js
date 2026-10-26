// Formato padrão de anúncio do Veículo Mais. Todo conector devolve objetos neste formato.
//
// {
//   id:          identificador único dentro da fonte
//   fonte:       chave da fonte (ex.: "mobiauto")
//   fonteNome:   nome legível da fonte (ex.: "Mobiauto")
//   url:         link para o anúncio original
//   titulo:      "Marca Modelo Versão"
//   marca, modelo, versao
//   ano:         ano de fabricação (número ou null)
//   anoModelo:   ano do modelo (número ou null)
//   km:          quilometragem (número ou null)
//   preco:       preço em reais (número ou null)
//   cambio:      "Automático" | "Manual" | null
//   combustivel: "Flex" | "Gasolina" | "Diesel" | "Híbrido" | "Elétrico" | null
//   cor:         string ou null
//   cidade, estado (sigla)
//   foto:        URL da foto principal ou null
//   descricao:   texto livre ou ""
//   vendedor:    nome do anunciante ou null
//   publicadoEm: ISO date ou null
// }

function numero(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const limpo = String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function capitalizar(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/(^|\s|-)\S/g, (c) => c.toUpperCase());
}

function normalizarCambio(v) {
  const s = String(v || "").toLowerCase();
  if (!s) return null;
  if (/auto|cvt|dsg|tiptronic|automatiz/.test(s)) return "Automático";
  if (/manual/.test(s)) return "Manual";
  return null;
}

function normalizarCombustivel(v) {
  const s = String(v || "").toLowerCase();
  if (!s) return null;
  if (/flex|multi/.test(s)) return "Flex";
  if (/diesel/.test(s)) return "Diesel";
  if (/h[ií]brid/.test(s)) return "Híbrido";
  if (/el[eé]tric/.test(s)) return "Elétrico";
  if (/gasolina/.test(s)) return "Gasolina";
  if (/etanol|[aá]lcool/.test(s)) return "Etanol";
  return capitalizar(s);
}

// Deduz o câmbio a partir do nome da versão quando a fonte não informa.
function inferirCambio(texto) {
  const s = String(texto || "").toLowerCase();
  if (/\b(aut\.?|automatico|automático|tiptronic|dsg|cvt|at|dct|powershift|multitronic|s-tronic)\b/.test(s)) return "Automático";
  if (/\b(mec\.?|mecanico|mecânico|manual|mt)\b/.test(s)) return "Manual";
  return null;
}

function limparTexto(v) {
  const s = String(v || "").trim();
  // referências internas de frameworks (ex.: "$a4") não são texto útil
  return /^\$[A-Za-z0-9:]*$/.test(s) ? "" : s;
}

function anuncio(parcial) {
  const marca = capitalizar(parcial.marca);
  const modelo = capitalizar(parcial.modelo);
  const versao = limparTexto(parcial.versao);
  return {
    id: String(parcial.id),
    fonte: parcial.fonte,
    fonteNome: parcial.fonteNome,
    url: parcial.url || null,
    titulo: parcial.titulo || [marca, modelo, versao].filter(Boolean).join(" "),
    marca,
    modelo,
    versao,
    ano: numero(parcial.ano),
    anoModelo: numero(parcial.anoModelo) ?? numero(parcial.ano),
    km: numero(parcial.km),
    preco: numero(parcial.preco),
    cambio: normalizarCambio(parcial.cambio) || inferirCambio(`${versao} ${parcial.titulo || ""}`),
    combustivel: normalizarCombustivel(parcial.combustivel),
    cor: parcial.cor ? capitalizar(parcial.cor) : null,
    cidade: parcial.cidade ? capitalizar(parcial.cidade) : null,
    estado: parcial.estado ? String(parcial.estado).toUpperCase().slice(0, 2) : null,
    foto: parcial.foto || null,
    descricao: limparTexto(parcial.descricao),
    vendedor: parcial.vendedor || null,
    publicadoEm: parcial.publicadoEm || null,
  };
}

module.exports = { anuncio, numero, capitalizar, normalizarCambio, normalizarCombustivel, inferirCambio };

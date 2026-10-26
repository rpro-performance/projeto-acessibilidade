// Agrupa anúncios que parecem ser o mesmo carro publicado em mais de um site.
// Critério: mesma marca, modelo, ano-modelo, preço e km (arredondado ao milhar) e mesma cidade quando conhecida.

function chave(a) {
  const km = a.km != null ? Math.round(a.km / 1000) : "?";
  const preco = a.preco != null ? Math.round(a.preco) : "?";
  const cidade = a.cidade ? a.cidade.toLowerCase() : "";
  return [a.marca.toLowerCase(), a.modelo.toLowerCase(), a.anoModelo ?? "?", preco, km, cidade].join("|");
}

function agrupar(anuncios) {
  const grupos = new Map();
  for (const a of anuncios) {
    const k = chave(a);
    const existente = grupos.get(k);
    if (!existente) {
      grupos.set(k, { ...a, fontes: [{ fonte: a.fonte, fonteNome: a.fonteNome, url: a.url }] });
      continue;
    }
    if (!existente.fontes.some((f) => f.fonte === a.fonte && f.url === a.url)) {
      existente.fontes.push({ fonte: a.fonte, fonteNome: a.fonteNome, url: a.url });
    }
    // completa campos vazios com os da outra fonte
    for (const campo of ["foto", "descricao", "cambio", "combustivel", "cor", "vendedor", "versao"]) {
      if (!existente[campo] && a[campo]) existente[campo] = a[campo];
    }
  }
  return [...grupos.values()];
}

module.exports = { agrupar, chave };

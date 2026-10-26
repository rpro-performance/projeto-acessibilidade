// Renderização compartilhada dos cards de anúncio (usada por app.js e dia.js).
window.VM = (function () {
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat("pt-BR");

  function el(tag, attrs = {}, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const f of filhos) if (f != null) e.append(f);
    return e;
  }

  function selo(a) {
    if (!a.fipe) return null;
    const d = a.fipe.diferencaPct;
    const classe = d <= -5 ? "fipe-abaixo" : d >= 5 ? "fipe-acima" : "fipe-igual";
    const rotulo = d < 0 ? `${Math.abs(d)}% abaixo da FIPE` : d > 0 ? `${d}% acima da FIPE` : "na FIPE";
    return el("span", { class: `fipe ${classe}`, text: `${rotulo} (${brl.format(a.fipe.valor)})` });
  }

  function card(a, extras = []) {
    const meta = [
      a.anoModelo ? (a.ano && a.ano !== a.anoModelo ? `${a.ano}/${a.anoModelo}` : String(a.anoModelo)) : null,
      a.km != null ? `${num.format(a.km)} km` : null,
      a.cambio,
      a.combustivel,
      a.cor,
      [a.cidade, a.estado].filter(Boolean).join(", ") || null,
    ].filter(Boolean).join(" · ");

    const fontes = el("p", { class: "source" }, "Encontrado em: ");
    (a.fontes || []).forEach((f, i) => {
      if (i) fontes.append(", ");
      fontes.append(el("a", { href: f.url || "#", target: "_blank", rel: "noopener", text: f.fonteNome }));
    });

    const preco = el("p", { class: "price" }, a.preco != null ? brl.format(a.preco) : "Preço a consultar");
    if (a.precoAnterior && a.preco < a.precoAnterior) {
      preco.append(" ", el("span", { class: "antes", text: `antes ${brl.format(a.precoAnterior)}` }));
    }
    const s = selo(a);
    if (s) preco.append(" ", s);

    const foto = a.foto
      ? el("img", { src: a.foto, alt: `Foto do anúncio: ${a.titulo}`, loading: "lazy" })
      : el("div", { class: "sem-foto", text: "Sem foto" });

    const primeiro = (a.fontes && a.fontes[0]) || { url: a.url };
    return el(
      "article",
      { class: "card" },
      foto,
      el(
        "div",
        { class: "card-body" },
        el("h3", {}, el("a", { href: primeiro.url || "#", target: "_blank", rel: "noopener", text: a.titulo })),
        el("p", { class: "meta", text: meta }),
        preco,
        ...extras,
        a.descricao ? el("p", { class: "desc", text: a.descricao.slice(0, 220) + (a.descricao.length > 220 ? "…" : "") }) : null,
        a.vendedor ? el("p", { class: "meta", text: `Anunciante: ${a.vendedor}` }) : null,
        fontes
      )
    );
  }

  return { el, card, brl, num };
})();

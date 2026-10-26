// Frontend do Veículo Mais: envia o formulário para /api/buscar e renderiza os anúncios.

(function () {
  const form = document.querySelector(".search-form");
  const secao = document.getElementById("resultados");
  const lista = document.getElementById("lista-resultados");
  const status = document.getElementById("status-busca");
  const resumo = document.getElementById("resumo-busca");
  const ordem = document.getElementById("ordem");
  const botao = form.querySelector('button[type="submit"]');

  let ultimaResposta = null;

  const { el, card, brl } = window.VM;

  function fichaProblemas(ficha) {
    if (!ficha) return null;
    const ul = el("ul");
    for (const p of ficha.problemas) {
      ul.append(el("li", {}, el("strong", { text: p.titulo + ": " }), p.detalhe));
    }
    return el(
      "div",
      { class: "issues" },
      el("p", {}, el("strong", { text: `Problemas conhecidos do ${ficha.marca} ${ficha.modelo}` }), " (relatos comuns de proprietários; confirme com laudo cautelar):"),
      ul
    );
  }

  function render(r) {
    lista.replaceChildren();
    resumo.replaceChildren();

    const partes = r.fontes.map((f) => {
      const txt = f.ok ? `${f.nome}: ${f.total}` : `${f.nome}: ${f.configuracao ? "não configurado" : "indisponível"}`;
      return el("li", { class: f.ok ? "fonte-ok" : "fonte-erro", text: txt, title: f.erro || "" });
    });
    resumo.append(
      el("p", { class: "resumo-texto", text: `${r.total} veículos encontrados em ${r.fontes.filter((f) => f.ok).length} sites` +
        (r.duplicadosAgrupados ? ` (${r.duplicadosAgrupados} anúncios repetidos agrupados)` : "") +
        (r.fipe && r.fipe.valor ? ` · FIPE ${r.fipe.modelo} ${r.fipe.ano}: ${r.fipe.valorFormatado}` : "") }),
      el("ul", { class: "fontes-status" }, ...partes)
    );

    const ficha = fichaProblemas(r.problemasConhecidos);
    if (ficha) resumo.append(ficha);

    if (!r.anuncios.length) {
      lista.append(el("p", { class: "empty", text: "Nenhum anúncio encontrado com esses filtros. Tente ampliar o ano ou o preço." }));
      return;
    }
    for (const a of r.anuncios) lista.append(card(a));
  }

  async function buscar() {
    const params = new URLSearchParams(new FormData(form));
    params.set("ordem", ordem.value);
    for (const [k, v] of [...params]) if (v === "") params.delete(k);

    status.textContent = "Buscando em todos os sites…";
    status.hidden = false;
    botao.disabled = true;
    secao.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      const res = await fetch(`/api/buscar?${params}`);
      const r = await res.json();
      if (r.erro) {
        status.textContent = r.erro;
        lista.replaceChildren();
        resumo.replaceChildren();
        return;
      }
      ultimaResposta = r;
      status.hidden = true;
      render(r);
      history.replaceState(null, "", `?${params}`);
    } catch (e) {
      status.textContent = "Não foi possível completar a busca. Verifique se o servidor está rodando (npm start).";
    } finally {
      botao.disabled = false;
    }
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    buscar();
  });

  ordem.addEventListener("change", () => {
    if (ultimaResposta) buscar();
  });

  // Reaproveita a busca da URL (link compartilhado / recarregar a página).
  const inicial = new URLSearchParams(location.search);
  if (inicial.get("marca") || inicial.get("modelo")) {
    for (const [k, v] of inicial) {
      const campo = form.elements[k];
      if (!campo) continue;
      if (campo instanceof RadioNodeList || (campo.length && campo[0] && campo[0].type === "checkbox")) continue;
      campo.value = v;
    }
    const fontes = inicial.getAll("fonte");
    if (fontes.length) {
      for (const cb of form.querySelectorAll('input[name="fonte"]')) cb.checked = fontes.includes(cb.value);
    }
    if (inicial.get("ordem")) ordem.value = inicial.get("ordem");
    buscar();
  }
})();

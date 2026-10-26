// Página "Hoje": lê o banco do coletor via /api/dia e mostra o painel do dia e as listas.
(function () {
  const { el, card, brl } = window.VM;
  const painel = document.getElementById("painel");
  const lista = document.getElementById("lista-dia");
  const tipo = document.getElementById("tipo");
  const busca = document.getElementById("busca");

  function dataBr(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function tile(numero, rotulo, valorTipo) {
    const t = el("button", { class: "tile", type: "button", "data-tipo": valorTipo }, el("strong", { text: String(numero) }), el("span", { text: rotulo }));
    t.addEventListener("click", () => {
      tipo.value = valorTipo;
      carregarLista();
    });
    return t;
  }

  function renderPainel(d) {
    painel.replaceChildren();
    if (!d.configurado) {
      painel.append(
        el("div", { class: "aviso" },
          el("p", {}, el("strong", { text: "O coletor ainda não rodou neste computador." })),
          el("p", { text: "Rode `npm run coletar` na pasta do projeto (ou agende com `npm run agendar:mac`). Depois recarregue esta página." })
        )
      );
      return;
    }
    const c = d.contagens;
    painel.append(
      el("p", { class: "meta", text: `Última coleta: ${dataBr(d.ultimaColeta?.fim)} · ${c.ativos} anúncios ativos` }),
      el("div", { class: "tiles" },
        tile(c.novos, "novos hoje", "novos"),
        tile(c.quedas, "caíram de preço", "quedas"),
        tile(c.abaixoFipe, "abaixo da FIPE", "abaixo-fipe"),
        tile(c.sumiram, "sumiram hoje", "sumiram")
      )
    );
    if (d.ultimaColeta?.resumo) {
      const bloco = el("div", { class: "resumo-ia" });
      for (const linha of d.ultimaColeta.resumo.split("\n")) {
        if (!linha.trim()) continue;
        bloco.append(el("p", { text: linha.replace(/^[-*]\s*/, "• ") }));
      }
      painel.append(el("h2", { text: "Avaliação do dia" }), bloco);
    }
    const status = (d.ultimaColeta?.status || []).filter((s) => !s.ok);
    if (status.length) {
      const ul = el("ul", { class: "fontes-status" });
      for (const s of status) ul.append(el("li", { class: "fonte-erro", text: `${s.busca} · ${s.fonte}: ${s.erro}`, title: s.erro }));
      painel.append(el("p", { class: "meta", text: "Fontes com problema na última coleta:" }), ul);
    }
    busca.replaceChildren(el("option", { value: "", text: "Todas" }));
    for (const b of d.buscas || []) busca.append(el("option", { value: b.busca, text: `${b.busca} (${b.n})` }));
  }

  async function carregarLista() {
    lista.replaceChildren(el("p", { class: "empty", text: "Carregando…" }));
    const p = new URLSearchParams({ tipo: tipo.value });
    if (busca.value) p.set("busca", busca.value);
    const r = await fetch(`/api/dia/anuncios?${p}`).then((x) => x.json());
    lista.replaceChildren();
    if (!r.anuncios || !r.anuncios.length) {
      lista.append(el("p", { class: "empty", text: "Nada nesta lista hoje." }));
      return;
    }
    for (const a of r.anuncios) {
      const extras = [];
      const info = [];
      if (a.primeiraVez) info.push(`visto desde ${a.primeiraVez.split("-").reverse().join("/")}`);
      if (a.inativoEm) info.push(`sumiu em ${a.inativoEm.split("-").reverse().join("/")}`);
      if (a.precoInicial && a.preco && Math.round(a.precoInicial) !== Math.round(a.preco)) info.push(`preço inicial ${brl.format(a.precoInicial)}`);
      if (info.length) extras.push(el("p", { class: "meta", text: info.join(" · ") }));
      lista.append(card(a, extras));
    }
  }

  async function iniciar() {
    try {
      const d = await fetch("/api/dia").then((x) => x.json());
      renderPainel(d);
      if (d.configurado) await carregarLista();
    } catch (e) {
      painel.replaceChildren(el("p", { class: "empty", text: "Não foi possível carregar. O servidor está rodando (npm start)?" }));
    }
  }

  tipo.addEventListener("change", carregarLista);
  busca.addEventListener("change", carregarLista);
  iniciar();
})();

// Tela de Configurações: buscas acompanhadas, sites, horário da coleta, chave da IA e atualização.
(function () {
  const { chamar } = window.VMApp;
  const NOMES = { mobiauto: "Mobiauto", napista: "Na Pista", chavesnamao: "Chaves na Mão", olx: "OLX", webmotors: "Webmotors", mercadolivre: "Mercado Livre (precisa de token)" };
  const lista = document.getElementById("lista-buscas");
  let contador = 0;

  function msg(id, texto, erro = false) {
    const el = document.getElementById(id);
    el.textContent = texto;
    el.classList.toggle("erro", erro);
  }

  function campo(rotulo, nome, valor, tipo = "text", extra = "") {
    const id = `b${contador}-${nome}`;
    const v = valor == null ? "" : String(valor).replace(/"/g, "&quot;");
    return `<label class="field" for="${id}">${rotulo}<input id="${id}" name="${nome}" type="${tipo}" value="${v}" ${extra} /></label>`;
  }

  function linhaBusca(b = {}) {
    contador++;
    const div = document.createElement("div");
    div.className = "busca-card";
    // o nome identifica a busca no histórico; mantém o original ao salvar
    if (b.nome) div.dataset.nome = b.nome;
    div.innerHTML = `
      <div class="busca-grid">
        ${campo("Marca", "marca", b.marca, "text", 'placeholder="Volkswagen"')}
        ${campo("Modelo *", "modelo", b.modelo, "text", 'placeholder="Jetta GLI" required')}
        ${campo("Ano de", "anoDe", b.anoDe, "number", 'min="1950" max="2030"')}
        ${campo("Ano até", "anoAte", b.anoAte, "number", 'min="1950" max="2030"')}
        ${campo("Preço até (R$)", "precoAte", b.precoAte, "number", 'min="0" step="1000"')}
        ${campo("Km até", "kmAte", b.kmAte, "number", 'min="0" step="5000"')}
        ${campo("Cidade ou estado", "local", b.local, "text", 'placeholder="opcional"')}
      </div>
      <button type="button" class="link-remover">Remover este carro</button>`;
    div.querySelector(".link-remover").addEventListener("click", () => div.remove());
    lista.append(div);
  }

  function lerBuscas() {
    return [...lista.querySelectorAll(".busca-card")].map((card) => {
      const b = {};
      for (const input of card.querySelectorAll("input")) b[input.name] = input.value.trim();
      const preenchida = Object.values(b).some(Boolean);
      if (card.dataset.nome) b.nome = card.dataset.nome;
      return preenchida ? b : null;
    }).filter(Boolean);
  }

  async function carregarBuscas() {
    const d = await chamar("GET", "/api/app/buscas");
    lista.replaceChildren();
    (d.buscas || []).forEach(linhaBusca);
    if (!d.buscas || !d.buscas.length) linhaBusca();
    const fontes = document.getElementById("fontes");
    fontes.replaceChildren();
    for (const f of d.fontesDisponiveis) {
      const label = document.createElement("label");
      label.innerHTML = `<input type="checkbox" name="fonte" value="${f}" ${d.fontes.includes(f) ? "checked" : ""} /> ${NOMES[f] || f}`;
      fontes.append(label);
    }
  }

  document.getElementById("add-busca").addEventListener("click", () => {
    linhaBusca();
    lista.lastElementChild.querySelector('input[name="marca"]').focus();
  });

  document.getElementById("form-buscas").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fontes = [...document.querySelectorAll('#fontes input:checked')].map((i) => i.value);
    try {
      const r = await chamar("PUT", "/api/app/buscas", { buscas: lerBuscas(), fontes });
      msg("msg-buscas", `Salvo: ${r.buscas.length} carros em ${r.fontes.length} sites. Valem a partir da próxima coleta.`);
      await carregarBuscas();
    } catch (e) {
      msg("msg-buscas", e.message, true);
    }
  });

  async function carregarEstado() {
    const e = await chamar("GET", "/api/app/estado");
    document.getElementById("agenda-ativo").checked = e.agenda.ativo;
    document.getElementById("agenda-hora").value = `${String(e.agenda.hora).padStart(2, "0")}:${String(e.agenda.minuto).padStart(2, "0")}`;
    const s = document.getElementById("chave-status");
    if (!e.chave.tem) s.textContent = "Nenhuma chave guardada. Sem ela, o resumo do dia é automático e mais simples.";
    else if (e.chave.tipo === "api") s.textContent = `Chave guardada (${e.chave.inicio}…). Use "Testar chave atual" para confirmar que ela funciona.`;
    else s.textContent = `A chave guardada (${e.chave.inicio}…) não é uma chave de API. Crie uma em console.anthropic.com > API Keys e cole abaixo.`;
    document.getElementById("versao").textContent = `Versão: ${e.versao || "desconhecida"}`;
  }

  document.getElementById("form-agenda").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const [hora, minuto] = document.getElementById("agenda-hora").value.split(":").map(Number);
    try {
      const a = await chamar("PUT", "/api/app/agenda", { ativo: document.getElementById("agenda-ativo").checked, hora, minuto });
      msg("msg-agenda", a.ativo ? "Horário salvo." : "Coleta automática desligada.");
    } catch (e) {
      msg("msg-agenda", e.message, true);
    }
  });

  document.getElementById("form-chave").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const input = document.getElementById("chave");
    msg("msg-chave", "Testando…");
    try {
      const r = await chamar("PUT", "/api/app/chave", { chave: input.value });
      input.value = "";
      msg("msg-chave", r.teste.mensagem, !r.teste.ok);
      carregarEstado();
    } catch (e) {
      msg("msg-chave", e.message, true);
    }
  });

  document.getElementById("testar-chave").addEventListener("click", async () => {
    msg("msg-chave", "Testando…");
    try {
      const r = await chamar("POST", "/api/app/chave/testar");
      msg("msg-chave", r.mensagem, !r.ok);
    } catch (e) {
      msg("msg-chave", e.message, true);
    }
  });

  document.getElementById("atualizar").addEventListener("click", async () => {
    msg("msg-atualizar", "Buscando atualização…");
    try {
      const r = await chamar("POST", "/api/app/atualizar");
      if (!r.atualizado) msg("msg-atualizar", "Você já está na versão mais nova.");
      else if (r.reiniciando) {
        msg("msg-atualizar", "Atualizado. O app está reiniciando, a página recarrega em alguns segundos.");
        setTimeout(() => location.reload(), 6000);
      } else msg("msg-atualizar", "Atualizado. Feche e abra o app para usar a versão nova.");
    } catch (e) {
      msg("msg-atualizar", e.message, true);
    }
  });

  carregarBuscas().catch((e) => msg("msg-buscas", e.message, true));
  carregarEstado().catch(() => {});
})();

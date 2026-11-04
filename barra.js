// Barra do app, presente em todas as páginas: botão "Coletar agora", andamento da coleta,
// aviso quando um site pede verificação e próxima coleta automática.
window.VMApp = (function () {
  const ouvintes = [];
  let estadoAnterior = null;
  let timer = null;

  async function chamar(metodo, url, corpo) {
    const opcoes = { method: metodo, headers: { "X-VeiculoMais": "1" } };
    if (corpo !== undefined) {
      opcoes.headers["Content-Type"] = "application/json";
      opcoes.body = JSON.stringify(corpo);
    }
    const res = await fetch(url, opcoes);
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(dados.erro || `Erro ${res.status}`);
    return dados;
  }

  function hora(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function proximaColeta(agenda) {
    if (!agenda || !agenda.ativo) return "Coleta automática desligada";
    const alvo = new Date();
    alvo.setHours(agenda.hora, agenda.minuto, 0, 0);
    const hh = String(agenda.hora).padStart(2, "0") + ":" + String(agenda.minuto).padStart(2, "0");
    return `Próxima coleta automática: ${alvo > new Date() ? "hoje" : "amanhã"} às ${hh}`;
  }

  function montar() {
    const alvo = document.getElementById("barra-app");
    if (!alvo) return null;
    alvo.innerHTML = `
      <div class="barra-linha">
        <p class="barra-status" role="status" aria-live="polite"><span class="ponto" aria-hidden="true"></span><span id="barra-texto">Carregando…</span></p>
        <button type="button" class="button" id="btn-coletar">Coletar agora</button>
      </div>
      <p class="aviso-verificacao" id="aviso-verificacao" role="alert" hidden>
        Um site pediu verificação de humano. Vá até a janela do Chrome que o Veículo Mais abriu e segure o botão
        "Pressione e segure" até completar. Se ninguém responder em 2 minutos, esse site fica de fora desta coleta.
      </p>
      <details class="log-coleta" id="log-coleta" hidden><summary>Ver andamento da coleta</summary><pre id="log-texto"></pre></details>
      <p class="barra-erro" id="barra-erro" role="alert" hidden></p>`;
    alvo.querySelector("#btn-coletar").addEventListener("click", coletar);
    return alvo;
  }

  function render(e) {
    const texto = document.getElementById("barra-texto");
    const botao = document.getElementById("btn-coletar");
    const aviso = document.getElementById("aviso-verificacao");
    const log = document.getElementById("log-coleta");
    const logTexto = document.getElementById("log-texto");
    const barra = document.getElementById("barra-app");
    const c = e.coleta;

    barra.classList.toggle("rodando", c.rodando);
    botao.disabled = c.rodando;
    botao.textContent = c.rodando ? "Coletando…" : "Coletar agora";
    aviso.hidden = !c.aguardandoVerificacao;

    if (c.rodando) {
      const etapa = [...c.linhas].reverse().find((l) => /^== /.test(l));
      texto.textContent = `Coletando desde ${hora(c.inicio)}${etapa ? " · " + etapa.replace(/^== /, "") : ""}`;
    } else if (c.fim) {
      const ok = c.codigo === 0;
      texto.textContent = `${ok ? "Última coleta concluída" : "A última coleta falhou"} às ${hora(c.fim)} · ${proximaColeta(e.agenda)}`;
    } else {
      texto.textContent = proximaColeta(e.agenda);
    }
    if (c.linhas.length) {
      log.hidden = false;
      logTexto.textContent = c.linhas.slice(-60).join("\n");
      logTexto.scrollTop = logTexto.scrollHeight;
    }
  }

  async function atualizar() {
    clearTimeout(timer);
    let e = null;
    try {
      e = await chamar("GET", "/api/app/estado");
      document.getElementById("barra-erro").hidden = true;
      render(e);
      if (estadoAnterior && estadoAnterior.coleta.rodando && !e.coleta.rodando) {
        for (const fn of ouvintes) fn(e);
      }
      estadoAnterior = e;
    } catch {
      const erro = document.getElementById("barra-erro");
      erro.textContent = "O Veículo Mais não está respondendo. Feche e abra o app de novo.";
      erro.hidden = false;
    }
    timer = setTimeout(atualizar, e && e.coleta.rodando ? 2500 : 30000);
  }

  async function coletar() {
    const erro = document.getElementById("barra-erro");
    try {
      await chamar("POST", "/api/app/coletar");
      erro.hidden = true;
      document.getElementById("log-coleta").open = true;
    } catch (e) {
      erro.textContent = e.message;
      erro.hidden = false;
    }
    atualizar();
  }

  if (montar()) atualizar();

  return {
    chamar,
    aoTerminarColeta: (fn) => ouvintes.push(fn),
    estado: () => estadoAnterior,
  };
})();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

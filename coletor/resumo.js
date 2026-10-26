// Resumo do dia em português. Com credencial da Anthropic configurada (ANTHROPIC_API_KEY ou
// `ant auth login`) e o SDK instalado, o Claude escreve o resumo; sem isso, gera um texto simples.

const brl = (v) => (v == null ? "?" : `R$ ${Math.round(v).toLocaleString("pt-BR")}`);

function resumoSimples(relatorio) {
  const c = relatorio.contagens;
  const linhas = [
    `Coleta de ${relatorio.data}: ${c.ativos} anúncios ativos, ${c.novos} novos hoje, ${c.quedas} caíram de preço, ${c.abaixoFipe} abaixo da FIPE, ${c.sumiram} sumiram (provavelmente vendidos).`,
  ];
  for (const b of relatorio.porBusca) {
    linhas.push(`- ${b.busca}: ${b.total} anúncios (${b.novos} novos), a partir de ${brl(b.precoMin)}, média ${brl(b.precoMedio)}.`);
  }
  if (relatorio.oportunidades.length) {
    linhas.push("Oportunidades do dia:");
    for (const o of relatorio.oportunidades.slice(0, 5)) {
      linhas.push(`- ${o.titulo} ${o.anoModelo || ""} · ${brl(o.preco)} · ${o.cidade || ""}/${o.estado || ""}: ${o.motivos.join(", ")} (${o.fonteNome})`);
    }
  }
  return linhas.join("\n");
}

async function resumoComIA(relatorio) {
  let Anthropic;
  try {
    Anthropic = require("@anthropic-ai/sdk");
  } catch {
    return null;
  }
  const client = new Anthropic();
  const dados = {
    data: relatorio.data,
    contagens: relatorio.contagens,
    porBusca: relatorio.porBusca,
    oportunidades: relatorio.oportunidades.slice(0, 15).map((o) => ({
      titulo: o.titulo, ano: o.anoModelo, km: o.km, preco: o.preco, fipe: o.fipe, cidade: o.cidade, estado: o.estado,
      fonte: o.fonteNome, motivos: o.motivos, url: o.url, descricao: (o.descricao || "").slice(0, 200),
    })),
    sumiram: relatorio.listas.sumiram.slice(0, 10).map((o) => ({ titulo: o.titulo, ano: o.anoModelo, preco: o.preco, diasNoAr: o.primeiraVez && o.inativoEm ? Math.round((new Date(o.inativoEm) - new Date(o.primeiraVez)) / 86400000) : null })),
  };
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "Você é o avaliador diário do Veículo Mais, um app que acompanha anúncios de carros usados. " +
        "Escreva em português do Brasil, direto, para um comprador que quer saber o que mudou hoje e o que vale a pena olhar. " +
        "Use os dados fornecidos, não invente anúncios. Formato: um parágrafo de visão geral, depois uma lista curta das melhores oportunidades " +
        "com preço, cidade, motivo e o que checar (problemas conhecidos do modelo), e uma linha sobre o que sumiu (vendeu rápido indica preço bom). Máximo de 250 palavras.",
      messages: [{ role: "user", content: `Dados da coleta de hoje em JSON:\n${JSON.stringify(dados)}` }],
    });
    if (response.stop_reason === "refusal") return null;
    return response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim() || null;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      console.warn("Resumo por IA desativado: credencial da Anthropic ausente ou inválida.");
    } else {
      console.warn("Resumo por IA falhou:", e.message);
    }
    return null;
  }
}

async function gerarResumo(relatorio) {
  const ia = await resumoComIA(relatorio);
  return { texto: ia || resumoSimples(relatorio), porIA: Boolean(ia) };
}

module.exports = { gerarResumo, resumoSimples };

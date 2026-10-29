#!/usr/bin/env node
// Coletor diário do Veículo Mais.
//
//   node coletor/index.js                 roda todas as buscas de coletor/buscas.json
//   node coletor/index.js --invisivel     Chrome sem janela (padrão: janela visível)
//   node coletor/index.js --sem-navegador só as fontes que não precisam de navegador
//   node coletor/index.js --busca "Jetta GLI" --fontes olx,webmotors
//
// Lê os sites como um usuário (Chrome real, ritmo humano), guarda tudo em ~/.veiculomais/veiculomais.db,
// avalia o dia (novos, quedas, abaixo da FIPE, sumidos) e escreve o resumo.

const fs = require("fs");
const path = require("path");
const db = require("../src/db");
const fipe = require("../src/fipe");
const { passaFiltros } = require("../src/search");
const { porChave: fontesServidor } = require("../src/connectors");
const { avaliar } = require("./avaliar");
const { gerarResumo } = require("./resumo");

const fontesNavegador = {
  olx: require("./fontes/olx"),
  webmotors: require("./fontes/webmotors"),
};

function argumentos() {
  const args = process.argv.slice(2);
  const pegar = (nome) => {
    const i = args.indexOf(nome);
    return i >= 0 ? args[i + 1] : null;
  };
  return {
    invisivel: args.includes("--invisivel"),
    semNavegador: args.includes("--sem-navegador"),
    busca: pegar("--busca"),
    fontes: pegar("--fontes") ? pegar("--fontes").split(",").map((s) => s.trim()) : null,
    config: pegar("--config") || path.join(__dirname, "buscas.json"),
  };
}

function filtrosDe(busca, fontes) {
  return {
    marca: busca.marca || "",
    modelo: busca.modelo || "",
    anoDe: busca.anoDe || null,
    anoAte: busca.anoAte || null,
    precoDe: busca.precoDe || null,
    precoAte: busca.precoAte || null,
    kmAte: busca.kmAte || null,
    cambio: (busca.cambio || "").toLowerCase(),
    combustivel: (busca.combustivel || "").toLowerCase(),
    local: (busca.local || "").toLowerCase(),
    ordem: "relevancia",
    fontes,
  };
}

function tokens(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9.]+/).filter(Boolean);
}

async function main() {
  const opts = argumentos();
  const config = JSON.parse(fs.readFileSync(opts.config, "utf8"));
  const data = db.hoje();
  const banco = db.abrir();
  const coletaId = db.iniciarColeta(banco, data);
  const inicio = Date.now();

  let buscas = config.buscas || [];
  if (opts.busca) buscas = buscas.filter((b) => (b.nome || b.modelo).toLowerCase() === opts.busca.toLowerCase());
  if (!buscas.length) throw new Error("nenhuma busca para rodar; confira coletor/buscas.json");

  let fontes = opts.fontes || config.fontes || [...Object.keys(fontesServidor), ...Object.keys(fontesNavegador)];
  if (opts.semNavegador) fontes = fontes.filter((f) => !fontesNavegador[f]);
  const precisaNavegador = fontes.some((f) => fontesNavegador[f]);

  let contexto = null;
  if (precisaNavegador) {
    const { abrirNavegador } = require("./navegador");
    try {
      contexto = await abrirNavegador({ visivel: !opts.invisivel });
    } catch (e) {
      console.warn(`Navegador indisponível (${e.message}); OLX e Webmotors ficam de fora desta coleta.`);
    }
  }

  const status = [];
  const ritmo = config.ritmoMs || { min: 2500, max: 6000 };
  const paginas = config.paginasPorFonte || 2;

  for (const busca of buscas) {
    const nome = busca.nome || [busca.marca, busca.modelo].filter(Boolean).join(" ");
    const f = filtrosDe(busca, fontes);
    console.log(`\n== ${nome}`);

    for (const chave of fontes) {
      const t0 = Date.now();
      const fonte = fontesServidor[chave] || fontesNavegador[chave];
      if (!fonte) {
        status.push({ busca: nome, fonte: chave, ok: false, erro: "fonte desconhecida" });
        continue;
      }
      if (fonte.navegador && !contexto) {
        status.push({ busca: nome, fonte: chave, ok: false, erro: "navegador indisponível" });
        continue;
      }
      try {
        const lista = fonte.navegador
          ? await fonte.buscar(contexto, f, { paginas, ritmo, visivel: !opts.invisivel })
          : await fonte.buscar(f);
        const filtrados = lista.filter((a) => passaFiltros(a, f));
        let novos = 0;
        let quedas = 0;
        for (const a of filtrados) {
          const r = db.upsertAnuncio(banco, a, nome, data);
          if (r.novo) novos++;
          else if (r.precoAnterior && a.preco < r.precoAnterior) quedas++;
        }
        const sumidos = db.marcarSumidos(banco, chave, nome, data);
        status.push({ busca: nome, fonte: chave, ok: true, lidos: lista.length, aceitos: filtrados.length, novos, quedas, sumidos, ms: Date.now() - t0 });
        console.log(`  ${fonte.nome}: ${lista.length} lidos, ${filtrados.length} aceitos, ${novos} novos, ${quedas} quedas, ${sumidos} sumiram`);
      } catch (e) {
        status.push({ busca: nome, fonte: chave, ok: false, erro: e.message, ms: Date.now() - t0 });
        console.log(`  ${fonte.nome}: FALHOU (${e.message})`);
      }
    }

    // Preço FIPE de referência da busca, aplicado a cada anúncio ativo dela.
    try {
      const ativos = db.listar(banco, { tipo: "todos", data, busca: nome, limite: 2000 });
      if (ativos.length) {
        const contagem = new Map();
        for (const a of ativos) if (a.versao) contagem.set(a.versao, (contagem.get(a.versao) || 0) + 1);
        const versao = [...contagem.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || "";
        const anos = new Map();
        for (const a of ativos) if (a.anoModelo) anos.set(a.anoModelo, (anos.get(a.anoModelo) || 0) + 1);
        const marca = f.marca || ativos[0].marca;
        for (const [ano] of [...anos.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6)) {
          const ref = await fipe.referencia({ marca, modelo: `${f.modelo} ${versao}`.trim(), ano }).catch(() => null);
          if (!ref || !ref.valor) continue;
          for (const a of ativos) {
            if (a.anoModelo !== ano || !a.preco) continue;
            db.atualizarFipe(banco, a.chave, ref.valor, Math.round(((a.preco - ref.valor) / ref.valor) * 100));
          }
        }
        console.log(`  FIPE aplicada (${versao || f.modelo})`);
      }
    } catch (e) {
      console.log(`  FIPE indisponível: ${e.message}`);
    }
  }

  if (contexto) await contexto.close().catch(() => {});

  const relatorio = avaliar(banco, data);
  const resumo = await gerarResumo(relatorio);
  db.concluirColeta(banco, coletaId, status, relatorio, resumo.texto);

  console.log(`\n${resumo.texto}`);
  console.log(`\nColeta concluída em ${Math.round((Date.now() - inicio) / 1000)} s. Banco: ${db.ARQUIVO}`);
  console.log(`Resumo ${resumo.porIA ? "escrito pelo Claude" : "automático (configure ANTHROPIC_API_KEY para o resumo por IA)"}.`);
  banco.close();
}

main().catch((e) => {
  console.error("Coleta falhou:", e.message);
  process.exit(1);
});

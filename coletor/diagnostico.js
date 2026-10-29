#!/usr/bin/env node
// Resume os arquivos salvos em ~/.veiculomais/debug (última página de cada site) num texto curto,
// para colar numa conversa e ajustar os conectores sem enviar o HTML inteiro.
//   node coletor/diagnostico.js

const fs = require("fs");
const path = require("path");
const { DEBUG } = require("./navegador");

function texto(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resumoNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return "  __NEXT_DATA__: ausente";
  try {
    const d = JSON.parse(m[1]);
    const pp = d?.props?.pageProps || {};
    const linhas = [`  __NEXT_DATA__: presente, pageProps: ${Object.keys(pp).slice(0, 25).join(", ")}`];
    const visitar = (o, caminho, prof) => {
      if (prof > 4 || !o || typeof o !== "object") return;
      for (const [k, v] of Object.entries(o)) {
        if (Array.isArray(v) && v.length >= 5 && v[0] && typeof v[0] === "object") {
          linhas.push(`  lista ${caminho}.${k} [${v.length}] chaves: ${Object.keys(v[0]).slice(0, 20).join(", ")}`);
        } else if (v && typeof v === "object" && !Array.isArray(v)) visitar(v, `${caminho}.${k}`, prof + 1);
      }
    };
    visitar(pp, "pageProps", 0);
    return linhas.join("\n");
  } catch (e) {
    return `  __NEXT_DATA__: presente mas inválido (${e.message})`;
  }
}

function resumoLdJson(html) {
  const blocos = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const linhas = [];
  for (const b of blocos) {
    try {
      const d = JSON.parse(b);
      const raiz = Array.isArray(d) ? d : d["@graph"] || [d];
      for (const no of raiz) {
        const tipo = String(no["@type"] || "?");
        if (Array.isArray(no.itemListElement)) {
          const primeiro = no.itemListElement[0];
          const item = primeiro && (primeiro.item || primeiro);
          linhas.push(`  ld+json ${tipo} com ${no.itemListElement.length} itens; primeiro: ${JSON.stringify(item).slice(0, 400)}`);
        } else {
          linhas.push(`  ld+json ${tipo}: ${Object.keys(no).slice(0, 12).join(", ")}`);
        }
      }
    } catch {
      linhas.push("  ld+json inválido");
    }
  }
  return linhas.join("\n");
}

function resumoArquivo(arquivo) {
  const html = fs.readFileSync(arquivo, "utf8");
  const titulo = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const t = texto(html);
  const linksOlx = (html.match(/href="[^"]*olx\.com\.br\/[^"]*-\d{7,}[^"]*"/g) || []).length;
  const linksWm = (html.match(/href="[^"]*\/comprar\/[^"]*"/g) || []).length;
  const precos = (t.match(/R\$\s?[\d.]{4,}/g) || []).length;
  const ldjson = (html.match(/application\/ld\+json/g) || []).length;
  const scriptsJson = (html.match(/<script[^>]*type="application\/json"[^>]*id="([^"]+)"/g) || []).map((s) => s.match(/id="([^"]+)"/)[1]);
  const exemplos = [...new Set((html.match(/https?:\/\/[a-z.]*olx\.com\.br\/[^"'\s]*-\d{7,}[^"'\s]*/g) || []).map((u) => u.split("?")[0]))].slice(0, 3);
  const bloqueio = /access to this page has been denied|access denied|just a moment|attention required|pressione e segure|press & hold|confirme que você é um humano|não sou um robô|captcha/i.test(titulo + " " + t.slice(0, 3000));
  return [
    `== ${path.basename(arquivo)} (${Math.round(html.length / 1024)} KB)`,
    `  título: ${titulo.trim().slice(0, 120)}`,
    `  sinais de bloqueio: ${bloqueio ? "SIM" : "não"} · links OLX: ${linksOlx} · links /comprar/: ${linksWm} · preços "R$": ${precos} · ld+json: ${ldjson}`,
    `  scripts json com id: ${scriptsJson.join(", ") || "nenhum"}`,
    resumoNextData(html),
    resumoLdJson(html),
    exemplos.length ? `  links de exemplo:\n    ${exemplos.join("\n    ")}` : null,
    `  texto inicial: ${t.slice(0, 500)}`,
  ].filter(Boolean).join("\n");
}

function main() {
  if (!fs.existsSync(DEBUG)) {
    console.log(`Nenhum debug em ${DEBUG}`);
    return;
  }
  const arquivos = fs.readdirSync(DEBUG).filter((f) => f.endsWith(".html"));
  const ultimoPorPrefixo = new Map();
  for (const f of arquivos) {
    const prefixo = f.replace(/-\d+\.html$/, "");
    const anterior = ultimoPorPrefixo.get(prefixo);
    if (!anterior || f > anterior) ultimoPorPrefixo.set(prefixo, f);
  }
  if (!ultimoPorPrefixo.size) {
    console.log("Nenhum HTML de debug encontrado.");
    return;
  }
  console.log(`Diagnóstico de ${DEBUG} (${arquivos.length} arquivos, mostrando o mais recente de cada tipo)\n`);
  for (const f of ultimoPorPrefixo.values()) console.log(resumoArquivo(path.join(DEBUG, f)) + "\n");
}

main();

// Abre o Chrome de verdade do usuário (perfil próprio do Veículo Mais) com Playwright e navega
// em ritmo humano. É assim que OLX e Webmotors são lidos: como uma pessoa usando o navegador.

const path = require("path");
const fs = require("fs");
const { DIR } = require("../src/db");

const PERFIL = path.join(DIR, "chrome");
const DEBUG = path.join(DIR, "debug");

function pausa(min, max) {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}

async function abrirNavegador({ visivel = true } = {}) {
  let playwright;
  try {
    playwright = require("playwright");
  } catch {
    throw new Error("Playwright não instalado. Rode `npm install` na pasta do projeto.");
  }
  fs.mkdirSync(PERFIL, { recursive: true });
  const opcoes = {
    headless: !visivel,
    viewport: { width: 1280, height: 900 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  };
  try {
    // Chrome instalado na máquina (o mesmo que o usuário usa).
    return await playwright.chromium.launchPersistentContext(PERFIL, { ...opcoes, channel: "chrome" });
  } catch (e) {
    console.warn("Google Chrome não encontrado, usando o Chromium do Playwright:", e.message.split("\n")[0]);
    return await playwright.chromium.launchPersistentContext(PERFIL, opcoes);
  }
}

// Rola a página devagar, como quem está lendo, para carregar conteúdo preguiçoso.
async function rolar(page, passos = 6) {
  for (let i = 0; i < passos; i++) {
    await page.mouse.wheel(0, 600 + Math.random() * 400);
    await pausa(400, 1100);
  }
}

// Sinais de que o site mostrou um desafio anti-robô em vez da listagem.
async function pareceBloqueio(page) {
  const titulo = (await page.title()).toLowerCase();
  const texto = ((await page.textContent("body").catch(() => "")) || "").toLowerCase().slice(0, 5000);
  return /access denied|just a moment|attention required|verifique|verificação|captcha|não é um robô|bloqueado|press & hold|pressione e segure/.test(
    titulo + " " + texto
  );
}

async function salvarDebug(page, nome) {
  fs.mkdirSync(DEBUG, { recursive: true });
  const base = path.join(DEBUG, `${nome}-${Date.now()}`);
  try {
    fs.writeFileSync(`${base}.html`, await page.content());
    await page.screenshot({ path: `${base}.png`, fullPage: false });
  } catch {
    // sem debug não é erro
  }
  return base;
}

module.exports = { abrirNavegador, pausa, rolar, pareceBloqueio, salvarDebug, PERFIL, DEBUG };

// Servidor do Veículo Mais: serve as páginas, a API de busca e as rotas do app (coleta, configurações).
// Uso: node server.js   (porta em PORT, padrão 3000). O app instalado no Mac usa a porta 3737.
// Escuta só em 127.0.0.1: nada fica acessível a outros computadores da rede.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { buscar } = require("./src/search");
const { fontes } = require("./src/connectors");
const fipe = require("./src/fipe");
const db = require("./src/db");
const config = require("./src/config");
const coleta = require("./src/coleta");
const buscasConfig = require("./src/buscas");
config.aplicarAmbiente();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const RAIZ = __dirname;
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};
// Só estes arquivos e pastas do projeto são servidos; o resto (código, testes, .git) não.
const PUBLICOS = new Set(["index.html", "dia.html", "configuracoes.html", "style.css", "app.js", "cards.js", "dia.js", "configuracoes.js", "barra.js", "manifest.webmanifest", "sw.js"]);
const PASTAS_PUBLICAS = new Set(["images"]);

function json(res, status, corpo) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(corpo));
}

function estatico(res, caminhoUrl) {
  const relativo = path.posix.normalize(caminhoUrl === "/" ? "/dia.html" : caminhoUrl).replace(/^\/+/, "");
  const partes = relativo.split("/");
  const permitido =
    !relativo.includes("..") &&
    ((partes.length === 1 && PUBLICOS.has(partes[0])) ||
      (partes.length === 2 && PASTAS_PUBLICAS.has(partes[0]) && !partes[1].startsWith(".")));
  if (!permitido) {
    res.writeHead(404);
    return res.end("não encontrado");
  }
  const alvo = path.join(RAIZ, ...partes);
  fs.readFile(alvo, (err, dados) => {
    if (err) {
      res.writeHead(404);
      return res.end("não encontrado");
    }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(alvo)] || "application/octet-stream" });
    res.end(dados);
  });
}

function lerCorpo(req, limite = 100000) {
  return new Promise((resolve, reject) => {
    let corpo = "";
    req.on("data", (pedaco) => {
      corpo += pedaco;
      if (corpo.length > limite) {
        reject(new Error("corpo grande demais"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(corpo ? JSON.parse(corpo) : {});
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

// Rotas do app mudam coisas no computador: só aceitam pedidos da própria página do app.
// O cabeçalho X-VeiculoMais força o navegador a bloquear pedidos vindos de outros sites.
function hostLocal(req) {
  const host = String(req.headers.host || "").replace(/:\d+$/, "");
  return host === "localhost" || host === "127.0.0.1";
}
function pedidoDoApp(req) {
  if (!hostLocal(req)) return false;
  if (req.method === "GET") return true;
  const origem = req.headers.origin;
  if (origem && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem)) return false;
  return req.headers["x-veiculomais"] === "1";
}

function descreverChave() {
  const chave = process.env.ANTHROPIC_API_KEY || config.ler().anthropicApiKey || "";
  if (!chave) return { tem: false, tipo: "nenhuma", inicio: null };
  return { tem: true, tipo: chave.startsWith("sk-ant-api") ? "api" : "outro", inicio: chave.slice(0, 13) };
}

function git(args) {
  return new Promise((resolve) => {
    execFile("git", args, { cwd: RAIZ, timeout: 60000 }, (erro, stdout, stderr) => {
      resolve({ ok: !erro, saida: String(stdout || "").trim(), erro: String(stderr || (erro && erro.message) || "").trim() });
    });
  });
}

async function testarChave() {
  let Anthropic;
  try {
    Anthropic = require("@anthropic-ai/sdk");
  } catch {
    return { ok: false, mensagem: "SDK da Anthropic não instalado. Rode a instalação do app de novo." };
  }
  const chave = process.env.ANTHROPIC_API_KEY || config.ler().anthropicApiKey;
  if (!chave) return { ok: false, mensagem: "Nenhuma chave guardada." };
  try {
    const client = new Anthropic({ apiKey: chave });
    await client.models.list({ limit: 1 });
    return { ok: true, mensagem: "Chave aceita pela Anthropic. O resumo do dia será escrito pela IA." };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return { ok: false, mensagem: "A Anthropic recusou esta chave. Gere uma nova em console.anthropic.com > API Keys." };
    }
    if (e instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, mensagem: "A chave existe, mas não tem permissão. Confira a conta em console.anthropic.com." };
    }
    if (e instanceof Anthropic.APIConnectionError) {
      return { ok: false, mensagem: "Sem conexão com a Anthropic. Confira a internet e tente de novo." };
    }
    return { ok: false, mensagem: `Não foi possível testar: ${e.message}` };
  }
}

async function apiApp(req, res, url) {
  if (!pedidoDoApp(req)) return json(res, 403, { erro: "pedido recusado" });
  const rota = `${req.method} ${url.pathname}`;

  if (rota === "GET /api/app/estado") {
    const versao = await git(["log", "-1", "--format=%h %cd", "--date=format:%d/%m/%Y %H:%M"]);
    return json(res, 200, {
      coleta: coleta.estado,
      agenda: coleta.agenda(),
      chave: descreverChave(),
      versao: versao.ok ? versao.saida : null,
      reinicioAutomatico: process.env.VEICULOMAIS_LAUNCHD === "1",
    });
  }
  if (rota === "POST /api/app/coletar") {
    const r = coleta.iniciar("manual");
    return json(res, r.ok ? 202 : 409, r.ok ? { ok: true } : { erro: r.motivo });
  }
  if (rota === "GET /api/app/buscas") {
    return json(res, 200, { ...buscasConfig.ler(), fontesDisponiveis: buscasConfig.FONTES });
  }
  if (rota === "PUT /api/app/buscas") {
    try {
      return json(res, 200, buscasConfig.gravar(await lerCorpo(req)));
    } catch (e) {
      return json(res, 400, { erro: e.message });
    }
  }
  if (rota === "PUT /api/app/agenda") {
    try {
      return json(res, 200, coleta.gravarAgenda(await lerCorpo(req)));
    } catch (e) {
      return json(res, 400, { erro: e.message });
    }
  }
  if (rota === "PUT /api/app/chave") {
    try {
      const { chave } = await lerCorpo(req);
      const limpa = String(chave || "").trim().replace(/^["']|["']$/g, "");
      if (!limpa.startsWith("sk-ant-") || /\s/.test(limpa)) {
        return json(res, 400, { erro: "Isso não parece uma chave da Anthropic (começa com sk-ant-)." });
      }
      config.gravar({ anthropicApiKey: limpa });
      process.env.ANTHROPIC_API_KEY = limpa;
      return json(res, 200, { chave: descreverChave(), teste: await testarChave() });
    } catch (e) {
      return json(res, 400, { erro: e.message });
    }
  }
  if (rota === "POST /api/app/chave/testar") {
    return json(res, 200, await testarChave());
  }
  if (rota === "POST /api/app/atualizar") {
    if (coleta.estado.rodando) return json(res, 409, { erro: "Espere a coleta terminar para atualizar." });
    const antes = await git(["rev-parse", "HEAD"]);
    const pull = await git(["pull", "--ff-only"]);
    if (!pull.ok) return json(res, 500, { erro: `Não foi possível atualizar: ${pull.erro}` });
    const depois = await git(["rev-parse", "HEAD"]);
    const mudou = antes.saida !== depois.saida;
    if (mudou) {
      const npm = path.join(path.dirname(process.execPath), "npm");
      await new Promise((resolve) => execFile(npm, ["install", "--no-audit", "--no-fund"], { cwd: RAIZ, timeout: 180000 }, () => resolve()));
    }
    const reinicia = mudou && process.env.VEICULOMAIS_LAUNCHD === "1";
    json(res, 200, { atualizado: mudou, reiniciando: reinicia, saida: pull.saida });
    // sob o launchd, sair faz o Mac reabrir o servidor já com a versão nova
    if (reinicia) setTimeout(() => process.exit(0), 800);
    return;
  }
  json(res, 404, { erro: "rota não encontrada" });
}

async function api(req, res, url) {
  if (url.pathname.startsWith("/api/app/")) return apiApp(req, res, url);
  if (!hostLocal(req)) return json(res, 403, { erro: "pedido recusado" });
  if (url.pathname === "/api/buscar") {
    const r = await buscar(url.searchParams);
    return json(res, r.erro ? 400 : 200, r);
  }
  if (url.pathname === "/api/fontes") {
    return json(res, 200, fontes.map((f) => ({ chave: f.chave, nome: f.nome })));
  }
  if (url.pathname === "/api/dia" || url.pathname === "/api/dia/anuncios") {
    let banco = null;
    try {
      banco = db.abrir({ somenteLeitura: true });
    } catch (e) {
      return json(res, 200, { configurado: false, erro: e.message });
    }
    if (!banco) return json(res, 200, { configurado: false });
    try {
      const data = url.searchParams.get("data") || db.hoje();
      if (url.pathname === "/api/dia") {
        const ultima = db.ultimaColeta(banco);
        return json(res, 200, {
          configurado: true,
          data,
          contagens: db.contagens(banco, ultima ? ultima.data : data),
          buscas: db.buscasSalvas(banco),
          ultimaColeta: ultima,
        });
      }
      const ultima = db.ultimaColeta(banco);
      const anuncios = db.listar(banco, {
        tipo: url.searchParams.get("tipo") || "novos",
        data: ultima ? ultima.data : data,
        busca: url.searchParams.get("busca") || null,
        limite: Number(url.searchParams.get("limite") || 200),
      });
      return json(res, 200, { anuncios });
    } finally {
      banco.close();
    }
  }
  if (url.pathname === "/api/fipe") {
    const r = await fipe.referencia({
      marca: url.searchParams.get("marca"),
      modelo: url.searchParams.get("modelo"),
      ano: url.searchParams.get("ano"),
    });
    return json(res, 200, r || { erro: "não encontrado" });
  }
  if (url.pathname === "/api/fipe/marcas") {
    return json(res, 200, await fipe.marcas());
  }
  json(res, 404, { erro: "rota não encontrada" });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) await api(req, res, url);
    else estatico(res, decodeURIComponent(url.pathname));
  } catch (e) {
    json(res, 500, { erro: e.message });
  }
});

if (require.main === module) {
  servidor.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.error(`A porta ${PORT} já está em uso. O Veículo Mais provavelmente já está aberto: http://localhost:${PORT}`);
      process.exit(1);
    }
    throw e;
  });
  servidor.listen(PORT, HOST, () => {
    console.log(`Veículo Mais rodando em http://localhost:${PORT}`);
    coleta.iniciarAgendador();
  });
}

module.exports = servidor;

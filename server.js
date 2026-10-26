// Servidor do Veículo Mais: serve a página estática e expõe a API de busca.
// Uso: node server.js   (porta em PORT, padrão 3000)

const http = require("http");
const fs = require("fs");
const path = require("path");
const { buscar } = require("./src/search");
const { fontes } = require("./src/connectors");
const fipe = require("./src/fipe");

const PORT = Number(process.env.PORT || 3000);
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
};

function json(res, status, corpo) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(corpo));
}

function estatico(res, caminhoUrl) {
  const alvo = path.normalize(path.join(RAIZ, caminhoUrl === "/" ? "index.html" : caminhoUrl));
  if (!alvo.startsWith(RAIZ + path.sep) || alvo.includes(`${path.sep}src${path.sep}`) || alvo.endsWith("server.js")) {
    res.writeHead(404);
    return res.end("não encontrado");
  }
  fs.readFile(alvo, (err, dados) => {
    if (err) {
      res.writeHead(404);
      return res.end("não encontrado");
    }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(alvo)] || "application/octet-stream" });
    res.end(dados);
  });
}

async function api(req, res, url) {
  if (url.pathname === "/api/buscar") {
    const r = await buscar(url.searchParams);
    return json(res, r.erro ? 400 : 200, r);
  }
  if (url.pathname === "/api/fontes") {
    return json(res, 200, fontes.map((f) => ({ chave: f.chave, nome: f.nome })));
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
  servidor.listen(PORT, () => {
    console.log(`Veículo Mais rodando em http://localhost:${PORT}`);
  });
}

module.exports = servidor;

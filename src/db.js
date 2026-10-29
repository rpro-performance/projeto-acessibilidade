// Banco local (SQLite embutido no Node >= 22.13). Guarda os anúncios coletados dia a dia,
// histórico de preço e o relatório de cada coleta. Usado pelo coletor e pelo servidor.

const path = require("path");
const os = require("os");
const fs = require("fs");

const DIR = process.env.VEICULOMAIS_DIR || path.join(os.homedir(), ".veiculomais");
const ARQUIVO = path.join(DIR, "veiculomais.db");

function hoje() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function abrir({ somenteLeitura = false } = {}) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    throw new Error("Este recurso precisa do Node 22.13 ou mais novo (SQLite embutido).");
  }
  if (somenteLeitura && !fs.existsSync(ARQUIVO)) return null;
  fs.mkdirSync(DIR, { recursive: true });
  const db = new DatabaseSync(ARQUIVO, somenteLeitura ? { readOnly: true } : {});
  if (!somenteLeitura) migrar(db);
  return db;
}

function migrar(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS anuncios (
      chave TEXT PRIMARY KEY,
      fonte TEXT NOT NULL,
      fonte_nome TEXT,
      id TEXT NOT NULL,
      url TEXT,
      titulo TEXT,
      marca TEXT,
      modelo TEXT,
      versao TEXT,
      ano INTEGER,
      ano_modelo INTEGER,
      km INTEGER,
      preco REAL,
      cambio TEXT,
      combustivel TEXT,
      cor TEXT,
      cidade TEXT,
      estado TEXT,
      foto TEXT,
      descricao TEXT,
      vendedor TEXT,
      busca TEXT,
      primeira_vez TEXT NOT NULL,
      ultima_vez TEXT NOT NULL,
      preco_inicial REAL,
      preco_anterior REAL,
      preco_alterado_em TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      inativo_em TEXT,
      fipe REAL,
      fipe_pct REAL
    );
    CREATE INDEX IF NOT EXISTS idx_anuncios_busca ON anuncios(busca);
    CREATE INDEX IF NOT EXISTS idx_anuncios_primeira ON anuncios(primeira_vez);
    CREATE TABLE IF NOT EXISTS precos (
      chave TEXT NOT NULL,
      data TEXT NOT NULL,
      preco REAL,
      PRIMARY KEY (chave, data)
    );
    CREATE TABLE IF NOT EXISTS coletas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      inicio TEXT NOT NULL,
      fim TEXT,
      status_json TEXT,
      relatorio_json TEXT,
      resumo TEXT
    );
  `);
}

// Insere ou atualiza um anúncio normalizado. Devolve { novo, precoAnterior }.
function upsertAnuncio(db, a, busca, data) {
  const chave = `${a.fonte}:${a.id}`;
  const existente = db.prepare("SELECT preco, preco_anterior, ativo FROM anuncios WHERE chave = ?").get(chave);
  if (!existente) {
    db.prepare(`
      INSERT INTO anuncios (chave, fonte, fonte_nome, id, url, titulo, marca, modelo, versao, ano, ano_modelo, km, preco,
        cambio, combustivel, cor, cidade, estado, foto, descricao, vendedor, busca, primeira_vez, ultima_vez, preco_inicial, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      chave, a.fonte, a.fonteNome, a.id, a.url, a.titulo, a.marca, a.modelo, a.versao, a.ano, a.anoModelo, a.km, a.preco,
      a.cambio, a.combustivel, a.cor, a.cidade, a.estado, a.foto, a.descricao, a.vendedor, busca, data, data, a.preco
    );
    db.prepare("INSERT OR REPLACE INTO precos (chave, data, preco) VALUES (?, ?, ?)").run(chave, data, a.preco);
    return { novo: true, precoAnterior: null };
  }

  const mudouPreco = a.preco != null && existente.preco != null && Math.round(a.preco) !== Math.round(existente.preco);
  db.prepare(`
    UPDATE anuncios SET url = ?, titulo = ?, versao = COALESCE(?, versao), km = COALESCE(?, km), preco = COALESCE(?, preco),
      cambio = COALESCE(?, cambio), combustivel = COALESCE(?, combustivel), cor = COALESCE(?, cor), foto = COALESCE(?, foto),
      descricao = CASE WHEN ? != '' THEN ? ELSE descricao END, vendedor = COALESCE(?, vendedor), busca = ?,
      ultima_vez = ?, ativo = 1, inativo_em = NULL,
      preco_anterior = CASE WHEN ? THEN preco ELSE preco_anterior END,
      preco_alterado_em = CASE WHEN ? THEN ? ELSE preco_alterado_em END
    WHERE chave = ?
  `).run(
    a.url, a.titulo, a.versao || null, a.km, a.preco, a.cambio, a.combustivel, a.cor, a.foto,
    a.descricao || "", a.descricao || "", a.vendedor, busca, data,
    mudouPreco ? 1 : 0, mudouPreco ? 1 : 0, data, chave
  );
  if (mudouPreco) {
    db.prepare("INSERT OR REPLACE INTO precos (chave, data, preco) VALUES (?, ?, ?)").run(chave, data, a.preco);
  }
  return { novo: false, precoAnterior: mudouPreco ? existente.preco : null };
}

// Marca como inativos os anúncios de uma (fonte, busca) que não apareceram na coleta de hoje.
function marcarSumidos(db, fonte, busca, data) {
  return db.prepare(`
    UPDATE anuncios SET ativo = 0, inativo_em = ?
    WHERE fonte = ? AND busca = ? AND ativo = 1 AND ultima_vez < ?
  `).run(data, fonte, busca, data).changes;
}

function atualizarFipe(db, chave, fipe, pct) {
  db.prepare("UPDATE anuncios SET fipe = ?, fipe_pct = ? WHERE chave = ?").run(fipe, pct, chave);
}

function iniciarColeta(db, data) {
  return db.prepare("INSERT INTO coletas (data, inicio) VALUES (?, ?)").run(data, new Date().toISOString()).lastInsertRowid;
}

function concluirColeta(db, id, status, relatorio, resumo) {
  db.prepare("UPDATE coletas SET fim = ?, status_json = ?, relatorio_json = ?, resumo = ? WHERE id = ?")
    .run(new Date().toISOString(), JSON.stringify(status), JSON.stringify(relatorio), resumo || null, id);
}

function ultimaColeta(db) {
  const c = db.prepare("SELECT * FROM coletas WHERE fim IS NOT NULL ORDER BY id DESC LIMIT 1").get();
  if (!c) return null;
  return {
    id: c.id,
    data: c.data,
    inicio: c.inicio,
    fim: c.fim,
    status: JSON.parse(c.status_json || "[]"),
    relatorio: JSON.parse(c.relatorio_json || "{}"),
    resumo: c.resumo,
  };
}

// Converte uma linha do banco para o formato de anúncio usado pela página.
function linhaParaAnuncio(l) {
  return {
    id: l.id,
    chave: l.chave,
    fonte: l.fonte,
    fonteNome: l.fonte_nome,
    url: l.url,
    titulo: l.titulo,
    marca: l.marca,
    modelo: l.modelo,
    versao: l.versao,
    ano: l.ano,
    anoModelo: l.ano_modelo,
    km: l.km,
    preco: l.preco,
    cambio: l.cambio,
    combustivel: l.combustivel,
    cor: l.cor,
    cidade: l.cidade,
    estado: l.estado,
    foto: l.foto,
    descricao: l.descricao,
    vendedor: l.vendedor,
    busca: l.busca,
    primeiraVez: l.primeira_vez,
    ultimaVez: l.ultima_vez,
    precoInicial: l.preco_inicial,
    precoAnterior: l.preco_anterior,
    precoAlteradoEm: l.preco_alterado_em,
    ativo: Boolean(l.ativo),
    inativoEm: l.inativo_em,
    fipe: l.fipe && l.preco ? { valor: l.fipe, diferencaPct: l.fipe_pct } : null,
    fontes: [{ fonte: l.fonte, fonteNome: l.fonte_nome, url: l.url }],
  };
}

const CONSULTAS = {
  novos: (data) => ["primeira_vez = ? AND ativo = 1", [data]],
  quedas: (data) => ["preco_alterado_em = ? AND preco_anterior IS NOT NULL AND preco < preco_anterior AND ativo = 1", [data]],
  // abaixo de -60% quase sempre é erro de digitação ou parcela, não preço do carro
  "abaixo-fipe": () => ["fipe_pct IS NOT NULL AND fipe_pct <= -5 AND fipe_pct > -60 AND ativo = 1", []],
  sumiram: (data) => ["ativo = 0 AND inativo_em = ?", [data]],
  todos: () => ["ativo = 1", []],
};

function listar(db, { tipo = "todos", data, busca, limite = 200 }) {
  const gerador = CONSULTAS[tipo] || CONSULTAS.todos;
  const [where, params] = gerador(data || hoje());
  const extra = busca ? " AND busca = ?" : "";
  const linhas = db
    .prepare(`SELECT * FROM anuncios WHERE ${where}${extra} ORDER BY COALESCE(fipe_pct, 0) ASC, preco ASC LIMIT ?`)
    .all(...params, ...(busca ? [busca] : []), limite);
  return linhas.map(linhaParaAnuncio);
}

function contagens(db, data) {
  const c = (where, params = []) => db.prepare(`SELECT COUNT(*) n FROM anuncios WHERE ${where}`).get(...params).n;
  return {
    ativos: c("ativo = 1"),
    novos: c("primeira_vez = ? AND ativo = 1", [data]),
    quedas: c("preco_alterado_em = ? AND preco_anterior IS NOT NULL AND preco < preco_anterior AND ativo = 1", [data]),
    abaixoFipe: c("fipe_pct IS NOT NULL AND fipe_pct <= -5 AND fipe_pct > -60 AND ativo = 1"),
    sumiram: c("ativo = 0 AND inativo_em = ?", [data]),
  };
}

function buscasSalvas(db) {
  return db.prepare("SELECT busca, COUNT(*) n FROM anuncios WHERE ativo = 1 GROUP BY busca ORDER BY busca").all();
}

function historicoPreco(db, chave) {
  return db.prepare("SELECT data, preco FROM precos WHERE chave = ? ORDER BY data").all(chave);
}

module.exports = {
  DIR, ARQUIVO, hoje, abrir, upsertAnuncio, marcarSumidos, atualizarFipe, iniciarColeta, concluirColeta,
  ultimaColeta, listar, contagens, buscasSalvas, historicoPreco, linhaParaAnuncio,
};

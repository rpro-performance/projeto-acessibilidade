// Utilitários de rede compartilhados pelos conectores.
// Usa apenas o fetch nativo do Node (>= 18), sem dependências.

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const TIMEOUT_MS = Number(process.env.FONTE_TIMEOUT_MS || 20000);

async function fetchTexto(url, opcoes = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opcoes.timeout || TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "pt-BR,pt;q=0.9",
        Accept: opcoes.json
          ? "application/json"
          : "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        ...(opcoes.headers || {}),
      },
    });
    const texto = await res.text();
    return { status: res.status, texto, url: res.url };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, opcoes = {}) {
  const r = await fetchTexto(url, { ...opcoes, json: true });
  if (r.status >= 400) {
    const err = new Error(`HTTP ${r.status} em ${url}`);
    err.status = r.status;
    err.corpo = r.texto.slice(0, 300);
    throw err;
  }
  return JSON.parse(r.texto);
}

// Extrai o JSON embutido por aplicações Next.js em <script id="__NEXT_DATA__">.
function extrairNextData(html) {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// Junta os pedaços do payload "flight" do React Server Components
// (self.__next_f.push([1,"..."])) numa única string já sem escapes.
function extrairFlight(html) {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let out = "";
  let m;
  while ((m = re.exec(html))) {
    try {
      out += JSON.parse('"' + m[1] + '"');
    } catch {
      // pedaço corrompido: ignora
    }
  }
  return out;
}

// Dado um texto e a posição de um "{" ou "[", devolve o valor JSON balanceado a partir dali.
function lerObjetoJson(texto, inicio) {
  let profundidade = 0;
  let emString = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (emString) {
      if (c === "\\") i++;
      else if (c === '"') emString = false;
      continue;
    }
    if (c === '"') emString = true;
    else if (c === "{" || c === "[") profundidade++;
    else if (c === "}" || c === "]") {
      profundidade--;
      if (profundidade === 0) {
        try {
          return JSON.parse(texto.slice(inicio, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function slug(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = { fetchTexto, fetchJson, extrairNextData, extrairFlight, lerObjetoJson, slug, USER_AGENT };

// Avaliação automática da coleta do dia: novos, quedas de preço, abaixo da FIPE, sumidos,
// e uma pontuação de "oportunidade" para ordenar o que merece atenção primeiro.

const db = require("../src/db");
const problemas = require("../src/problemas");

// Preço muito abaixo da FIPE (ou irrisório) é quase sempre erro, parcela ou golpe.
function precoSuspeito(a) {
  if (a.preco != null && a.preco < 5000) return true;
  return Boolean(a.fipe && a.fipe.diferencaPct != null && a.fipe.diferencaPct <= -60);
}

function pontuar(a) {
  if (precoSuspeito(a)) return -100;
  let pontos = 0;
  if (a.fipe && a.fipe.diferencaPct != null) pontos += Math.max(-30, -a.fipe.diferencaPct) * 2; // 10% abaixo = +20
  if (a.km != null) pontos += a.km < 30000 ? 10 : a.km < 60000 ? 5 : a.km > 150000 ? -10 : 0;
  if (a.precoAnterior && a.preco < a.precoAnterior) pontos += Math.min(20, ((a.precoAnterior - a.preco) / a.precoAnterior) * 100);
  if (a.primeiraVez === db.hoje()) pontos += 5;
  return Math.round(pontos);
}

function motivos(a) {
  const m = [];
  if (precoSuspeito(a)) return ["preço suspeito, confira o anúncio"];
  if (a.fipe && a.fipe.diferencaPct <= -5) m.push(`${Math.abs(a.fipe.diferencaPct)}% abaixo da FIPE`);
  if (a.precoAnterior && a.preco < a.precoAnterior) {
    m.push(`caiu de R$ ${Math.round(a.precoAnterior).toLocaleString("pt-BR")} para R$ ${Math.round(a.preco).toLocaleString("pt-BR")}`);
  }
  if (a.km != null && a.km < 30000) m.push("baixa quilometragem");
  if (a.primeiraVez === db.hoje()) m.push("apareceu hoje");
  return m;
}

function avaliar(banco, data) {
  const contagens = db.contagens(banco, data);
  const listas = {};
  for (const tipo of ["novos", "quedas", "abaixo-fipe", "sumiram"]) {
    listas[tipo] = db.listar(banco, { tipo, data, limite: 100 });
  }
  const ativos = db.listar(banco, { tipo: "todos", data, limite: 2000 });
  const oportunidades = ativos
    .map((a) => ({ ...a, pontos: pontuar(a), motivos: motivos(a) }))
    .filter((a) => a.pontos > 0)
    .sort((x, y) => y.pontos - x.pontos)
    .slice(0, 20);

  const porBusca = {};
  for (const a of ativos) {
    const b = porBusca[a.busca] || (porBusca[a.busca] = { busca: a.busca, total: 0, novos: 0, precoMin: null, precoMedio: 0, soma: 0, comPreco: 0 });
    b.total++;
    if (a.primeiraVez === data) b.novos++;
    if (a.preco) {
      b.soma += a.preco;
      b.comPreco++;
      b.precoMin = b.precoMin == null ? a.preco : Math.min(b.precoMin, a.preco);
    }
  }
  for (const b of Object.values(porBusca)) {
    b.precoMedio = b.comPreco ? Math.round(b.soma / b.comPreco) : null;
    delete b.soma;
    delete b.comPreco;
    const exemplo = ativos.find((a) => a.busca === b.busca);
    const ficha = exemplo ? problemas.paraModelo(exemplo.marca, exemplo.modelo, null) : null;
    b.problemasConhecidos = ficha ? ficha.problemas.map((p) => p.titulo) : [];
  }

  return { data, contagens, oportunidades, porBusca: Object.values(porBusca), listas };
}

module.exports = { avaliar, pontuar, motivos, precoSuspeito };

// Registro de fontes. Para adicionar um site, crie um arquivo neste diretório exportando
// { chave, nome, buscar(filtros) } e inclua-o na lista abaixo.

const fontes = [
  require("./mobiauto"),
  require("./napista"),
  require("./chavesnamao"),
  require("./mercadolivre"),
];

module.exports = { fontes, porChave: Object.fromEntries(fontes.map((f) => [f.chave, f])) };

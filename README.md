# Veículo Mais

Buscador unificado de veículos usados e seminovos. Você digita o carro que procura **uma vez** e o Veículo Mais consulta todos os sites de anúncios do mercado, junta os resultados e mostra tudo em um só lugar.

## O problema

Hoje quem quer comprar um carro repete a mesma busca em vários sites: OLX, Webmotors, iCarros, Mobiauto, Mercado Livre, Facebook Marketplace, sites de concessionárias... Cada um tem anúncios que não aparecem nos outros. Um Jetta GLI anunciado na OLX pode não estar na Webmotors, e vice-versa. O comprador perde tempo abrindo site por site, com filtros diferentes em cada um, e ainda assim pode deixar passar o melhor negócio.

## A solução

O Veículo Mais funciona como um agregador:

1. O usuário informa marca, modelo, ano, faixa de preço, câmbio, combustível, cidade/estado e outros filtros.
2. O app faz a busca em todas as fontes cadastradas ao mesmo tempo.
3. Os anúncios são normalizados (mesmo formato de preço, ano, km, etc.), duplicados são agrupados e o resultado é exibido em uma lista única.
4. Cada anúncio mostra foto, modelo, ano, quilometragem, preço, cidade, descrição, site de origem e link para o anúncio original.

## Funcionalidades previstas

- **Busca única** com filtros: marca, modelo, versão, ano (de/até), preço (de/até), km, câmbio, combustível, cor, localização.
- **Fontes múltiplas**: OLX, Webmotors, iCarros, Mobiauto, Mercado Livre, Facebook Marketplace, Chaves na Mão, Só Carrão, Autoline, Seminovos BH, Na Pista, sites de concessionárias e lojas.
- **Cards de resultado** com foto, ano, km, preço, cidade, descrição resumida e selo do site de origem.
- **Detecção de duplicados**: o mesmo carro anunciado em dois sites aparece uma vez só, com os links de cada fonte.
- **Ficha de problemas conhecidos**: para cada modelo/ano, um resumo dos defeitos comuns relatados (recalls, reclamações, fóruns) para o comprador saber o que checar.
- **Comparação de preço**: preço do anúncio vs. tabela FIPE e vs. a média dos anúncios encontrados.
- **Ordenação** por preço, ano, km, distância e data do anúncio.
- **Alertas**: salvar uma busca e receber aviso quando aparecer um carro novo nos critérios.
- **Favoritos** para guardar anúncios e comparar depois.
- **Acessibilidade**: navegação por teclado, leitores de tela, contraste adequado e textos alternativos em todas as imagens.

## Arquitetura pensada

```
[ App web / mobile ]  -->  [ API Veículo Mais ]  -->  [ Conectores por fonte ]
                                 |                        OLX, Webmotors, iCarros...
                                 v
                         [ Normalização + dedup + cache ]
                                 |
                                 v
                         [ Banco de anúncios + histórico de preços ]
```

- **Conectores**: um módulo por site, responsável por traduzir os filtros do usuário para a busca daquele site e devolver os anúncios no formato padrão do Veículo Mais. Onde houver API oficial ou feed de parceiro, ele é usado; onde não houver, a coleta precisa respeitar os termos de uso de cada site.
- **Normalizador**: padroniza marca/modelo/versão, preço, ano, km e localização.
- **Dedup**: agrupa anúncios do mesmo veículo (mesma placa final, mesmas fotos, mesmo km/preço/cidade).
- **Cache e histórico**: evita bater nos sites a cada busca e permite mostrar variação de preço ao longo do tempo.

## Como rodar

Precisa apenas do Node.js 18 ou mais novo. Não há dependências para instalar.

```bash
npm start
# abre http://localhost:3000
```

Testes (não acessam a internet):

```bash
npm test
```

A API também pode ser usada direto:

```
GET /api/buscar?marca=Volkswagen&modelo=Jetta%20GLI&anoDe=2019&precoAte=200000&ordem=preco-asc
GET /api/fipe?marca=Honda&modelo=Civic%20EXL&ano=2020
GET /api/fontes
```

Filtros aceitos em `/api/buscar`: `marca`, `modelo`, `anoDe`, `anoAte`, `precoDe`, `precoAte`, `kmAte`, `cambio`, `combustivel`, `local`, `fonte` (repetível), `ordem` (`relevancia`, `preco-asc`, `preco-desc`, `ano-desc`, `km-asc`).

## Estado atual

Já funciona de ponta a ponta: a página chama a API, que consulta as fontes em paralelo, normaliza, filtra, agrupa duplicados, compara com a FIPE e anexa a ficha de problemas conhecidos.

| Fonte | Situação | Como é lida |
| --- | --- | --- |
| Mobiauto | funcionando | JSON embutido na página de listagem (precisa de marca + modelo; a marca é deduzida automaticamente quando só o modelo é informado) |
| Na Pista | funcionando | JSON embutido, busca por texto livre, 2 páginas (96 anúncios) |
| Chaves na Mão | funcionando | payload React Server Components, 2 páginas (30 anúncios) |
| Tabela FIPE | funcionando | API pública (parallelum.com.br), com cache de 12 h |
| Mercado Livre | precisa de token | API oficial; crie um app em developers.mercadolivre.com.br e rode com `MERCADOLIVRE_TOKEN=... npm start` |
| OLX | bloqueado | proteção anti-robô (Cloudflare) recusa a busca automática |
| Webmotors | bloqueado | proteção anti-robô (PerimeterX) recusa a busca automática |
| iCarros, Seminovos.com.br | bloqueado / sem listagem acessível | |

Os conectores leem o HTML público dos sites, então uma mudança de layout pode quebrá-los. Cada um fica isolado em `src/connectors/` e, quando falha, a busca continua com as outras fontes e o status aparece na página.

A ficha de problemas conhecidos (`data/problemas-conhecidos.json`) é curada à mão, com relatos comuns de proprietários para os modelos mais vendidos. Não substitui laudo cautelar.

## Estrutura

```
server.js                  servidor HTTP: página estática + /api
src/search.js              orquestra fontes, filtros, dedup, FIPE e problemas
src/connectors/*.js        um conector por site (chave, nome, buscar(filtros))
src/normalize.js           formato padrão de anúncio
src/dedup.js               agrupamento de anúncios repetidos
src/fipe.js                consulta FIPE com cache
src/problemas.js           ficha de problemas conhecidos
data/problemas-conhecidos.json
index.html, style.css, app.js   página do usuário
test/                      testes unitários (node --test)
```

## Próximos passos

1. Mais fontes: lojas e concessionárias com página pública simples, Mercado Livre com token.
2. Paginação e mais páginas por fonte para buscas amplas.
3. Cache dos resultados por alguns minutos e histórico de preço por anúncio.
4. Alertas de busca salva e favoritos (exige banco de dados e login).
5. Enriquecer a ficha de problemas com recalls oficiais (Denatran/Procon).

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
| OLX | só pelo coletor no seu computador | bloqueia servidores (Cloudflare); o coletor diário lê pelo seu Chrome |
| Webmotors | só pelo coletor no seu computador | bloqueia servidores (PerimeterX); o coletor diário lê pelo seu Chrome |
| iCarros, Seminovos.com.br | bloqueado / sem listagem acessível | |

Os conectores leem o HTML público dos sites, então uma mudança de layout pode quebrá-los. Cada um fica isolado em `src/connectors/` e, quando falha, a busca continua com as outras fontes e o status aparece na página.

A ficha de problemas conhecidos (`data/problemas-conhecidos.json`) é curada à mão, com relatos comuns de proprietários para os modelos mais vendidos. Não substitui laudo cautelar.

## Coletor diário (roda no seu Mac)

OLX e Webmotors bloqueiam servidores, mas não bloqueiam uma pessoa no Chrome. O coletor roda no seu computador, abre o seu Chrome (num perfil próprio do Veículo Mais), visita os sites em ritmo humano, lê os anúncios das buscas que você definiu e guarda tudo num banco local. Todo dia ele compara com o dia anterior e monta a avaliação: novos, quedas de preço, abaixo da FIPE, sumidos (provavelmente vendidos) e as melhores oportunidades. A página **Hoje** (`dia.html`) mostra isso.

### Instalação no Mac

1. Instale o Node 22 ou mais novo: `brew install node` ou pelo instalador em https://nodejs.org.
2. Na pasta do projeto, instale as dependências do coletor (Playwright e SDK da Anthropic):
   ```bash
   npm install
   ```
3. Edite `coletor/buscas.json` com os carros que você quer acompanhar (marca, modelo, ano, preço, região).
4. Rode a primeira coleta com a janela do Chrome visível, para ver tudo acontecendo:
   ```bash
   npm run coletar
   ```
   O banco fica em `~/.veiculomais/veiculomais.db`. Se um site mostrar captcha, resolva na janela; o perfil guarda a sessão para as próximas vezes.
5. Agende para rodar todo dia (padrão 6h; o Mac precisa estar ligado e com você logado):
   ```bash
   npm run agendar:mac            # ou: bash coletor/instalar-mac.sh 7 30  (7h30)
   ```
6. Suba o site e abra a página Hoje:
   ```bash
   npm start
   # http://localhost:3000/dia.html
   ```

### Resumo do dia por IA

Com uma chave da Anthropic no ambiente, o Claude escreve a avaliação do dia (visão geral, oportunidades com o que checar, o que sumiu). Sem chave, sai um resumo automático simples.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run coletar
```

Para o agendamento usar a chave, exporte a variável antes de rodar `npm run agendar:mac` (o script grava a chave no agendamento).

### Comandos úteis

| Comando | O que faz |
| --- | --- |
| `npm run coletar` | roda todas as buscas, Chrome visível |
| `npm run coletar:invisivel` | mesmo, sem janela |
| `npm run coletar:rapido` | só Mobiauto, Na Pista e Chaves na Mão (sem navegador, uns 10 s) |
| `node coletor/index.js --busca "Jetta GLI" --fontes olx,webmotors` | uma busca, fontes escolhidas |
| `npm run diagnostico` | resume as páginas salvas em debug para ajustar os conectores |
| `npm run desagendar:mac` | remove o agendamento |

### Se OLX ou Webmotors falharem

- **Verificação humana.** A Webmotors mostra um desafio do tipo "pressione e segure". Com a janela do Chrome visível, o coletor espera até 2 minutos para você resolver na própria janela e segue em frente. O coletor não tenta resolver esse desafio sozinho: ele existe justamente para impedir acesso automático. Para pedir menos vezes, a Webmotors lê só a primeira página de cada busca (`paginasPorFonte.webmotors` em `coletor/buscas.json`). Na coleta agendada, sem ninguém para responder, a Webmotors fica de fora daquele dia e as outras fontes seguem.
- **Nada reconhecido.** Os conectores desses dois sites foram escritos sem acesso direto a eles (bloqueiam servidores). Quando nada é reconhecido, o coletor salva o HTML e uma captura em `~/.veiculomais/debug/`. Rode `npm run diagnostico` e cole a saída na conversa: ela resume o que veio na página sem precisar enviar o arquivo inteiro.
- As outras fontes continuam funcionando enquanto isso.

### Limites

- Uma página de listagem leva uns 5 segundos em ritmo humano. Vinte buscas em cinco sites, duas páginas cada, levam por volta de 15 minutos.
- Não aumente muito `paginasPorFonte` nem a lista de buscas: volume alto dispara o bloqueio mesmo no Chrome.
- Os termos de uso desses sites restringem coleta automática. Este coletor é para uso pessoal.

## Estrutura

```
server.js                  servidor HTTP: páginas estáticas + /api (busca ao vivo e /api/dia)
src/search.js              orquestra fontes, filtros, dedup, FIPE e problemas
src/connectors/*.js        um conector por site (chave, nome, buscar(filtros))
src/normalize.js           formato padrão de anúncio
src/dedup.js               agrupamento de anúncios repetidos
src/fipe.js                consulta FIPE com cache
src/problemas.js           ficha de problemas conhecidos
src/db.js                  banco SQLite local (anúncios, histórico de preço, coletas)
coletor/index.js           coletor diário
coletor/buscas.json        lista de buscas acompanhadas
coletor/fontes/*.js        OLX e Webmotors via navegador
coletor/avaliar.js         avaliação do dia e oportunidades
coletor/resumo.js          resumo por IA (SDK da Anthropic) ou automático
coletor/instalar-mac.sh    agendamento diário (launchd)
data/problemas-conhecidos.json
index.html, app.js         busca ao vivo
dia.html, dia.js           veículos de hoje
cards.js, style.css        renderização e estilo compartilhados
test/                      testes unitários (node --test)
```

## Próximos passos

1. Ajustar os conectores de OLX e Webmotors com a primeira rodada no Mac.
2. Alertas (e-mail ou WhatsApp) quando aparecer uma oportunidade.
3. Gráfico de histórico de preço por anúncio e por modelo.
4. Mais fontes: lojas e concessionárias, Mercado Livre com token.
5. Enriquecer a ficha de problemas com recalls oficiais (Denatran/Procon).

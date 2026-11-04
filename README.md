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

## App no Mac

O Veículo Mais roda como um app no seu Mac. OLX e Webmotors bloqueiam servidores, mas não bloqueiam uma pessoa no Chrome, então a coleta acontece no seu computador: o app abre o seu Chrome (num perfil próprio), visita os sites em ritmo humano, lê os anúncios das buscas que você escolheu e guarda tudo num banco local. Todo dia ele compara com os dias anteriores e monta a avaliação: novos, quedas de preço, abaixo da FIPE, vendidos e as melhores oportunidades.

### Instalar (uma vez)

1. Instale o Node 22.13 ou mais novo: `brew install node`.
2. Baixe o projeto e instale o app:
   ```bash
   cd ~/dev
   git clone https://github.com/rpro-performance/projeto-acessibilidade.git
   cd projeto-acessibilidade
   git checkout claude/friendly-hypatia-j3n3kc
   npm run instalar
   ```
3. O instalador cria o app **Veículo Mais** em Aplicativos (com ícone), liga o serviço em segundo plano e abre o app. Arraste o ícone para o Dock, se quiser.

Depois disso, o terminal não é mais necessário:

- **Abrir:** clique em Veículo Mais em Aplicativos ou no Dock. A janela abre no endereço `http://localhost:3737`.
- **Coletar agora:** botão no topo de qualquer tela, com o andamento ao vivo.
- **Coleta automática:** o serviço liga junto com o Mac e coleta todo dia no horário escolhido. Se o Mac estiver dormindo no horário, coleta assim que acordar. O Mac avisa quando a coleta termina.
- **Configurações:** carros acompanhados, sites, horário da coleta, chave da IA (com botão para testar) e botão para buscar atualização.
- **Verificação de humano:** quando a Webmotors pede o "pressione e segure", o Mac mostra um aviso e o app traz a janela do Chrome para frente. Se ninguém responder em 2 minutos, a Webmotors fica de fora daquela coleta e as outras fontes seguem. O app não tenta resolver esse desafio sozinho: ele existe justamente para barrar acesso automático.

Para remover: `npm run desinstalar` (os dados em `~/.veiculomais` ficam guardados).

### Onde ficam os dados

| Arquivo | Conteúdo |
| --- | --- |
| `~/.veiculomais/veiculomais.db` | anúncios, histórico de preço e coletas |
| `~/.veiculomais/buscas.json` | carros e sites escolhidos em Configurações |
| `~/.veiculomais/config.json` | horário da coleta e chave da IA (só leitura do seu usuário) |
| `~/.veiculomais/servidor.log` | log do serviço e das coletas |
| `~/.veiculomais/chrome/` | perfil do Chrome usado na coleta |

O serviço escuta só em `127.0.0.1`: nenhum outro computador da rede acessa o app. As ações que mudam algo (coletar, salvar, atualizar) só são aceitas vindas da própria página do app.

### Comandos de terminal (opcionais)

| Comando | O que faz |
| --- | --- |
| `npm run instalar` | instala ou reinstala o app e o serviço |
| `npm run coletar` | roda uma coleta pelo terminal, com o Chrome visível |
| `npm run coletar:rapido` | só Mobiauto, Na Pista e Chaves na Mão (sem navegador) |
| `npm run relatorio` | mostra o resultado da última coleta num bloco curto |
| `npm run chave` | guarda a chave da Anthropic (o mesmo que a tela de Configurações) |
| `node coletor/limpar.js olx` | apaga do banco os anúncios de uma fonte |
| `npm run diagnostico` | resume as páginas salvas em debug para ajustar os conectores |
| `npm run desinstalar` | remove o app e o serviço |

### Se OLX ou Webmotors falharem

- **Verificação humana.** Veja acima. Para pedir menos vezes, a Webmotors lê só a primeira página de cada busca.
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
app/instalar-mac.sh        instala o app (serviço launchd + Veículo Mais.app)
src/coleta.js              coleta pelo app e agendamento diário
src/buscas.js              buscas acompanhadas (~/.veiculomais/buscas.json)
configuracoes.html, .js    tela de Configurações
barra.js                   barra do app (Coletar agora, andamento, avisos)
data/problemas-conhecidos.json
index.html, app.js         busca ao vivo
dia.html, dia.js           veículos de hoje
cards.js, style.css        renderização e estilo compartilhados
test/                      testes unitários (node --test)
```

## Próximos passos

1. Versão para celular: publicar os dados de cada coleta num banco na nuvem para ver os veículos do dia no telefone.
2. Alertas (e-mail ou WhatsApp) quando aparecer uma oportunidade.
3. Gráfico de histórico de preço por anúncio e por modelo.
4. Mais fontes: lojas e concessionárias, Mercado Livre com token.
5. Enriquecer a ficha de problemas com recalls oficiais (Denatran/Procon).

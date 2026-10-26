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

## Estado atual

Este repositório contém a página inicial (HTML + CSS) do Veículo Mais com o formulário de busca e a área de resultados. A busca ainda não está conectada a nenhuma fonte; o próximo passo é criar a API e o primeiro conector.

## Próximos passos

1. Definir o formato padrão de anúncio (JSON) usado por todos os conectores.
2. Criar a API de busca (`/buscar?marca=&modelo=&anoDe=&anoAte=...`).
3. Implementar o primeiro conector (OLX ou Webmotors) e ligar na página.
4. Adicionar os demais conectores, dedup e cache.
5. Ficha de problemas conhecidos por modelo e comparação com a FIPE.

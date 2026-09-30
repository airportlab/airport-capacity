# Capacidade aeroportuária

SPA estático (sem backend) para dimensionar componentes operacionais de terminal a partir da tabela de parâmetros mínimos de dimensionamento (PMD). O estudo fica na sessão do navegador. Guardar e Carregar usam o arquivo `.airport`. Recarregar a página sem esse arquivo perde o estado. A interface está em pt-BR.

Ferramenta não oficial. A tabela PMD é transcrição dos contratos citados; não substitui o PEA, a ANAC nem um estudo assinado. Os números do exemplo são ilustrativos.

## Como rodar

```bash
npm install
npm run dev
```

Build estático: `npm run build`. Pré-visualização: `npm run preview`.

## Fontes do PMD

O catálogo em `src/domain/airports.ts` liga cada aeroporto concedido ao contrato, à rodada e ao bloco. As tabelas numéricas estão em `src/domain/pmd.ts`:

- **`standard`** — relicitação do SBSG, 6ª rodada (Norte, Central e Sul) e 7ª rodada. Sala de embarque com Emp 2,3 m²/pax e 70% de assentos. Sala de desembarque com Toi 20/45.
- **`nordeste`** — 5ª rodada (Nordeste, Centro-Oeste e Sudeste). Uma sala de embarque, sentado e em pé. Sala de desembarque com Toi 30/45.
- **`sentado`** — 2ª, 3ª e 4ª rodadas. Pontes e remotas separadas, na mesma conta de sentado e em pé. Sala de desembarque com Toi 30/45.

Esses números são transcrição de documentos públicos da ANAC, não um instrumento oficial. Confira sempre o contrato vigente.

**Carregar exemplo fictício** (no Resumo) preenche componentes operacionais com DHp, área medida e equipamentos ilustrativos — não são valores operacionais do aeroporto selecionado.

## Licença

O **software** deste repositório está sob [CC0 1.0](LICENSE) ([leitura em português](https://creativecommons.org/publicdomain/zero/1.0/deed.pt_BR)). A tabela PMD é transcrição de atos oficiais da ANAC e **não** é licenciada por este repositório; o aviso acima continua válido. As fontes da interface (IBM Plex Sans e IBM Plex Serif) permanecem sob [SIL Open Font License 1.1](https://github.com/IBM/plex/blob/master/LICENSE.txt); não são CC0.

# Capacidade aeroportuária

SPA estático (sem backend) para dimensionar componentes operacionais de terminal a partir da tabela de parâmetros mínimos de dimensionamento (PMD). A persistência fica só no `localStorage` do navegador. A interface está em pt-BR.

Ferramenta não oficial. A tabela PMD é transcrição dos contratos citados; não substitui o PEA, a ANAC nem um estudo assinado. Os números do exemplo são ilustrativos.

## Como rodar

```bash
npm install
npm run dev
```

Build estático: `npm run build`. Pré-visualização: `npm run preview`.

## Fontes do PMD

O catálogo em `src/domain/airports.ts` liga cada aeroporto de estudo ao contrato, à rodada e ao bloco. A tabela numérica compartilhada está em `src/domain/pmd.ts` (`STANDARD_PMD`):

- **SBSG** — Contrato de Concessão nº 004/ANAC/2023, 7ª rodada (relicitação)
- **SBGO** — Contrato de Concessão nº 003/ANAC/2021-Central, 6ª rodada
- **7ª rodada — Aviação Geral** — Contrato de Concessão nº 001/ANAC/2023-Aviação Geral (SBMT, SBJR)
- **7ª rodada — Norte II** — Contrato de Concessão nº 003/ANAC/2023-Norte II (SBBE, SBMQ)
- **7ª rodada — SP/MS/PA/MG** — Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG (SBSP, SBCG, SBCR, SBPP, SBSN, SBMA, SBCJ, SBHT, SBUL, SBMK, SBUR)

Esses números são transcrição de documentos públicos da ANAC, não um instrumento oficial. Confira sempre o contrato vigente.

**Carregar exemplo fictício** (no Resumo) preenche componentes operacionais com DHp, área medida e equipamentos ilustrativos — não são valores operacionais do aeroporto selecionado.

## Licença

O **software** deste repositório está sob [CC0 1.0](LICENSE) ([leitura em português](https://creativecommons.org/publicdomain/zero/1.0/deed.pt_BR)). A tabela PMD é transcrição de atos oficiais da ANAC e **não** é licenciada por este repositório; o aviso acima continua válido.

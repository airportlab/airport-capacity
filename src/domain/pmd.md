# PMD — tabela `standard`

Ferramenta não oficial. A tabela PMD é transcrição dos contratos citados; não substitui o PEA, a ANAC nem um estudo assinado. Os números do exemplo são ilustrativos.

Tabela numérica compartilhada. A rodada e o contrato são da fonte do aeroporto (`src/domain/airports.ts`), não desta tabela.

Fontes atuais (mesmos números; a citação muda com o contrato):

- **SBSG** — Contrato de Concessão nº **004/ANAC/2023**, 7ª rodada (relicitação), valores na hora-pico.
- **SBGO** — Contrato de Concessão nº **003/ANAC/2021-Central**, 6ª rodada.
- **7ª rodada — Aviação Geral** — Contrato de Concessão nº **001/ANAC/2023-Aviação Geral** (SBMT, SBJR).
- **7ª rodada — Norte II** — Contrato de Concessão nº **003/ANAC/2023-Norte II** (SBBE, SBMQ).
- **7ª rodada — SP/MS/PA/MG** — Contrato de Concessão nº **002/ANAC/2023-SP/MS/PA/MG** (SBSP, SBCG, SBCR, SBPP, SBSN, SBMA, SBCJ, SBHT, SBUL, SBMK, SBUR).

Números no código: `src/domain/pmd.ts` (`STANDARD_PMD`). Tipos instanciáveis: `src/domain/templates/organs.ts`.

A tabela **é** o catálogo exaustivo de tipos de componente operacional. Cada linha (com a coluna doméstico ou internacional) vira uma instância; pode haver várias instâncias do mesmo tipo. A aba Parâmetros só mostra as fontes do aeroporto selecionado — o componente absorve Emp, Toi, v.a. e assentos na criação.

Quando um edital tiver números diferentes, entra outro `pmdTableId` — não um markdown por rodada.

## Tabela do contrato (doméstico / internacional)

| Componente | Parâmetro | Dom. | Int. |
|---|---|---|---|
| Saguão de embarque | espaço mínimo por ocupante | 2,3 | 2,3 |
| Saguão de embarque | v.a. por passageiro | 1,0 | 1,0 |
| Saguão de embarque | tempo **médio** de ocupação (min) | 20 | 20 |
| Saguão de desembarque | espaço mínimo por ocupante | 1,7 | 1,7 |
| Saguão de desembarque | v.a. por passageiro | 1,0 | 1,0 |
| Saguão de desembarque | tempo **médio** de ocupação (min) | 15 | 25 |
| Check-in e despacho de bagagens | espaço mínimo por passageiro (m²/pax) | 1,3 | 1,8 |
| Check-in e despacho de bagagens | tempo **máximo** de ocupação na fila (min) | 20 | 30 |
| Inspeção de segurança | espaço mínimo por passageiro (m²/pax) | 1,0 | 1,0 |
| Inspeção de segurança | tempo **máximo** de ocupação na fila (min) | 10 | 15 |
| Emigração | espaço mínimo por passageiro (m²/pax) | — | 1,0 |
| Emigração | tempo **máximo** de ocupação na fila (min) | — | 10 |
| Imigração | espaço mínimo por passageiro (m²/pax) | — | 1,0 |
| Imigração | tempo **máximo** de ocupação na fila (min) | — | 10 |
| Aduana | espaço mínimo por **passageiro** (m²/pax) | — | 1,7 |
| Aduana | tempo **máximo** de ocupação na fila (min) | — | 10 |
| Sala de embarque em posições próximas (pontes) | espaço mínimo por passageiro (m²/pax) | 2,3 | 2,3 |
| Sala de embarque em posições próximas (pontes) | tempo **médio** de ocupação (min) | 40 | 60 |
| Sala de embarque em posições próximas (pontes) | percentual mínimo de assentos oferecidos | 70 | 70 |
| Sala de embarque em posições remotas | espaço mínimo por passageiro (m²/pax) | 2,3 | 2,3 |
| Sala de embarque em posições remotas | tempo **médio** de ocupação (min) | 40 | 60 |
| Sala de embarque em posições remotas | percentual mínimo de assentos oferecidos | 70 | 70 |
| Sala de desembarque | espaço mínimo por passageiro (m²/pax) | 1,7 | 1,7 |
| Sala de desembarque | tempo **médio** de ocupação (min) | 20 | 45 |

Toi dos saguões e das salas é **médio**; Toi de check-in, inspeção, emigração, imigração e aduana é **máximo** na área de fila. Aduana no contrato é **m²/pax**, não m²/ocup.

---

## Símbolos

| Símbolo | Significado | Unidade |
|---|---|---|
| DHp | Demanda na hora-pico **deste fluxo deste componente** | pax/h |
| u | Taxa de utilização | % |
| Emp | Espaço mínimo por passageiro ou por ocupante | m²/pax ou m²/ocup |
| Toi | Tempo de ocupação no componente | min |
| v.a. | Visitantes-acompanhantes por passageiro | v.a./pax |
| Ad | Área mínima necessária | m² |

Contas genéricas de área:

- Sem acompanhante: `Ad = (DHp × Emp × Toi) / 60`
- Com acompanhante: `Ad = (DHp × Emp × Toi × (1 + v.a.)) / 60`
- Com taxa de utilização diferente de 100%: entra `Tu` no numerador (`DHp × Tu × …`)
- Assentos (salas de embarque): `(DHp × Toi / 60) × (% / 100)` (com `Tu` se marcado no requisito de área)
- Saguão de embarque misto: `Ad_e,dom` e `Ad_e,int`; `Ad` é a soma. Uma área medida.
- Saguão de embarque e desembarque: `Ad_e` e `Ad_d` (e, se misto, uma conta por coluna); `Ad` é a soma. Uma área medida.

Emp, Toi, v.a. e % vêm da coluna **doméstico** ou **internacional** da linha, ou são valor próprio com justificativa. DHp nunca está no PMD. A taxa de utilização `Tu` (%, só se diferente de 100%) é de cada requisito (área e equipamentos independentes).

Coluna vazia (`—`) significa: aquele processo **não se dimensiona** naquela natureza (emigração, imigração e aduana só têm internacional).

---

## Cada linha do PMD

### Saguão de embarque (`saguao-embarque`)

Área de público **antes** do processamento (check-in / inspeção), com acompanhantes.

- Unidade Emp: **m²/ocup** (passageiro + visitante).
- Doméstico e internacional iguais: Emp **2,3**, v.a. **1,0**, Toi **médio** **20** min.
- Usa a fórmula **com acompanhante**.
- Natureza **misto** na criação: dois DHp (doméstico e internacional); `Ad = Ad_e,dom + Ad_e,int`. Continua na semente 1:1 só com a natureza padrão (doméstico).

### Saguão de desembarque (`saguao-desembarque`)

Área de público **depois** do desembarque (restituição, encontro com acompanhantes).

- Unidade Emp: **m²/ocup**.
- Emp **1,7** e v.a. **1,0** nas duas colunas.
- Toi **médio** muda: **15** min doméstico, **25** min internacional.
- Fórmula **com acompanhante**.

### Check-in e despacho de bagagens (`checkin-bagagens`)

Fila e área de atendimento de check-in / despacho.

- Unidade Emp: **m²/pax** (sem v.a. no PMD).
- Doméstico: Emp **1,3**, Toi **máximo** **20** min.
- Internacional: Emp **1,8**, Toi **máximo** **30** min.
- Componente típico também tem **requisito de equipamentos** (balcões): conta à parte, não está nesta linha.

### Inspeção de segurança (`inspecao`)

Fila e área dos canais de inspeção.

- Unidade Emp: **m²/pax**. Sem v.a.
- Emp **1,0** nas duas colunas.
- Toi **máximo** **10** min doméstico, **15** min internacional.
- Componente típico também tem **equipamentos** (pórtico / raios-X).

### Emigração (`emigracao`)

Fila de controle de saída do país.

- Só **internacional**: Emp **1,0** m²/pax, Toi **máximo** **10** min.
- Doméstico: **—** (não instanciar coluna doméstica).

### Imigração (`imigracao`)

Fila de controle de entrada no país.

- Só **internacional**: Emp **1,0** m²/pax, Toi **máximo** **10** min.
- Doméstico: **—**.

### Aduana (`aduana`)

Fila de fiscalização aduaneira.

- Unidade Emp: **m²/pax** (contrato; não é m²/ocup).
- Só **internacional**: Emp **1,7**, Toi **máximo** **10** min.
- Doméstico: **—**.
- Componente típico pode ter equipamentos.

### Sala de embarque em posições próximas — pontes (`sala-embarque-pontes`)

Nome no contrato: *Sala de embarque de atendimento em posições próximas (pontes de embarque)*.

- Unidade Emp: **m²/pax**. Sem v.a.
- Emp **2,3** nas duas colunas.
- Toi **médio** **40** min doméstico, **60** min internacional.
- Assentos mínimos: **70%** da ocupação simultânea `(DHp × Toi / 60)` nas duas colunas.

### Sala de embarque em posições remotas (`sala-embarque-remotas`)

Nome no contrato: *Sala de embarque de atendimento em posições remotas*. Mesmos Emp, Toi médio e 70% de assentos que pontes nesta tabela.

### Sala de desembarque (`sala-desembarque`)

- Unidade Emp: **m²/pax**. Sem v.a. e sem assentos no PMD.
- Emp **1,7** nas duas colunas.
- Toi **médio** **20** min doméstico, **45** min internacional.

### Saguão de embarque e desembarque (`saguao-embarque-desembarque`)

Não é linha do contrato: o componente **absorve** o saguão de embarque **e** o saguão de desembarque (Emp m²/ocup, v.a.). Natureza doméstico ou internacional: dois DHp. Natureza misto: quatro DHp (função × natureza). `Ad` é a soma das contas; uma área medida. Sem assentos. Fora da semente 1:1.

---

## O que não está no PMD

**Meio-fio** não tem linha. É componente **especial**: contas próprias, ainda não modeladas. Não entra na lista de cadastro.

Não há componente genérico zerado: a criação admite os tipos da tabela acima e o **saguão de embarque e desembarque** (dois ou quatro DHp). Essa combinação **não** é linha do PMD e **não** entra na semente 1:1.

---

## Instância a partir do tipo

Todo componente operacional no `registry` é uma **instância**. Tipos de uma linha do PMD + natureza seguem 1:1. O saguão de embarque e desembarque é instância de **duas** linhas. Pode haver várias instâncias do mesmo tipo.

A aba Parâmetros só consulta as fontes. Emp/Toi/v.a./assentos entram na criação (`instantiateOrgan`). O nome é livre; o tipo e a natureza não mudam depois. Número absorvido pode diferir com justificativa.

### Natureza na criação

| Natureza | DHp | Coluna do PMD |
|---|---|---|
| **Doméstico** | um DHp (dois no saguão combinado) | coluna doméstico (se a linha tiver valor) |
| **Internacional** | um DHp (dois no saguão combinado) | coluna internacional |
| **Misto** | dois DHp no saguão de embarque; quatro no saguão combinado | as duas colunas |

Tipos só-internacionais (emigração, imigração, aduana) não oferecem doméstico. O **saguão de embarque** admite misto (duas colunas da mesma linha). O **saguão de embarque e desembarque** entra na criação e absorve as duas linhas de saguão; **não** entra na semente. Natureza mista só nestes saguões. Sala embarque+desembarque **não** entra.

### Tipos instanciáveis

| Tipo | Função | Naturezas | Linha de PMD | Requisitos |
|---|---|---|---|---|
| Saguão de embarque | público pré-embarque | dom / int / misto | `saguao-embarque` | área com acompanhante; misto: Ad = soma das duas colunas |
| Saguão de desembarque | público pós-desembarque | dom / int | `saguao-desembarque` | área com acompanhante |
| Saguão de embarque e desembarque | público pré e pós (2 ou 4 DHp) | dom / int / misto | as duas linhas de saguão | área com acompanhante; Ad = soma |
| Check-in e despacho de bagagens | fila + balcões | dom / int | `checkin-bagagens` | área + equipamentos |
| Inspeção de segurança | fila + canais | dom / int | `inspecao` | área + equipamentos |
| Emigração | fila de saída | só internacional | `emigracao` | área |
| Imigração | fila de entrada | só internacional | `imigracao` | área |
| Aduana | fila / área aduaneira | só internacional | `aduana` | área + equipamentos |
| Sala de embarque (pontes) | espera em pontes | dom / int | `sala-embarque-pontes` | área + assentos 70% |
| Sala de embarque (remotas) | espera em remotas | dom / int | `sala-embarque-remotas` | área + assentos 70% |
| Sala de desembarque | desembarque da aeronave | dom / int | `sala-desembarque` | área |

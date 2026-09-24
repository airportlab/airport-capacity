import { airportsByGroup } from "../domain/airports";
import { UNOFFICIAL_NOTICE } from "../domain/notice";
import {
  ABOUT_AS_IS,
  ABOUT_UNOFFICIAL_EXTRA,
  CC0_DEED_URL,
} from "./aboutCopy";

interface AboutPageProps {
  onBack: () => void;
}

export function AboutPage({ onBack }: AboutPageProps) {
  const groups = airportsByGroup();

  return (
    <article className="about-page">
      <header className="about-intro">
        <h1>Sobre</h1>
      </header>

      <section className="panel">
        <h2>O que é e o que faz</h2>
        <p>
          Ferramenta de cálculo no navegador, em português do Brasil, para
          dimensionar <strong>componentes operacionais</strong> de terminal a
          partir da tabela de parâmetros mínimos de dimensionamento (PMD) do
          aeroporto de estudo. Cada componente é uma instância independente, com
          o próprio DHp. A criação escolhe um tipo da lista do PMD — ou o
          saguão de embarque e desembarque — e a natureza (doméstico,
          internacional ou, nos saguões de embarque e no check-in, misto). Área é
          requisito opcional em todos os tipos. Equipamentos são opcionais só
          nos processadores (check-in, inspeção, emigração, imigração e
          aduana). Saguões e salas são dimensionados só por área. O aplicativo
          começa sem componentes.
        </p>
        <p>
          No <strong>Resumo</strong> você escolhe o aeroporto de estudo (a fonte
          do contrato), dá nome ao relatório e vê Atende / Não atende por
          natureza, em área e em equipamentos. Sem requisito cadastrado, o
          status é “—”. O único botão <strong>Carregar exemplo fictício</strong>{" "}
          fica nesta aba e preenche um componente de cada tipo do PMD com
          números ilustrativos — não são valores operacionais do aeroporto
          selecionado. O saguão combinado não entra nesse exemplo.
        </p>
        <p>
          Em <strong>+ Componente</strong> o cadastro usa a lista exaustiva do
          PMD. Várias instâncias do mesmo tipo são permitidas. O componente
          absorve Emp, Toi, v.a. e os critérios da sala de embarque da fonte
          escolhida; o valor pode diferir com justificativa, sem mudar a fonte
          do tipo. No SBMO a sala de embarque é uma só: área ponderada entre
          passageiro sentado e em pé, dividida pela ocupação máxima. Se o
          estudo mudar para um contrato com outra conta, essa sala fica
          inválida e o Excel e o PDF não saem. Nas entradas
          do componente a natureza (doméstico, internacional ou, nos saguões
          de embarque e no check-in, misto) pode ser alterada depois. Meio-fio e sala de
          embarque e desembarque combinada não entram na criação.
        </p>
        <p>
          Na aba do componente você informa DHp e área medida. Nos
          processadores, também equipamentos. A
          demanda de área (Ad) usa DHp, Emp e Toi (e v.a., nos saguões, se o
          requisito marcar acompanhante, ou taxa de utilização Tu, se estiver
          marcada). Equipamentos usam o teto da
          conta de N. O tsec nasce no padrão do Manual de Anteprojeto de cada
          fluxo; valor diferente pede justificativa. Com vários fluxos, cada um
          usa o seu Toi e o seu tsec. Saguões e salas não têm N. Na sala de
          desembarque o
          requisito opcional é o tamanho mínimo de esteira, com Tr mínimo de
          30% e Lmp mínimo de 0,9 m. Valor diferente desse mínimo pede
          justificativa. Com vários DHp no mesmo recinto, as contas somam — não se
          fundem. Saguão de embarque misto soma doméstico e internacional;
          check-in misto soma Ad_dom e Ad_int. Saguão de embarque e desembarque soma as funções (e as quatro contas,
          se misto). A saturação compara a demanda com o que a área ou os
          equipamentos podem atender. A aba <strong>Parâmetros</strong> consulta
          a tabela PMD da fonte selecionada e o tsec do Manual de Anteprojeto,
          padrão do requisito de equipamentos quando o tipo tem valor; as
          fórmulas aparecem no próprio componente, junto do requisito.
        </p>
      </section>

      <section className="panel">
        <h2>Não é ferramenta oficial</h2>
        <p>{UNOFFICIAL_NOTICE}</p>
        <p>{ABOUT_UNOFFICIAL_EXTRA}</p>
        <p>Fontes atuais do catálogo:</p>
        <ul>
          {groups.map((group) => {
            const first = group.airports[0];
            const icaos = group.airports.map((item) => item.icao).join(", ");
            return (
              <li key={group.label}>
                <strong>{group.label}</strong> — {first.contract} ({icaos})
              </li>
            );
          })}
        </ul>
        <p>
          O <strong>software</strong> desta página está sob{" "}
          <a
            href={CC0_DEED_URL}
            rel="license noopener noreferrer"
            target="_blank"
          >
            CC0 1.0
          </a>
          . A tabela PMD é transcrição de atos oficiais da ANAC e{" "}
          <strong>não</strong> é licenciada por esta ferramenta. {ABOUT_AS_IS}
        </p>
      </section>

      <section className="panel">
        <h2>No computador</h2>
        <p>
          A interface está em <strong>português do Brasil</strong> (pt-BR). A
          implementação é uma página estática em <strong>TypeScript</strong> e{" "}
          <strong>React</strong>, empacotada com <strong>Vite</strong> em HTML,
          CSS e JavaScript — o tipo de site que um hospedeiro de páginas
          estáticas (por exemplo GitHub Pages) serve sem servidor de aplicação.
          Não há backend, API, conta, telemetria nem cookies de rastreio.
        </p>
        <p>
          Os cálculos rodam no navegador. Você pode gerar <strong>Excel</strong>{" "}
          (por componente ou por natureza) e <strong>PDF</strong> (simplificado
          ou completo). Dá para{" "}
          <strong>guardar</strong> o estudo num arquivo{" "}
          <code>.airport</code> para <strong>carregar</strong> depois.
          Recarregar a página sem esse arquivo perde o estado da sessão. Os
          dados só saem da máquina se você exportar, copiar ou enviar o arquivo
          por conta própria.
        </p>
      </section>

      <div className="actions about-back">
        <button type="button" onClick={onBack}>
          Voltar ao resumo
        </button>
      </div>
    </article>
  );
}

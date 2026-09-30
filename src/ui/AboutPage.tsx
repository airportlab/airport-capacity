import { airportsByGroup } from "../domain/airports";
import { UNOFFICIAL_NOTICE } from "../domain/notice";
import {
  ABOUT_AS_IS,
  ABOUT_UNOFFICIAL_EXTRA,
  CC0_DEED_URL,
  OFL_LICENSE_URL,
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
          A ferramenta dimensiona <strong>componentes operacionais</strong> de
          terminal a partir da tabela de parâmetros mínimos de dimensionamento
          (PMD) do aeroporto de estudo. A interface está em{" "}
          <strong>português do Brasil</strong> (pt-BR). A implementação é uma
          página estática em <strong>TypeScript</strong> e <strong>React</strong>,
          empacotada com <strong>Vite</strong> em HTML, CSS e JavaScript — o
          tipo de site que um hospedeiro de páginas estáticas (por exemplo
          GitHub Pages) serve sem servidor de aplicação. Não há backend, API,
          conta, telemetria nem cookies de rastreio.
        </p>
        <p>
          Os cálculos rodam no navegador. Você pode gerar{" "}
          <strong>Excel modelo</strong> e{" "}
          <strong>Excel modelo por componente</strong>. Dá para{" "}
          <strong>guardar</strong> o estudo num arquivo <code>.airport</code>{" "}
          para <strong>carregar</strong> depois. Recarregar a página sem esse
          arquivo perde o estado da sessão. Os dados só saem da máquina se você
          exportar, copiar ou enviar o arquivo por conta própria.
        </p>
        <p>
          Cada componente é uma instância independente, com o próprio DHp. A
          criação escolhe um tipo da lista do PMD do aeroporto selecionado — ou
          o saguão de embarque e desembarque — e a natureza (doméstico,
          internacional ou, nos saguões de embarque, de desembarque e de
          embarque e desembarque, no check-in e na sala de desembarque, misto).
          Área é requisito opcional em todos os tipos. Equipamentos são
          opcionais só nos processadores (check-in, inspeção, emigração,
          imigração e aduana). Saguões e salas não têm equipamentos. A sala de
          desembarque tem comprimento mínimo de esteira opcional. Na tabela
          padrão as salas de embarque contam o percentual de assentos. Na 5ª
          rodada e da 2ª à 4ª a conta é de passageiro sentado e em pé, sem
          contagem separada de assentos. O aplicativo começa sem componentes.
        </p>
        <p>
          No <strong>Resumo</strong> você escolhe o aeroporto de estudo (a fonte
          do contrato) e dá nome ao relatório. A data do relatório é a data de
          hoje. A lista segue a jornada — Embarque, Desembarque e Outros — com
          um cartão por componente. O cartão mostra Atende / Não atende em área
          e, quando o requisito existe, em equipamentos ou, na sala de
          desembarque, na esteira. Sem requisito, o cartão diz “Sem requisitos”
          e a tabela mostra “—”. Sala de embarque de outra conta aparece como
          “Não vale para este contrato”; os dois Excel ficam desligados até ela
          ser apagada ou o aeroporto voltar à conta em que ela nasceu. O único
          botão <strong>Carregar exemplo fictício</strong> fica nesta aba e
          preenche um estudo ilustrativo — não são valores operacionais do
          aeroporto selecionado. Entram um componente de cada tipo da tabela
          desse aeroporto, o saguão combinado, as naturezas mistas, conexão,
          taxa de utilização diferente de 100%, esteira, equipamentos nos
          processadores e quatro circulações horizontais, com comentários nos
          campos de texto.
        </p>
        <p>
          Em <strong>+ Componente</strong> o cadastro usa a lista exaustiva do
          PMD do aeroporto selecionado. Várias instâncias do mesmo tipo são
          permitidas. O componente absorve Emp, Toi, v.a. e os critérios da sala
          de embarque da fonte escolhida; o valor pode diferir com justificativa,
          sem mudar a fonte do tipo. Na tabela padrão (relicitação do SBSG, 6ª e
          7ª rodadas), pontes e remotas usam Emp e o percentual de assentos, e a
          sala de desembarque nasce com Toi 20/45 min. Na 5ª rodada a sala de
          embarque é uma só: área ponderada entre passageiro sentado e em pé,
          dividida pela ocupação máxima, sem contagem separada de assentos; a
          sala de desembarque nasce com Toi 30/45 min. Da 2ª à 4ª, pontes e
          remotas ficam em linhas separadas, na mesma conta de sentado e em pé,
          também sem assentos separados, e a sala de desembarque nasce com Toi
          30/45 min. Se o estudo mudar para um aeroporto com outra conta de sala
          de embarque, essa sala fica inválida e o Excel não sai. A sala de
          desembarque já aberta conserva o Toi absorvido. Nas entradas do
          componente a natureza
          (doméstico, internacional ou, nos saguões de embarque, de desembarque
          e de embarque e desembarque, no check-in e na sala de desembarque,
          misto) pode ser alterada depois. Meio-fio e sala de embarque e
          desembarque combinada não entram na criação.
        </p>
        <p>
          Na aba do componente você informa DHp e área medida. Nos
          processadores, também equipamentos. A demanda de área (Ad) usa DHp,
          Emp e Toi — e v.a. ou taxa de utilização, se o requisito marcar.
          Equipamentos usam o teto da conta de N. O Tsec nasce no padrão do
          Manual de Anteprojeto quando o fluxo tem esse padrão; valor diferente
          pede justificativa. Sem padrão, o campo nasce em 0. Saguões e salas
          não têm N. Na sala de desembarque o requisito opcional é o comprimento
          mínimo de esteira. Com vários DHp no mesmo recinto, as contas somam; a
          fórmula fica no próprio componente, junto do requisito. A saturação
          compara a demanda com o que a área ou os equipamentos podem atender. A
          aba <strong>Parâmetros</strong> consulta a tabela PMD da fonte
          selecionada e o Tsec do Manual de Anteprojeto.
        </p>
        <p>
          A aba <strong>Circulações</strong> cadastra circulações horizontais.
          Cada uma tem o próprio DHp. A interna liga a um componente; a
          transição, a dois. O componente só identifica o trecho. No início da
          aba estão a largura total exigida (Lt), a largura efetiva (Le) e a
          capacidade teórica (CHp). Lt vem da demanda. CHp usa a largura medida.
          Sem largura medida, CHp e o atendimento ficam em “—”. Se a largura
          útil ficar negativa, CHp é 0. Efeito borda e efeito contrafluxo são
          marcações separadas: sem a marcação, o termo vale zero. Cada um nasce
          em 0,5 m; outro valor pede justificativa. O PMM nasce em 20. Lt não
          fica abaixo de 1,5 m. Atende se a largura medida for maior ou igual a
          Lt. O exemplo fictício inclui quatro circulações. A circulação
          vertical não é cadastrada aqui.
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
          <strong>não</strong> é licenciada por esta ferramenta. As fontes da
          interface (IBM Plex Sans e IBM Plex Serif) permanecem sob{" "}
          <a
            href={OFL_LICENSE_URL}
            rel="license noopener noreferrer"
            target="_blank"
          >
            SIL Open Font License 1.1
          </a>
          ; não são CC0. {ABOUT_AS_IS}
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

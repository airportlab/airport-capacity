import type { ReactNode } from "react";
import {
  AREA_NOTATIONS,
  areaNumerator,
  boardingConnectionAreaList,
  boardingConnectionNumerator,
  connectionAreaNumerator,
  dualAreaSumDisplay,
  equipmentFormulaDisplay,
  equipmentNumerator,
  equipmentTermDisplay,
  equipmentToiSymbol,
  splitEquipmentSymbol,
  arrivalsConnectionNumerator,
  type ArrivalsEmpSuffix,
  beltConnectionNumerator,
  beltConnectionSymbol,
  beltNumerator,
  salaArrivalsSumDisplay,
  checkinConnectionEmpSuffix,
  mixedAreaSumDisplay,
  mixedBoardingConnectionEmpSuffix,
  simpleConnectionSumDisplay,
  singleFunctionMixedSumDisplay,
} from "../domain/contracts/notations";
import { isSplitCheckinEquipment } from "../domain/contracts/flowParams";
import type {
  ArrivalsConnectionPair,
  BoardingConnectionPair,
  ComponentContract,
  EquipmentTerm,
} from "../domain/types";
import { arrivalsConnectionSpec, boardingConnectionSpec } from "../domain/types";

export function TexText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  const pattern =
    /(?<![A-Za-zÀ-ÿ0-9])(\()?(CHp|PMM|DHp|Emp|Toi|Tsec|Ocup|Lmp|Le|Lt|Eb|Ec|Pa|P|Tr|Ad|Tu|v\.a|C|N)(?:_([A-Za-z0-9,]+))?(\))?(?![A-Za-zÀ-ÿ0-9])/g;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const open = match[1] ?? "";
    const base = match[2];
    const sub = match[3];
    const close = match[4] ?? "";
    parts.push(
      <span className="tex-sym" key={index}>
        {open}
        {base}
        {sub ? <sub>{sub}</sub> : null}
        {close}
      </span>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

interface AreaEquationProps {
  companions: boolean;
  lhs?: string;
  numerator?: string;
}

export function AreaEquation({
  companions,
  lhs = "Ad",
  numerator,
}: AreaEquationProps) {
  const num = numerator ?? areaNumerator(companions);

  return (
    <div className="tex" role="img" aria-label={`${lhs} = (${num}) / 60`}>
      <span className="tex-lhs">
        <TexText text={lhs} />
      </span>
      <span className="tex-eq">=</span>
      <span className="tex-frac">
        <span className="tex-num">
          <TexText text={num} />
        </span>
        <span className="tex-den">60</span>
      </span>
    </div>
  );
}

function seatsNumerator(expression: string): string {
  const boarding = expression.includes("DHp_e");
  const includeTaxa = expression.includes("Tu");
  const demand = boarding ? "DHp_e" : "DHp";
  const toi = boarding ? "Toi_e" : "Toi";
  return includeTaxa ? `${demand} × Tu × ${toi}` : `${demand} × ${toi}`;
}

export function SeatsFormulaLine({
  contract,
}: {
  contract: ComponentContract;
}) {
  const formula = contract.formulas.find((item) => item.id === "assentosMinimos");
  if (!formula) return null;
  const numerator = seatsNumerator(formula.expression);
  const label = `Assentos = ⌈(${numerator} / 60) × P_min%⌉`;
  return (
    <>
      <p className="formula-kicker formula-kicker-follow">Número mínimo de assentos</p>
      <div className="tex tex-ceil" role="img" aria-label={label}>
        <span className="tex-lhs">Assentos</span>
        <span className="tex-eq">=</span>
        <span className="tex-ceil-brace" aria-hidden="true">
          ⌈
        </span>
        <span className="tex-term">
          <span className="tex-frac">
            <span className="tex-num">
              <TexText text={numerator} />
            </span>
            <span className="tex-den">60</span>
          </span>
          <span>
            × <TexText text="P_min%" />
          </span>
        </span>
        <span className="tex-ceil-brace tex-ceil-brace-close" aria-hidden="true">
          ⌉
        </span>
      </div>
    </>
  );
}

function areaLegend(
  companions: boolean,
  hasConnection: boolean,
  includeSeats: boolean,
  pairs: readonly BoardingConnectionPair[] = [],
) {
  const items = AREA_NOTATIONS.filter((item) => {
    if (item.symbol === "v.a" && !companions) return false;
    if (item.symbol === "DHp_c" && (!hasConnection || pairs.length > 0)) {
      return false;
    }
    return true;
  });
  const connectionItems = pairs.map((pair) => {
    const spec = boardingConnectionSpec(pair);
    return {
      symbol: spec.dhpSymbol,
      meaning: `Demanda hora pico da conexão ${spec.label}`,
      unit: "pax/h",
    };
  });
  const listed = [...items, ...connectionItems];
  if (!includeSeats) return listed;
  return [
    ...listed,
    {
      symbol: "P_min",
      meaning: "Percentual mínimo de assentos",
      unit: "%",
    },
  ];
}

function ConnectionEquation({
  empSuffix,
  pair,
}: {
  empSuffix: string;
  pair?: BoardingConnectionPair;
}) {
  if (!pair) {
    return (
      <AreaEquation
        companions={false}
        lhs="Ad_c"
        numerator={connectionAreaNumerator(empSuffix)}
      />
    );
  }
  const spec = boardingConnectionSpec(pair);
  return (
    <AreaEquation
      companions={false}
      lhs={spec.areaSymbol}
      numerator={boardingConnectionNumerator(pair, empSuffix)}
    />
  );
}

function BoardingConnectionEquations({
  pairs,
  empSuffix,
  empSuffixOf,
}: {
  pairs: readonly BoardingConnectionPair[];
  empSuffix: string;
  empSuffixOf?: (pair: BoardingConnectionPair) => string;
}) {
  return (
    <>
      {pairs.map((pair) => (
        <ConnectionEquation
          key={pair}
          empSuffix={empSuffixOf?.(pair) ?? empSuffix}
          pair={pair}
        />
      ))}
    </>
  );
}

function AreaLegend({
  companions,
  hasConnection,
  includeSeats = false,
  pairs = [],
}: {
  companions: boolean;
  hasConnection: boolean;
  includeSeats?: boolean;
  pairs?: readonly BoardingConnectionPair[];
}) {
  return (
    <dl className="formula-legend">
      {areaLegend(companions, hasConnection, includeSeats, pairs).map((item) => (
        <div key={item.symbol}>
            <dt>
              <TexText text={item.symbol} />
            </dt>
          <dd>
            {item.meaning} <span className="unit">{item.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

const SPLIT_LOUNGE_NOTATIONS = [
  { symbol: "DHp", meaning: "Demanda hora pico do componente", unit: "pax/h" },
  { symbol: "Pa", meaning: "Acesso a assentos", unit: "%" },
  { symbol: "Ocup_max", meaning: "Máxima ocupação das salas", unit: "%" },
  { symbol: "Emp_s", meaning: "Espaço mínimo por passageiro sentado", unit: "m²/pax" },
  { symbol: "Toi_s", meaning: "Tempo de ocupação do passageiro sentado", unit: "min" },
  { symbol: "Emp_p", meaning: "Espaço mínimo por passageiro em pé", unit: "m²/pax" },
  { symbol: "Toi_p", meaning: "Tempo de ocupação do passageiro em pé", unit: "min" },
] as const;

export function splitLoungeNumerator(): string {
  return "DHp × [(Pa%) × Emp_s × (Toi_s/60) + (1 − Pa%) × Emp_p × (Toi_p/60)]";
}

export function SplitLoungeEquation() {
  const numerator = splitLoungeNumerator();
  return (
    <div
      className="tex"
      role="img"
      aria-label={`Ad = (${numerator}) / (Ocup_max%)`}
    >
      <span className="tex-lhs">
        <TexText text="Ad" />
      </span>
      <span className="tex-eq">=</span>
      <span className="tex-frac">
        <span className="tex-num">
          <TexText text={numerator} />
        </span>
        <span className="tex-den">
          <TexText text="Ocup_max%" />
        </span>
      </span>
    </div>
  );
}

export function SplitLoungeFormulaCard({
  connectionPairs = [],
  afterEquation,
}: {
  connectionPairs?: readonly BoardingConnectionPair[];
  afterEquation?: ReactNode;
}) {
  const sum =
    connectionPairs.length > 0
      ? `Ad + ${boardingConnectionAreaList(connectionPairs)}`
      : "";
  return (
    <div className="formula-card">
      <p className="formula-kicker">
        {connectionPairs.length > 0
          ? "Fórmulas da sala e da conexão"
          : "Fórmula do requisito de área"}
      </p>
      <SplitLoungeEquation />
      {connectionPairs.length > 0 ? (
        <BoardingConnectionEquations pairs={connectionPairs} empSuffix="_s" />
      ) : null}
      {connectionPairs.length > 0 ? (
        <div className="tex" role="img" aria-label={`Ad = ${sum}`}>
          <span className="tex-lhs">Ad</span>
          <span className="tex-eq">=</span>
          <span>
            <TexText text={sum} />
          </span>
        </div>
      ) : null}
      {afterEquation}
      <dl className="formula-legend">
        {SPLIT_LOUNGE_NOTATIONS.map((item) => (
          <div key={item.symbol}>
            <dt>
              <TexText text={item.symbol} />
            </dt>
            <dd>
              {item.meaning} <span className="unit">{item.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface FormulaCardProps {
  companions: boolean;
  hasConnection?: boolean;
  /** Saguão de embarque: a base é Ad_e. Nos demais, Ad. */
  connectionHall?: boolean;
  connectionPairs?: readonly BoardingConnectionPair[];
  arrivalsPairs?: readonly ArrivalsConnectionPair[];
  arrivalsEmpSuffix?: (pair: ArrivalsConnectionPair) => ArrivalsEmpSuffix;
  includeSeats?: boolean;
  afterEquation?: ReactNode;
}

export function FormulaCard({
  companions,
  hasConnection = false,
  connectionHall = false,
  connectionPairs = [],
  arrivalsPairs = [],
  arrivalsEmpSuffix,
  includeSeats = false,
  afterEquation,
}: FormulaCardProps) {
  if (arrivalsPairs.length > 0) {
    const sum = salaArrivalsSumDisplay(arrivalsPairs);
    const sumBody = sum.replace("Ad = ", "");
    return (
      <div className="formula-card">
        <p className="formula-kicker">Fórmulas de desembarque e conexão</p>
        <AreaEquation companions={companions} lhs="Ad_d" />
        {arrivalsPairs.map((pair) => (
          <AreaEquation
            key={pair}
            companions={false}
            lhs={arrivalsConnectionSpec(pair).areaSymbol}
            numerator={arrivalsConnectionNumerator(
              pair,
              arrivalsEmpSuffix?.(pair),
            )}
          />
        ))}
        <div className="tex" role="img" aria-label={sum}>
          <span className="tex-lhs">Ad</span>
          <span className="tex-eq">=</span>
          <span>
            <TexText text={sumBody} />
          </span>
        </div>
        {afterEquation}
        <p className="origem">
          Uma área medida. Atende se a área medida for maior ou igual à soma das
          contas. Conexões sem acompanhante.
        </p>
      </div>
    );
  }
  const linked = hasConnection || connectionPairs.length > 0;
  const sum = simpleConnectionSumDisplay(connectionPairs, connectionHall);
  const base = connectionHall ? "Ad_e" : "Ad";
  const suffix = connectionHall ? "_e" : "";
  const sumBody =
    connectionPairs.length > 0
      ? `${base} + ${boardingConnectionAreaList(connectionPairs)}`
      : `${base} + Ad_c`;
  return (
    <div className="formula-card">
      <p className="formula-kicker">
        {linked
          ? connectionHall
            ? "Fórmulas de embarque e conexão"
            : "Fórmulas do componente e da conexão"
          : "Fórmula do requisito de área"}
      </p>
      <AreaEquation
        companions={companions}
        lhs={linked ? base : "Ad"}
        numerator={linked ? areaNumerator(companions, suffix) : undefined}
      />
      {connectionPairs.length > 0 ? (
        <BoardingConnectionEquations pairs={connectionPairs} empSuffix={suffix} />
      ) : hasConnection ? (
        <ConnectionEquation empSuffix={suffix} />
      ) : null}
      {linked ? (
        <div className="tex" role="img" aria-label={sum}>
          <span className="tex-lhs">Ad</span>
          <span className="tex-eq">=</span>
          <span>
            <TexText text={sumBody} />
          </span>
        </div>
      ) : null}
      {afterEquation}
      {linked ? (
        <p className="origem">
          Uma área medida. Atende se a área medida for maior ou igual à soma das
          contas.
        </p>
      ) : null}
      <AreaLegend
        companions={companions}
        hasConnection={linked}
        includeSeats={includeSeats}
        pairs={connectionPairs}
      />
    </div>
  );
}

interface DualFormulaCardProps {
  companions: boolean;
  hasConnection?: boolean;
  connectionPairs?: readonly BoardingConnectionPair[];
  arrivalsPairs?: readonly ArrivalsConnectionPair[];
  afterEquation?: ReactNode;
}

export function DualAreaFormulaCard({
  companions,
  hasConnection = false,
  connectionPairs = [],
  arrivalsPairs = [],
  afterEquation,
}: DualFormulaCardProps) {
  const sum = dualAreaSumDisplay(hasConnection, connectionPairs, arrivalsPairs);
  return (
    <div className="formula-card">
      <p className="formula-kicker">
        {hasConnection
          ? "Fórmulas dos fluxos e da conexão"
          : "Fórmulas dos dois fluxos"}
      </p>
      <AreaEquation
        companions={companions}
        lhs="Ad_e"
        numerator={areaNumerator(companions, "_e")}
      />
      <AreaEquation
        companions={companions}
        lhs="Ad_d"
        numerator={areaNumerator(companions, "_d")}
      />
      {connectionPairs.length > 0 ? (
        <BoardingConnectionEquations pairs={connectionPairs} empSuffix="_e" />
      ) : hasConnection && arrivalsPairs.length === 0 ? (
        <ConnectionEquation empSuffix="_e" />
      ) : null}
      {arrivalsPairs.map((pair) => (
        <AreaEquation
          key={pair}
          companions={false}
          lhs={arrivalsConnectionSpec(pair).areaSymbol}
          numerator={arrivalsConnectionNumerator(pair, "_d")}
        />
      ))}
      <div className="tex" role="img" aria-label={sum}>
        <span className="tex-lhs">Ad</span>
        <span className="tex-eq">=</span>
        <span>
          <TexText text={sum.replace("Ad = ", "")} />
        </span>
      </div>
      {afterEquation}
      <p className="origem">
        Uma área medida. Atende se a área medida for maior ou igual à soma.
      </p>
    </div>
  );
}

export function MixedNatureAreaFormulaCard({
  companions,
  flowCount = 4,
  hasConnection = false,
  connectionPairs = [],
  singleFunction = false,
  arrivalsOnly = false,
  arrivalsPairs = [],
  afterEquation,
}: DualFormulaCardProps & {
  flowCount?: number;
  singleFunction?: boolean;
  arrivalsOnly?: boolean;
  arrivalsPairs?: readonly ArrivalsConnectionPair[];
}) {
  if (singleFunction) {
    const sum = singleFunctionMixedSumDisplay(connectionPairs);
    const sumBody = sum.replace("Ad = ", "");
    return (
      <div className="formula-card">
        <p className="formula-kicker">
          {connectionPairs.length > 0
            ? "Fórmulas dos dois fluxos e das conexões"
            : "Fórmulas dos dois fluxos (doméstico e internacional)"}
        </p>
        <AreaEquation
          companions={companions}
          lhs="Ad_dom"
          numerator={areaNumerator(companions, "_dom")}
        />
        <AreaEquation
          companions={companions}
          lhs="Ad_int"
          numerator={areaNumerator(companions, "_int")}
        />
        {connectionPairs.length > 0 ? (
          <BoardingConnectionEquations
            pairs={connectionPairs}
            empSuffix="_dom"
            empSuffixOf={checkinConnectionEmpSuffix}
          />
        ) : null}
        <div className="tex" role="img" aria-label={sum}>
          <span className="tex-lhs">Ad</span>
          <span className="tex-eq">=</span>
          <span>
            <TexText text={sumBody} />
          </span>
        </div>
        {afterEquation}
        <p className="origem">
          Uma área medida. Atende se a área medida for maior ou igual à soma das
          contas.
        </p>
      </div>
    );
  }
  const boardingOnly = flowCount <= 2 && !arrivalsOnly;
  const twoFlows = flowCount <= 2;
  const sum = mixedAreaSumDisplay(
    flowCount,
    hasConnection && connectionPairs.length === 0,
    arrivalsOnly,
    connectionPairs,
    arrivalsPairs,
  );
  const sumBody = sum.replace("Ad = ", "");
  return (
    <div className="formula-card">
      <p className="formula-kicker">
        {twoFlows
          ? hasConnection
            ? "Fórmulas dos fluxos (doméstico, internacional e conexões)"
            : "Fórmulas dos dois fluxos (doméstico e internacional)"
          : hasConnection
            ? "Fórmulas dos quatro fluxos e das conexões"
            : "Fórmulas dos quatro fluxos"}
      </p>
      {arrivalsOnly ? (
        <>
          <AreaEquation
            companions={companions}
            lhs="Ad_d,dom"
            numerator={areaNumerator(companions, "_d,dom")}
          />
          <AreaEquation
            companions={companions}
            lhs="Ad_d,int"
            numerator={areaNumerator(companions, "_d,int")}
          />
        </>
      ) : (
        <>
          <AreaEquation
            companions={companions}
            lhs="Ad_e,dom"
            numerator={areaNumerator(companions, "_e,dom")}
          />
          <AreaEquation
            companions={companions}
            lhs="Ad_e,int"
            numerator={areaNumerator(companions, "_e,int")}
          />
        </>
      )}
      {boardingOnly || arrivalsOnly ? null : (
        <>
          <AreaEquation
            companions={companions}
            lhs="Ad_d,dom"
            numerator={areaNumerator(companions, "_d,dom")}
          />
          <AreaEquation
            companions={companions}
            lhs="Ad_d,int"
            numerator={areaNumerator(companions, "_d,int")}
          />
        </>
      )}
      {connectionPairs.length > 0 && !arrivalsOnly ? (
        <BoardingConnectionEquations
          pairs={connectionPairs}
          empSuffix="_e,dom"
          empSuffixOf={mixedBoardingConnectionEmpSuffix}
        />
      ) : null}
      {arrivalsPairs.map((pair) => (
        <AreaEquation
          key={pair}
          companions={false}
          lhs={arrivalsConnectionSpec(pair).areaSymbol}
          numerator={arrivalsConnectionNumerator(pair)}
        />
      ))}
      <div className="tex" role="img" aria-label={sum}>
        <span className="tex-lhs">Ad</span>
        <span className="tex-eq">=</span>
        <span>
          <TexText text={sumBody} />
        </span>
      </div>
      {afterEquation}
      <p className="origem">
        Uma área medida. Atende se a área medida for maior ou igual à soma das
        contas.
      </p>
    </div>
  );
}

const SINGLE_EQUIPMENT_TERM: EquipmentTerm = {
  demandIds: ["demandaPico"],
  toi: "tempoDeOcupacao",
  tsec: "tsec",
};

interface EquipmentEquationProps {
  terms?: readonly EquipmentTerm[];
  includeTaxa?: boolean;
  lhs?: string;
}

export function EquipmentEquation({
  terms = [SINGLE_EQUIPMENT_TERM],
  includeTaxa = false,
  lhs = "N",
}: EquipmentEquationProps) {
  const shown = terms.length > 0 ? terms : [SINGLE_EQUIPMENT_TERM];
  const stacked = shown.length > 1;
  const fractions = shown.map((term, index) => (
    <span className="tex-term" key={`${term.tsec}-${term.toi}`}>
      {stacked ? (
        <span className="tex-plus">{index > 0 ? "+" : ""}</span>
      ) : null}
      <span className="tex-frac">
        <span className="tex-num">
          <TexText
            text={equipmentNumerator(
              term.demandIds,
              includeTaxa,
              term.tsec,
              term.taxa,
            )}
          />
        </span>
        <span className="tex-den">
          <TexText text={`60 × (60 + ${equipmentToiSymbol(term.toi)})`} />
        </span>
      </span>
    </span>
  ));
  const single = shown[0] ?? SINGLE_EQUIPMENT_TERM;
  return (
    <div
      className={stacked ? "tex tex-ceil tex-ceil-stack" : "tex tex-ceil"}
      role="img"
      aria-label={
        stacked
          ? equipmentFormulaDisplay(shown, includeTaxa)
          : `${lhs} = ⌈${equipmentTermDisplay(single, includeTaxa)}⌉`
      }
    >
      <span className="tex-lhs">
        <TexText text={lhs} />
      </span>
      <span className="tex-eq">=</span>
      <span className="tex-ceil-brace" aria-hidden="true">
        {stacked ? null : "⌈"}
      </span>
      {stacked ? <span className="tex-ceil-terms">{fractions}</span> : fractions}
      <span className="tex-ceil-brace tex-ceil-brace-close" aria-hidden="true">
        {stacked ? null : "⌉"}
      </span>
    </div>
  );
}

export function BeltFormulaCard({
  includeTaxa = false,
  arrivalsPairs = [],
  afterEquation,
}: {
  includeTaxa?: boolean;
  arrivalsPairs?: readonly ArrivalsConnectionPair[];
  afterEquation?: ReactNode;
}) {
  const linked = arrivalsPairs.length > 0;
  const sumBody = linked
    ? `C_d + ${arrivalsPairs.map(beltConnectionSymbol).join(" + ")}`
    : "";
  return (
    <div className="formula-card">
      <p className="formula-kicker">
        {linked
          ? "Fórmulas do tamanho mínimo de esteira"
          : "Fórmula do tamanho mínimo de esteira"}
      </p>
      <AreaEquation
        companions={false}
        lhs={linked ? "C_d" : "C"}
        numerator={beltNumerator(includeTaxa)}
      />
      {arrivalsPairs.map((pair) => (
        <AreaEquation
          key={pair}
          companions={false}
          lhs={beltConnectionSymbol(pair)}
          numerator={beltConnectionNumerator(pair, includeTaxa)}
        />
      ))}
      {linked ? (
        <div className="tex" role="img" aria-label={`C = ${sumBody}`}>
          <span className="tex-lhs">C</span>
          <span className="tex-eq">=</span>
          <span>
            <TexText text={sumBody} />
          </span>
        </div>
      ) : null}
      {afterEquation}
      <p className="origem">
        Manual de Anteprojeto. Atende se o comprimento somado das esteiras for
        maior ou igual a C. Taxa de recirculação padrão 30% e Lmp padrão 0,9 m;
        valor diferente, inclusive abaixo, pede justificativa.
      </p>
    </div>
  );
}

function checkinEquipmentOrder(terms: readonly EquipmentTerm[]): EquipmentTerm[] {
  return [...terms].sort((left, right) =>
    left.tsec === "tsecDomestico" ? -1 : right.tsec === "tsecDomestico" ? 1 : 0,
  );
}

export function EquipmentFormulaCard({
  terms = [SINGLE_EQUIPMENT_TERM],
  includeTaxa = false,
  afterEquation,
}: EquipmentEquationProps & { afterEquation?: ReactNode }) {
  const shown = terms.length > 0 ? terms : [SINGLE_EQUIPMENT_TERM];
  const split = isSplitCheckinEquipment(shown);
  return (
    <div className="formula-card">
      <p className="formula-kicker">Fórmula do requisito de equipamentos</p>
      {split ? (
        <>
          {checkinEquipmentOrder(shown).map((term) => (
            <EquipmentEquation
              key={term.tsec}
              terms={[term]}
              includeTaxa={includeTaxa}
              lhs={splitEquipmentSymbol(term.tsec)}
            />
          ))}
          <div className="tex" role="img" aria-label="N = N_dom + N_int">
            <span className="tex-lhs">
              <TexText text="N" />
            </span>
            <span className="tex-eq">=</span>
            <span>
              <TexText text="N_dom + N_int" />
            </span>
          </div>
        </>
      ) : (
        <EquipmentEquation terms={shown} includeTaxa={includeTaxa} />
      )}
      {afterEquation}
      <p className="origem">
        Inteiro mínimo, arredondado para cima. O Toi é o tempo de ocupação do
        requisito de área, em minutos; Tsec em segundos.
        {split
          ? " Cada fluxo tem o seu teto. N é a soma, sem novo arredondamento."
          : shown.length > 1
            ? " Cada fluxo usa o seu Toi e o seu Tsec; N é o teto da soma."
            : ""}
      </p>
    </div>
  );
}

const CIRCULATION_NOTATIONS = [
  { symbol: "Lt", meaning: "Largura total exigida pela demanda", unit: "m" },
  { symbol: "Le", meaning: "Largura efetiva da circulação", unit: "m" },
  { symbol: "CHp", meaning: "Capacidade teórica da circulação", unit: "pax/h" },
  { symbol: "DHp", meaning: "Demanda da hora-pico de projeto da circulação", unit: "pax/h" },
  { symbol: "PMM", meaning: "Passageiros por metro por minuto", unit: "pax/(m·min)" },
  { symbol: "Eb", meaning: "Efeito de borda, o mesmo nos dois lados", unit: "m" },
  { symbol: "Ec", meaning: "Efeito de contrafluxo da circulação", unit: "m" },
] as const;

export function CirculationFormulas() {
  return (
    <div className="formula-card">
      <p className="formula-kicker">Largura total</p>
      <div className="tex" role="img" aria-label="Lt = Le + 2 × Eb + Ec">
        <span className="tex-lhs">
          <TexText text="Lt" />
        </span>
        <span className="tex-eq">=</span>
        <TexText text="Le + 2 × Eb + Ec" />
      </div>
      <p className="formula-kicker">Largura efetiva</p>
      <div className="tex" role="img" aria-label="Le = DHp / (PMM × 60)">
        <span className="tex-lhs">
          <TexText text="Le" />
        </span>
        <span className="tex-eq">=</span>
        <span className="tex-frac">
          <span className="tex-num">
            <TexText text="DHp" />
          </span>
          <span className="tex-den">
            <TexText text="PMM × 60" />
          </span>
        </span>
      </div>
      <p className="formula-kicker">Capacidade teórica</p>
      <div
        className="tex"
        role="img"
        aria-label="CHp = (Lt medido − 2 × Eb − Ec) × PMM × 60"
      >
        <span className="tex-lhs">
          <TexText text="CHp" />
        </span>
        <span className="tex-eq">=</span>
        <TexText text="(Lt medido − 2 × Eb − Ec) × PMM × 60" />
      </div>
      <dl className="formula-legend">
        {CIRCULATION_NOTATIONS.map((item) => (
          <div key={item.symbol}>
            <dt>
              <TexText text={item.symbol} />
            </dt>
            <dd>
              {item.meaning} <span className="unit">{item.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

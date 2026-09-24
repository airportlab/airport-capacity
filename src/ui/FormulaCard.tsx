import type { ReactNode } from "react";
import {
  AREA_NOTATIONS,
  areaNumerator,
  connectionAreaNumerator,
  dualAreaSumDisplay,
  equipmentFormulaDisplay,
  equipmentNumerator,
  equipmentToiSymbol,
  arrivalsConnectionNumerator,
  beltNumerator,
  beltSumDisplay,
  mixedAreaSumDisplay,
  simpleConnectionSumDisplay,
  singleFunctionMixedSumDisplay,
} from "../domain/contracts/notations";
import type { EquipmentTerm } from "../domain/types";

export function TexText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  const pattern =
    /(?<![A-Za-zÀ-ÿ0-9])(\()?(Ad|DHp|Emp|Toi|Pa|Ocup|Tsec|v\.a|Tr|Lmp|C)(?:_([A-Za-z0-9,]+))?(\))?(?![A-Za-zÀ-ÿ0-9])/g;
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
  includeTaxa?: boolean;
  lhs?: string;
  numerator?: string;
}

export function AreaEquation({
  companions,
  includeTaxa = false,
  lhs = "Ad",
  numerator,
}: AreaEquationProps) {
  const num = numerator ?? areaNumerator(companions, includeTaxa);

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

function areaLegend(companions: boolean, includeTaxa: boolean, hasConnection: boolean) {
  return AREA_NOTATIONS.filter((item) => {
    if (item.symbol === "v.a" && !companions) return false;
    if (item.symbol === "Tu" && !includeTaxa) return false;
    if (item.symbol === "DHp_c" && !hasConnection) return false;
    return true;
  });
}

function ConnectionEquation({
  includeTaxa,
  empSuffix,
}: {
  includeTaxa: boolean;
  empSuffix: string;
}) {
  return (
    <AreaEquation
      companions={false}
      includeTaxa={includeTaxa}
      lhs="Ad_c"
      numerator={connectionAreaNumerator(includeTaxa, empSuffix)}
    />
  );
}

function AreaLegend({
  companions,
  includeTaxa,
  hasConnection,
}: {
  companions: boolean;
  includeTaxa: boolean;
  hasConnection: boolean;
}) {
  return (
    <dl className="formula-legend">
      {areaLegend(companions, includeTaxa, hasConnection).map((item) => (
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
  { symbol: "Tu", meaning: "Taxa de utilização", unit: "%" },
  { symbol: "Pa", meaning: "Acesso a assentos", unit: "%" },
  { symbol: "Ocup_max", meaning: "Máxima ocupação das salas", unit: "%" },
  { symbol: "Emp_s", meaning: "Espaço mínimo por passageiro sentado", unit: "m²/pax" },
  { symbol: "Toi_s", meaning: "Tempo de ocupação do passageiro sentado", unit: "min" },
  { symbol: "Emp_p", meaning: "Espaço mínimo por passageiro em pé", unit: "m²/pax" },
  { symbol: "Toi_p", meaning: "Tempo de ocupação do passageiro em pé", unit: "min" },
] as const;

export function splitLoungeNumerator(includeTaxa = false): string {
  const demand = includeTaxa ? "DHp × Tu" : "DHp";
  return `${demand} × [(Pa%) × Emp_s × (Toi_s/60) + (1 − Pa%) × Emp_p × (Toi_p/60)]`;
}

export function SplitLoungeEquation({
  includeTaxa = false,
}: {
  includeTaxa?: boolean;
}) {
  const numerator = splitLoungeNumerator(includeTaxa);
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
  includeTaxa = false,
  afterEquation,
}: {
  includeTaxa?: boolean;
  afterEquation?: ReactNode;
}) {
  return (
    <div className="formula-card">
      <p className="formula-kicker">Fórmula do requisito de área</p>
      <SplitLoungeEquation includeTaxa={includeTaxa} />
      {afterEquation}
      <dl className="formula-legend">
        {SPLIT_LOUNGE_NOTATIONS.filter(
          (item) => item.symbol !== "Tu" || includeTaxa,
        ).map((item) => (
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
  includeTaxa?: boolean;
  hasConnection?: boolean;
  afterEquation?: ReactNode;
}

export function FormulaCard({
  companions,
  includeTaxa = false,
  hasConnection = false,
  afterEquation,
}: FormulaCardProps) {
  const sum = simpleConnectionSumDisplay();
  return (
    <div className="formula-card">
      <p className="formula-kicker">
        {hasConnection
          ? "Fórmulas de embarque e conexão"
          : "Fórmula do requisito de área"}
      </p>
      <AreaEquation
        companions={companions}
        includeTaxa={includeTaxa}
        lhs={hasConnection ? "Ad_e" : "Ad"}
      />
      {hasConnection ? (
        <>
          <ConnectionEquation
            includeTaxa={includeTaxa}
            empSuffix=""
          />
          <div className="tex" role="img" aria-label={sum}>
            <span className="tex-lhs">Ad</span>
            <span className="tex-eq">=</span>
            <span>
              <TexText text="Ad_e + Ad_c" />
            </span>
          </div>
        </>
      ) : null}
      {afterEquation}
      {hasConnection ? (
        <p className="origem">
          Uma área medida. Atende se a área medida for maior ou igual à soma das
          contas.
        </p>
      ) : null}
      <AreaLegend
        companions={companions}
        includeTaxa={includeTaxa}
        hasConnection={hasConnection}
      />
    </div>
  );
}

interface DualFormulaCardProps {
  companions: boolean;
  includeTaxa?: boolean;
  hasConnection?: boolean;
  afterEquation?: ReactNode;
}

export function DualAreaFormulaCard({
  companions,
  includeTaxa = false,
  hasConnection = false,
  afterEquation,
}: DualFormulaCardProps) {
  const sum = dualAreaSumDisplay(hasConnection);
  return (
    <div className="formula-card">
      <p className="formula-kicker">
        {hasConnection
          ? "Fórmulas dos fluxos e da conexão"
          : "Fórmulas dos dois fluxos"}
      </p>
      <AreaEquation
        companions={companions}
        includeTaxa={includeTaxa}
        lhs="Ad_e"
        numerator={areaNumerator(companions, includeTaxa, "_e")}
      />
      <AreaEquation
        companions={companions}
        includeTaxa={includeTaxa}
        lhs="Ad_d"
        numerator={areaNumerator(companions, includeTaxa, "_d")}
      />
      {hasConnection ? (
        <ConnectionEquation
          includeTaxa={includeTaxa}
          empSuffix="_e"
        />
      ) : null}
      <div className="tex" role="img" aria-label={sum}>
        <span className="tex-lhs">Ad</span>
        <span className="tex-eq">=</span>
        <span>
          <TexText
            text={hasConnection ? "Ad_e + Ad_d + Ad_c" : "Ad_e + Ad_d"}
          />
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
  includeTaxa = false,
  flowCount = 4,
  hasConnection = false,
  singleFunction = false,
  arrivalsOnly = false,
  afterEquation,
}: DualFormulaCardProps & {
  flowCount?: number;
  singleFunction?: boolean;
  arrivalsOnly?: boolean;
}) {
  if (singleFunction) {
    const sum = singleFunctionMixedSumDisplay();
    return (
      <div className="formula-card">
        <p className="formula-kicker">
          Fórmulas dos dois fluxos (doméstico e internacional)
        </p>
        <AreaEquation
          companions={companions}
          includeTaxa={includeTaxa}
          lhs="Ad_dom"
          numerator={areaNumerator(companions, includeTaxa, "_dom")}
        />
        <AreaEquation
          companions={companions}
          includeTaxa={includeTaxa}
          lhs="Ad_int"
          numerator={areaNumerator(companions, includeTaxa, "_int")}
        />
        <div className="tex" role="img" aria-label={sum}>
          <span className="tex-lhs">Ad</span>
          <span className="tex-eq">=</span>
          <span>
            <TexText text="Ad_dom + Ad_int" />
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
  const num = areaNumerator(companions, includeTaxa);
  const boardingOnly = flowCount <= 2 && !arrivalsOnly;
  const twoFlows = flowCount <= 2;
  const sum = mixedAreaSumDisplay(flowCount, hasConnection, arrivalsOnly);
  const sumBody = arrivalsOnly
    ? hasConnection
      ? "Ad_d,dom + Ad_d,int + Ad_c,dom + Ad_c,int"
      : "Ad_d,dom + Ad_d,int"
    : boardingOnly
      ? hasConnection
        ? "Ad_e,dom + Ad_e,int + Ad_c"
        : "Ad_e,dom + Ad_e,int"
      : hasConnection
        ? "Ad_e,dom + Ad_e,int + Ad_d,dom + Ad_d,int + Ad_c"
        : "Ad_e,dom + Ad_e,int + Ad_d,dom + Ad_d,int";
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
            includeTaxa={includeTaxa}
            lhs="Ad_d,dom"
            numerator={num}
          />
          <AreaEquation
            companions={companions}
            includeTaxa={includeTaxa}
            lhs="Ad_d,int"
            numerator={num}
          />
        </>
      ) : (
        <>
          <AreaEquation
            companions={companions}
            includeTaxa={includeTaxa}
            lhs="Ad_e,dom"
            numerator={num}
          />
          <AreaEquation
            companions={companions}
            includeTaxa={includeTaxa}
            lhs="Ad_e,int"
            numerator={num}
          />
        </>
      )}
      {boardingOnly || arrivalsOnly ? null : (
        <>
          <AreaEquation
            companions={companions}
            includeTaxa={includeTaxa}
            lhs="Ad_d,dom"
            numerator={num}
          />
          <AreaEquation
            companions={companions}
            includeTaxa={includeTaxa}
            lhs="Ad_d,int"
            numerator={num}
          />
        </>
      )}
      {hasConnection && !arrivalsOnly ? (
        <ConnectionEquation
          includeTaxa={includeTaxa}
          empSuffix="_e,dom"
        />
      ) : null}
      {arrivalsOnly && hasConnection ? (
        <>
          <AreaEquation
            companions={false}
            includeTaxa={includeTaxa}
            lhs="Ad_c,dom"
            numerator={arrivalsConnectionNumerator("dom", includeTaxa)}
          />
          <AreaEquation
            companions={false}
            includeTaxa={includeTaxa}
            lhs="Ad_c,int"
            numerator={arrivalsConnectionNumerator("int", includeTaxa)}
          />
        </>
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

const SINGLE_EQUIPMENT_TERM: EquipmentTerm = {
  demandIds: ["demandaPico"],
  toi: "tempoDeOcupacao",
  tsec: "tsec",
};

interface EquipmentEquationProps {
  terms?: readonly EquipmentTerm[];
  includeTaxa?: boolean;
}

export function EquipmentEquation({
  terms = [SINGLE_EQUIPMENT_TERM],
  includeTaxa = false,
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
            text={equipmentNumerator(term.demandIds, includeTaxa, term.tsec)}
          />
        </span>
        <span className="tex-den">
          <TexText text={`60 × (60 + ${equipmentToiSymbol(term.toi)})`} />
        </span>
      </span>
    </span>
  ));
  return (
    <div
      className={stacked ? "tex tex-ceil tex-ceil-stack" : "tex tex-ceil"}
      role="img"
      aria-label={equipmentFormulaDisplay(shown, includeTaxa)}
    >
      <span className="tex-lhs">N</span>
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
  mixed = false,
  afterEquation,
}: {
  mixed?: boolean;
  afterEquation?: ReactNode;
}) {
  if (mixed) {
    const sum = beltSumDisplay();
    return (
      <div className="formula-card">
        <p className="formula-kicker">
          Fórmula do tamanho mínimo de esteira
        </p>
        <AreaEquation
          companions={false}
          lhs="C_d,dom"
          numerator={beltNumerator("_d,dom")}
        />
        <AreaEquation
          companions={false}
          lhs="C_d,int"
          numerator={beltNumerator("_d,int")}
        />
        <div className="tex" role="img" aria-label={sum}>
          <span className="tex-lhs">C</span>
          <span className="tex-eq">=</span>
          <span>
            <TexText text="C_d,dom + C_d,int" />
          </span>
        </div>
        {afterEquation}
        <p className="origem">
          Manual de Anteprojeto. Um Tr e um Lmp da sala; cada fluxo entra com o
          seu DHp e o seu Toi. Atende se o comprimento somado das esteiras for
          maior ou igual a C. Tr mínimo 30%; Lmp mínimo 0,9 m.
        </p>
      </div>
    );
  }
  return (
    <div className="formula-card">
      <p className="formula-kicker">Fórmula do tamanho mínimo de esteira</p>
      <AreaEquation companions={false} lhs="C" numerator={beltNumerator()} />
      {afterEquation}
      <p className="origem">
        Manual de Anteprojeto. Atende se o comprimento somado das esteiras for
        maior ou igual a C. Tr mínimo 30%; Lmp mínimo 0,9 m.
      </p>
    </div>
  );
}

export function EquipmentFormulaCard({
  terms = [SINGLE_EQUIPMENT_TERM],
  includeTaxa = false,
  afterEquation,
}: EquipmentEquationProps & { afterEquation?: ReactNode }) {
  const shown = terms.length > 0 ? terms : [SINGLE_EQUIPMENT_TERM];
  return (
    <div className="formula-card">
      <p className="formula-kicker">Fórmula do requisito de equipamentos</p>
      <EquipmentEquation terms={shown} includeTaxa={includeTaxa} />
      {afterEquation}
      <p className="origem">
        Inteiro mínimo, arredondado para cima. O Toi é o tempo de ocupação do
        requisito de área, em minutos; Tsec em segundos.
        {shown.length > 1
          ? " Cada fluxo usa o seu Toi e o seu Tsec; N é o teto da soma."
          : ""}
      </p>
    </div>
  );
}

import type { ReactNode } from "react";
import {
  AREA_NOTATIONS,
  areaNumerator,
  dualAreaSumDisplay,
  equipmentFormulaDisplay,
  equipmentNumerator,
  mixedAreaSumDisplay,
} from "../domain/contracts/notations";

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
      <span className="tex-lhs">{lhs}</span>
      <span className="tex-eq">=</span>
      <span className="tex-frac">
        <span className="tex-num">{num}</span>
        <span className="tex-den">60</span>
      </span>
    </div>
  );
}

interface FormulaCardProps {
  companions: boolean;
  includeTaxa?: boolean;
  afterEquation?: ReactNode;
}

export function FormulaCard({
  companions,
  includeTaxa = false,
  afterEquation,
}: FormulaCardProps) {
  const notations = AREA_NOTATIONS.filter((item) => {
    if (item.symbol === "v.a" && !companions) return false;
    if (item.symbol === "Tu" && !includeTaxa) return false;
    return true;
  });

  return (
    <div className="formula-card">
      <p className="formula-kicker">Fórmula do requisito de área</p>
      <AreaEquation companions={companions} includeTaxa={includeTaxa} />
      {afterEquation}
      <dl className="formula-legend">
        {notations.map((item) => (
          <div key={item.symbol}>
            <dt>{item.symbol}</dt>
            <dd>
              {item.meaning} <span className="unit">{item.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface DualFormulaCardProps {
  companions: boolean;
  includeTaxa?: boolean;
  afterEquation?: ReactNode;
}

export function DualAreaFormulaCard({
  companions,
  includeTaxa = false,
  afterEquation,
}: DualFormulaCardProps) {
  return (
    <div className="formula-card">
      <p className="formula-kicker">Fórmulas dos dois fluxos</p>
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
      <div className="tex" role="img" aria-label={dualAreaSumDisplay()}>
        <span className="tex-lhs">Ad</span>
        <span className="tex-eq">=</span>
        <span>Ad_e + Ad_d</span>
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
  afterEquation,
}: DualFormulaCardProps & { flowCount?: number }) {
  const num = areaNumerator(companions, includeTaxa);
  const boardingOnly = flowCount <= 2;
  const sum = mixedAreaSumDisplay(flowCount);
  return (
    <div className="formula-card">
      <p className="formula-kicker">
        {boardingOnly
          ? "Fórmulas dos dois fluxos (doméstico e internacional)"
          : "Fórmulas dos quatro fluxos"}
      </p>
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
      {boardingOnly ? null : (
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
      <div className="tex" role="img" aria-label={sum}>
        <span className="tex-lhs">Ad</span>
        <span className="tex-eq">=</span>
        <span>
          {boardingOnly
            ? "Ad_e,dom + Ad_e,int"
            : "Ad_e,dom + Ad_e,int + Ad_d,dom + Ad_d,int"}
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

interface EquipmentEquationProps {
  demandCount?: number;
  mixedNature?: boolean;
  includeTaxa?: boolean;
}

export function EquipmentEquation({
  demandCount = 1,
  mixedNature = false,
  includeTaxa = false,
}: EquipmentEquationProps) {
  const numerator = equipmentNumerator(demandCount, mixedNature, includeTaxa);
  return (
    <div
      className="tex tex-ceil"
      role="img"
      aria-label={equipmentFormulaDisplay(demandCount, mixedNature, includeTaxa)}
    >
      <span className="tex-lhs">N</span>
      <span className="tex-eq">=</span>
      <span className="tex-ceil-brace" aria-hidden="true">
        ⌈
      </span>
      <span className="tex-frac">
        <span className="tex-num">{numerator}</span>
        <span className="tex-den">60 × (60 + Toi)</span>
      </span>
      <span className="tex-ceil-brace" aria-hidden="true">
        ⌉
      </span>
    </div>
  );
}

export function EquipmentFormulaCard({
  demandCount = 1,
  mixedNature = false,
  includeTaxa = false,
  afterEquation,
}: EquipmentEquationProps & { afterEquation?: ReactNode }) {
  return (
    <div className="formula-card">
      <p className="formula-kicker">Fórmula do requisito de equipamentos</p>
      <EquipmentEquation
        demandCount={demandCount}
        mixedNature={mixedNature}
        includeTaxa={includeTaxa}
      />
      {afterEquation}
      <p className="origem">
        Inteiro mínimo, arredondado para cima. Toi do equipamento em minutos;
        tsec em segundos.
        {demandCount > 1
          ? " A demanda no recinto é a soma dos DHp, sem fundi-los."
          : ""}
      </p>
    </div>
  );
}

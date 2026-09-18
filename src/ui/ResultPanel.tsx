import type { ComponentContract, Evaluation, ResultId } from "../domain/types";
import { formatNumber, formatSaturacao } from "./format";

interface RequirementResultsProps {
  contract: ComponentContract;
  evaluation: Evaluation;
}

function isAreaFormula(id: ResultId): boolean {
  return id === "assentosMinimos" || id.startsWith("areaMinima");
}

function isEquipmentFormula(id: ResultId): boolean {
  return id === "numeroMinimoEquipamentos";
}

function ResultValues({
  contract,
  evaluation,
  match,
}: RequirementResultsProps & { match: (id: ResultId) => boolean }) {
  const formulas = contract.formulas.filter((formula) => match(formula.id));
  if (formulas.length === 0) return null;

  return (
    <ul className="result-list">
      {formulas.map((formula) => (
        <li key={formula.id}>
          <span className="result-label">{formula.label}</span>
          <strong>
            {formatNumber(evaluation.results[formula.id] ?? Number.NaN)}{" "}
            <span className="unit">{formula.unit}</span>
          </strong>
        </li>
      ))}
    </ul>
  );
}

function StatusBlock({
  check,
}: {
  check: Evaluation["areaCheck"];
}) {
  if (!check) return null;

  return (
    <div className={`status ${check.atende ? "ok" : "fail"}`} role="status">
      <p className="status-label">{check.label}</p>
      <p>{formatSaturacao(check.saturacao)}</p>
    </div>
  );
}

function RequirementResults({
  contract,
  evaluation,
  match,
  check,
}: RequirementResultsProps & {
  match: (id: ResultId) => boolean;
  check: Evaluation["areaCheck"];
}) {
  const hasValues = contract.formulas.some((formula) => match(formula.id));
  if (!hasValues && !check) return null;

  return (
    <div className="requirement-results">
      <ResultValues
        contract={contract}
        evaluation={evaluation}
        match={match}
      />
      <StatusBlock check={check} />
    </div>
  );
}

export function AreaResults({
  contract,
  evaluation,
}: RequirementResultsProps) {
  return (
    <RequirementResults
      contract={contract}
      evaluation={evaluation}
      match={isAreaFormula}
      check={evaluation.areaCheck}
    />
  );
}

export function EquipmentResults({
  contract,
  evaluation,
}: RequirementResultsProps) {
  return (
    <RequirementResults
      contract={contract}
      evaluation={evaluation}
      match={isEquipmentFormula}
      check={evaluation.equipmentCheck}
    />
  );
}

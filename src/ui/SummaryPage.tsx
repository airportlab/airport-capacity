import {
  airportOptionLabel,
  airportsByGroup,
  type AirportId,
} from "../domain/airports";
import { UNOFFICIAL_NOTICE } from "../domain/notice";
import { journeyLeg, journeyRank } from "../domain/templates/organs";
import type { RequirementCheckResult, ComponentContract, ComponentId, Evaluation } from "../domain/types";
import {
  evaluationMonths,
  formatAirportName,
  formatEvaluationPeriod,
  formatReportDate,
} from "./format";

interface SummaryPageProps {
  airportName: string;
  onAirportNameChange: (value: string) => void;
  airportId: AirportId;
  onAirportChange: (id: AirportId) => void;
  evaluationMonth: number | null;
  evaluationYear: number | null;
  onEvaluationMonthChange: (month: number | null) => void;
  onEvaluationYearChange: (year: number | null) => void;
  sourceNote: string;
  contracts: ComponentContract[];
  kinds: Record<ComponentId, string | undefined>;
  evaluations: Record<ComponentId, Evaluation>;
  invalidIds: ComponentId[];
  onOpenComponent: (id: ComponentId) => void;
  onRegister: () => void;
  onLoadExample: () => void;
  onRemove: (id: ComponentId) => void;
  onRemoveAll: () => void;
}

export function complianceLabel(
  check: RequirementCheckResult | null | undefined,
): string {
  if (!check) return "—";
  return check.atende ? "Atende" : "Não atende";
}

export function complianceClass(
  check: RequirementCheckResult | null | undefined,
): string {
  if (!check) return "";
  return check.atende ? "ok" : "fail";
}

const LEG_LABEL = {
  embarque: "Embarque",
  desembarque: "Desembarque",
  outros: "Outros",
} as const;

type JourneyGroup = {
  leg: keyof typeof LEG_LABEL;
  contracts: ComponentContract[];
};

function journeyGroups(
  contracts: ComponentContract[],
  kinds: Record<ComponentId, string | undefined>,
): JourneyGroup[] {
  const ordered = [...contracts].sort(
    (a, b) => journeyRank(kinds[a.id]) - journeyRank(kinds[b.id]),
  );
  const groups: JourneyGroup[] = [];
  for (const contract of ordered) {
    const leg = journeyLeg(kinds[contract.id]) ?? "outros";
    const last = groups[groups.length - 1];
    if (last?.leg === leg) last.contracts.push(contract);
    else groups.push({ leg, contracts: [contract] });
  }
  return groups;
}

export function equipmentColumn(
  evaluation: Evaluation | null | undefined,
): { title: string; check: RequirementCheckResult } | null {
  if (!evaluation) return null;
  if (evaluation.equipmentCheck) {
    return { title: "Equipamentos", check: evaluation.equipmentCheck };
  }
  if (evaluation.esteiraCheck) {
    return { title: "Esteira", check: evaluation.esteiraCheck };
  }
  return null;
}

function failureClause(count: number, noun: string): string {
  return `${count} não atende${count === 1 ? "" : "m"} ${noun}`;
}

export function requirementFailureTally(
  contracts: ComponentContract[],
  evaluations: Record<ComponentId, Evaluation>,
  invalidIds: readonly ComponentId[] = [],
): string {
  const skipped = new Set(invalidIds);
  let failedArea = 0;
  let failedEquipment = 0;
  let failedEsteira = 0;
  for (const contract of contracts) {
    const evaluation = evaluations[contract.id];
    if (!evaluation) continue;
    if (!skipped.has(contract.id) && evaluation.areaCheck?.atende === false) {
      failedArea += 1;
    }
    if (evaluation.equipmentCheck?.atende === false) failedEquipment += 1;
    if (evaluation.esteiraCheck?.atende === false) failedEsteira += 1;
  }
  return [
    failureClause(failedArea, "área"),
    failureClause(failedEquipment, "equipamentos"),
    failureClause(failedEsteira, "esteira"),
  ].join(" · ");
}

function rowTone(evaluation: Evaluation | undefined): string {
  if (!evaluation) return "";
  const checks = [
    evaluation.areaCheck,
    evaluation.equipmentCheck,
    evaluation.esteiraCheck,
  ].filter((item): item is RequirementCheckResult => item != null);
  if (checks.length === 0) return "";
  return checks.every((item) => item.atende) ? "ok" : "fail";
}

export function SummaryPage({
  airportName,
  onAirportNameChange,
  airportId,
  onAirportChange,
  evaluationMonth,
  evaluationYear,
  onEvaluationMonthChange,
  onEvaluationYearChange,
  sourceNote,
  contracts,
  kinds,
  evaluations,
  invalidIds,
  onOpenComponent,
  onRegister,
  onLoadExample,
  onRemove,
  onRemoveAll,
}: SummaryPageProps) {
  const today = formatReportDate(new Date());
  const evaluationPeriod = formatEvaluationPeriod(
    evaluationMonth,
    evaluationYear,
  );
  const tally = requirementFailureTally(contracts, evaluations, invalidIds);
  const groups = journeyGroups(contracts, kinds);

  return (
    <div className="summary-page">
      <section className="panel summary-identity">
        <h2>Identificação</h2>
        <p className="panel-lead">{UNOFFICIAL_NOTICE}</p>
        <div className="fields">
          <div className="summary-identity-pair">
            <label className="field">
              <span className="field-label">Aeroporto</span>
              <select
                value={airportId}
                onChange={(event) =>
                  onAirportChange(event.target.value as AirportId)
                }
              >
                {airportsByGroup().map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.airports.map((item) => (
                      <option key={item.id} value={item.id}>
                        {airportOptionLabel(item)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Nome do relatório</span>
              <input
                value={airportName}
                onChange={(event) => onAirportNameChange(event.target.value)}
                placeholder="Aeroporto"
              />
            </label>
          </div>
          <div className="summary-identity-pair">
            <label className="field">
              <span className="field-label">Mês de início</span>
              <select
                value={evaluationMonth ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  onEvaluationMonthChange(raw === "" ? null : Number(raw));
                }}
              >
                <option value="">—</option>
                {evaluationMonths.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Ano de início</span>
              <input
                inputMode="numeric"
                value={evaluationYear ?? ""}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                  const year = digits === "" ? null : Number(digits);
                  onEvaluationYearChange(year != null && year >= 1 ? year : null);
                }}
              />
            </label>
          </div>
          <p className="summary-date">
            Período de avaliação: <strong>{evaluationPeriod}</strong>
          </p>
          <p className="summary-date">{sourceNote}</p>
        </div>
        <p className="summary-date">
          Data do relatório: <strong>{today}</strong>
        </p>
        <p className="summary-tally">
          {formatAirportName(airportName)} · {tally}
        </p>
        <div className="actions">
          <button type="button" className="accent" onClick={onRegister}>
            Cadastrar componente
          </button>
          <button type="button" className="ghost" onClick={onLoadExample}>
            Carregar exemplo fictício
          </button>
          <button
            type="button"
            className="ghost"
            onClick={onRemoveAll}
            disabled={contracts.length === 0}
          >
            Apagar todos os componentes
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="resumo-status">
        <h2 id="resumo-status">Componentes Operacionais</h2>
        {contracts.length === 0 ? (
          <p className="panel-lead">
            Nenhum componente operacional cadastrado. Cadastre um tipo da
            lista do PMD ou carregue o exemplo fictício (componentes,
            variantes e circulações ilustrativos). Os números não são DHp nem
            áreas medidas do aeroporto selecionado.
          </p>
        ) : (
          <>
        <div className="summary-cards">
          {groups.map((group) => (
            <section key={group.leg} className="summary-leg">
              <h3 className="summary-leg-label">{LEG_LABEL[group.leg]}</h3>
              {group.contracts.map((contract) => {
                const evaluation = evaluations[contract.id];
                const column = equipmentColumn(evaluation);
                const invalid = invalidIds.includes(contract.id);
                return (
                  <article
                    key={contract.id}
                    className={`summary-card ${invalid ? "fail" : rowTone(evaluation)}`}
                  >
                    <h3>{contract.title}</h3>
                    {invalid ? (
                      <p className="status-label fail">
                        Não vale para este contrato
                      </p>
                    ) : null}
                    {!invalid && evaluation?.areaCheck ? (
                      <p className={`status-label ${complianceClass(evaluation.areaCheck)}`}>
                        Área: {complianceLabel(evaluation.areaCheck)}
                      </p>
                    ) : null}
                    {!invalid && column ? (
                      <p
                        className={`status-label ${complianceClass(column.check)}`}
                      >
                        {column.title}: {complianceLabel(column.check)}
                      </p>
                    ) : null}
                    {!invalid && !evaluation?.areaCheck && !column ? (
                      <p className="status-label">Sem requisitos</p>
                    ) : null}
                    <div className="summary-card-actions">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onOpenComponent(contract.id)}
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onRemove(contract.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
        <div className="summary-table-wrap">
          <table className="summary-table">
            <thead>
              <tr>
                <th>Componente</th>
                <th>Área</th>
                <th>Equipamentos</th>
                <th>Esteira</th>
                <th></th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.leg}>
                <tr className="summary-leg-row">
                  <th colSpan={5} scope="rowgroup">
                    {LEG_LABEL[group.leg]}
                  </th>
                </tr>
                {group.contracts.map((contract) => {
                  const evaluation = evaluations[contract.id];
                  return (
                    <tr key={contract.id} className={rowTone(evaluation)}>
                      <td>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => onOpenComponent(contract.id)}
                        >
                          {contract.title}
                        </button>
                      </td>
                      <td className={complianceClass(evaluation?.areaCheck)}>
                        {complianceLabel(evaluation?.areaCheck)}
                      </td>
                      <td className={complianceClass(evaluation?.equipmentCheck)}>
                        {complianceLabel(evaluation?.equipmentCheck)}
                      </td>
                      <td className={complianceClass(evaluation?.esteiraCheck)}>
                        {complianceLabel(evaluation?.esteiraCheck)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => onRemove(contract.id)}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
          </>
        )}
      </section>
    </div>
  );
}

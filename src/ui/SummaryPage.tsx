import {
  airportOptionLabel,
  airportsByGroup,
  type AirportId,
} from "../domain/airports";
import { UNOFFICIAL_NOTICE } from "../domain/notice";
import type { RequirementCheckResult, ComponentContract, ComponentId, Evaluation } from "../domain/types";
import { formatAirportName, formatReportDate } from "./format";

interface SummaryPageProps {
  airportName: string;
  onAirportNameChange: (value: string) => void;
  airportId: AirportId;
  onAirportChange: (id: AirportId) => void;
  sourceNote: string;
  contracts: ComponentContract[];
  evaluations: Record<ComponentId, Evaluation>;
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

function rowTone(evaluation: Evaluation | undefined): string {
  if (!evaluation) return "";
  const checks = [evaluation.areaCheck, evaluation.equipmentCheck].filter(
    (item): item is RequirementCheckResult => item != null,
  );
  if (checks.length === 0) return "";
  return checks.every((item) => item.atende) ? "ok" : "fail";
}

export function SummaryPage({
  airportName,
  onAirportNameChange,
  airportId,
  onAirportChange,
  sourceNote,
  contracts,
  evaluations,
  onOpenComponent,
  onRegister,
  onLoadExample,
  onRemove,
  onRemoveAll,
}: SummaryPageProps) {
  const today = formatReportDate(new Date());
  const failedArea = contracts.filter(
    (contract) => evaluations[contract.id]?.areaCheck?.atende === false,
  ).length;
  const failedEquipment = contracts.filter(
    (contract) => evaluations[contract.id]?.equipmentCheck?.atende === false,
  ).length;

  return (
    <div className="summary-page">
      <section className="panel summary-identity">
        <h2>Identificação</h2>
        <p className="panel-lead">{UNOFFICIAL_NOTICE}</p>
        <div className="fields">
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
          <p className="summary-date">{sourceNote}</p>
          <label className="field">
            <span className="field-label">Nome do relatório</span>
            <input
              value={airportName}
              onChange={(event) => onAirportNameChange(event.target.value)}
              placeholder="Aeroporto"
            />
          </label>
        </div>
        <p className="summary-date">
          Data do relatório: <strong>{today}</strong>
        </p>
        <p className="summary-tally">
          {formatAirportName(airportName)} · {failedArea} não atende
          {failedArea === 1 ? "" : "m"} área · {failedEquipment} não atende
          {failedEquipment === 1 ? "" : "m"} equipamentos
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
        <h2 id="resumo-status">Requisitos do PMD</h2>
        {contracts.length === 0 ? (
          <p className="panel-lead">
            Nenhum componente operacional cadastrado. Cadastre um tipo da
            lista do PMD ou carregue o exemplo fictício (um tipo de cada
            linha). Os números são ilustrativos — não são DHp nem áreas
            medidas do aeroporto selecionado.
          </p>
        ) : (
          <>
        <div className="summary-cards">
          {contracts.map((contract) => {
            const evaluation = evaluations[contract.id];
            return (
              <article
                key={contract.id}
                className={`summary-card ${rowTone(evaluation)}`}
              >
                <h3>{contract.title}</h3>
                {evaluation?.areaCheck ? (
                  <p className={`status-label ${complianceClass(evaluation.areaCheck)}`}>
                    Área: {complianceLabel(evaluation.areaCheck)}
                  </p>
                ) : null}
                {evaluation?.equipmentCheck ? (
                  <p
                    className={`status-label ${complianceClass(evaluation.equipmentCheck)}`}
                  >
                    Equipamentos: {complianceLabel(evaluation.equipmentCheck)}
                  </p>
                ) : null}
                {!evaluation?.areaCheck && !evaluation?.equipmentCheck ? (
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
        </div>
        <div className="summary-table-wrap">
          <table className="summary-table">
            <thead>
              <tr>
                <th>Componente</th>
                <th>Área</th>
                <th>Equipamentos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => {
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
          </table>
        </div>
          </>
        )}
      </section>
    </div>
  );
}

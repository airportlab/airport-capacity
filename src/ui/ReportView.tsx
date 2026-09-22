import type { AirportSource } from "../domain/airports";
import type {
  ComponentContract,
  ComponentId,
  ComponentParamId,
  Evaluation,
  PdfKind,
  RegistryEntry,
} from "../domain/types";
import { contractHasConnection, isDualContract } from "../domain/contracts/factory";
import { UNOFFICIAL_NOTICE } from "../domain/notice";
import { usesAreaTaxa } from "../domain/types";
import { roundLabel, sourceCitation } from "../domain/pmd";
import { formatAirportName, formatNumber, formatReportDate, formatSaturacao } from "./format";
import { AreaEquation, TexText } from "./FormulaCard";
import { PmdTable } from "./PmdTable";
import { complianceClass, complianceLabel } from "./SummaryPage";

interface ReportViewProps {
  kind: PdfKind;
  airportName: string;
  airport: AirportSource;
  capturedAt: Date;
  registry: RegistryEntry[];
  contracts: ComponentContract[];
  evaluations: Record<ComponentId, Evaluation>;
  componentOrigens: Record<ComponentId, Record<ComponentParamId, string>>;
}

export function ReportView({
  kind,
  airportName,
  airport,
  capturedAt,
  registry,
  contracts,
  evaluations,
  componentOrigens,
}: ReportViewProps) {
  const generated = formatReportDate(capturedAt);
  const name = formatAirportName(airportName);
  const failedArea = contracts.filter(
    (contract) => evaluations[contract.id]?.areaCheck?.atende === false,
  ).length;
  const failedEquipment = contracts.filter(
    (contract) => evaluations[contract.id]?.equipmentCheck?.atende === false,
  ).length;

  return (
    <article className="report" data-kind={kind}>
      <header className="report-header">
        <p className="report-kicker">
          Capacidade aeroportuária · {airport.icao} · {roundLabel(airport.roundId)}
        </p>
        <h1>{name}</h1>
        <p className="report-meta">
          {generated} · Relatório {kind === "completo" ? "completo" : "simplificado"}
        </p>
        <p className="report-meta">{sourceCitation(airport)}</p>
        <p className="report-meta">{UNOFFICIAL_NOTICE}</p>
        <p className="report-tally">
          {failedArea} não atende{failedArea === 1 ? "" : "m"} área ·{" "}
          {failedEquipment} não atende{failedEquipment === 1 ? "" : "m"} equipamentos
        </p>
      </header>

      <section>
        <h2>Resumo — o que atende e o que não atende</h2>
        <table>
          <thead>
            <tr>
              <th>Componente</th>
              <th>Área</th>
              <th>Equipamentos</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => {
              const evaluation = evaluations[contract.id];
              return (
                <tr key={contract.id}>
                  <td>{contract.title}</td>
                  <td className={complianceClass(evaluation?.areaCheck)}>
                    {complianceLabel(evaluation?.areaCheck)}
                  </td>
                  <td className={complianceClass(evaluation?.equipmentCheck)}>
                    {complianceLabel(evaluation?.equipmentCheck)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {kind === "completo" ? (
        <>
          <section>
            <h2>
              Parâmetros mínimos de dimensionamento — {roundLabel(airport.roundId)}
            </h2>
            <PmdTable airport={airport} registry={registry} />
          </section>

          {contracts.map((contract) => (
            <ComponentSections
              key={contract.id}
              contract={contract}
              evaluation={evaluations[contract.id]}
              origens={componentOrigens[contract.id] ?? {}}
              observacoes={
                registry.find((item) => item.id === contract.id)?.observacoes
              }
            />
          ))}
        </>
      ) : null}
    </article>
  );
}

function ComponentSections({
  contract,
  evaluation,
  origens,
  observacoes,
}: {
  contract: ComponentContract;
  evaluation: Evaluation;
  origens: Partial<Record<ComponentParamId, string>>;
  observacoes?: string;
}) {
  const note = observacoes?.trim() ?? "";
  return (
    <>
      <section>
        <h2>Entradas · {contract.title}</h2>
        <table>
          <thead>
            <tr>
              <th>Campo</th>
              <th>Valor</th>
              <th>Unidade</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>
            {contract.params.map((field) => (
              <tr key={field.id}>
                <td>{field.label}</td>
                <td>{formatNumber(evaluation.inputs[field.id])}</td>
                <td>{field.unit}</td>
                <td>
                  {field.id === "demandaPicoConexao"
                    ? field.origem
                    : (origens[field.id] ?? field.origem)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {note ? (
          <p>
            <strong>Observações.</strong> {note}
          </p>
        ) : null}
      </section>

      <section>
        <h2>Resultados · {contract.title}</h2>
        <table>
          <thead>
            <tr>
              <th>Indicador</th>
              <th>Valor</th>
              <th>Unidade</th>
              <th>Fórmula</th>
            </tr>
          </thead>
          <tbody>
            {contract.formulas.map((formula) => (
              <tr key={formula.id}>
                <td>{formula.label}</td>
                <td>
                  {formatNumber(evaluation.results[formula.id] ?? Number.NaN)}
                </td>
                <td>{formula.unit}</td>
                <td>
                  {formula.id === "areaMinima" &&
                  !(isDualContract(contract) || contractHasConnection(contract))
                    ? (
                        <AreaEquation
                          companions={
                            contract.requirements.area?.companions === true
                          }
                          includeTaxa={usesAreaTaxa(contract.requirements)}
                        />
                      )
                    : (
                        <TexText text={formula.expression} />
                      )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {evaluation.areaCheck ? (
        <section className="report-status">
          <h2>Checagem · {contract.title}</h2>
          <p className={evaluation.areaCheck.atende ? "ok" : "fail"}>
            Área: {evaluation.areaCheck.label} ·{" "}
            {formatSaturacao(evaluation.areaCheck.saturacao)}
          </p>
          {evaluation.equipmentCheck ? (
            <p className={evaluation.equipmentCheck.atende ? "ok" : "fail"}>
              Equipamentos: {evaluation.equipmentCheck.label} ·{" "}
              {formatSaturacao(evaluation.equipmentCheck.saturacao)}
            </p>
          ) : null}
        </section>
      ) : evaluation.equipmentCheck ? (
        <section className="report-status">
          <h2>Checagem · {contract.title}</h2>
          <p className={evaluation.equipmentCheck.atende ? "ok" : "fail"}>
            Equipamentos: {evaluation.equipmentCheck.label} ·{" "}
            {formatSaturacao(evaluation.equipmentCheck.saturacao)}
          </p>
        </section>
      ) : null}
    </>
  );
}

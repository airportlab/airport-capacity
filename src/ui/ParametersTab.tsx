import type { AirportSource } from "../domain/airports";
import { BELT_LMP_MIN, BELT_TR_MIN } from "../domain/contracts/formulas";
import { UNOFFICIAL_NOTICE } from "../domain/notice";
import { sourceCitation, TSEC_MANUAL_URL } from "../domain/pmd";
import type { ComponentId, RegistryEntry } from "../domain/types";
import { formatNumber } from "./format";
import { PmdTable } from "./PmdTable";

interface ParametersTabProps {
  airport: AirportSource;
  registry: RegistryEntry[];
  onOpenComponent: (id: ComponentId) => void;
}

export function ParametersTab({
  airport,
  registry,
  onOpenComponent,
}: ParametersTabProps) {
  return (
    <div className="layout params-only">
      <section className="panel" aria-labelledby="parametros-heading">
        <p className="round-meta panel-notice">{UNOFFICIAL_NOTICE}</p>
        <h2 id="parametros-heading">Parâmetros mínimos de dimensionamento</h2>
        <p className="panel-lead">
          {airport.contract} ({airport.icao}). {airport.peakLabel} doméstico e
          internacional. Emp, Toi, v.a. e os critérios da sala de embarque vêm
          do contrato; o componente operacional os absorve na criação. Aqui não
          se cadastra componente.
        </p>
        <p className="round-meta">
          Fonte: <strong>{sourceCitation(airport)}</strong>
        </p>
        <PmdTable
          mode="pmd"
          airport={airport}
          registry={registry}
          onOpenComponent={onOpenComponent}
        />
        <h2 id="anteprojeto-heading" className="panel-follow">
          Manual de Anteprojeto
        </h2>
        <p className="panel-lead">
          Tempo de serviço do equipamento (Tsec), em segundos, separado por
          natureza. É o padrão ao cadastrar equipamentos, na falta de outro
          tempo informado. No componente, tempo diferente desse padrão pede
          justificativa. Só entram os tipos que têm valor. Tr e Lmp da sala de
          desembarque são um valor só, para doméstico e internacional.
        </p>
        <p className="round-meta">
          <a href={TSEC_MANUAL_URL}>Manual de Anteprojeto (ANAC)</a>
        </p>
        <PmdTable mode="tsec" airport={airport} registry={registry} />
        <h3 className="manual-single-title">Sala de desembarque</h3>
        <p className="panel-lead">
          Mínimos do requisito de esteira. Não se separam por natureza. Valor
          diferente pede justificativa.
        </p>
        <div className="pmd-wrap">
          <table className="pmd-table manual-single">
            <thead>
              <tr>
                <th scope="col">Parâmetro</th>
                <th scope="col">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  Taxa de passageiros que retiram bagagem (Tr)
                </th>
                <td>
                  {formatNumber(BELT_TR_MIN)} <span className="unit">%</span>
                </td>
              </tr>
              <tr>
                <th scope="row">
                  Comprimento de esteira por passageiro (Lmp)
                </th>
                <td>
                  {formatNumber(BELT_LMP_MIN)} <span className="unit">m</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

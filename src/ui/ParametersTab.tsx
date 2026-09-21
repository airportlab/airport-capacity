import type { AirportSource } from "../domain/airports";
import { UNOFFICIAL_NOTICE } from "../domain/notice";
import { sourceCitation, TSEC_MANUAL_URL } from "../domain/pmd";
import type { ComponentId, RegistryEntry } from "../domain/types";
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
          internacional. Emp, Toi, v.a. e assentos vêm do contrato; o componente
          operacional os absorve na criação. Aqui não se cadastra componente.
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
          Tempo de serviço do equipamento (tsec), em segundos. É o padrão ao
          cadastrar equipamentos, na falta de outro tempo informado. No
          componente, tempo diferente desse padrão pede justificativa. Só
          entram os tipos que têm valor.
        </p>
        <p className="round-meta">
          <a href={TSEC_MANUAL_URL}>Manual de Anteprojeto (ANAC)</a>
        </p>
        <PmdTable mode="tsec" airport={airport} registry={registry} />
      </section>
    </div>
  );
}

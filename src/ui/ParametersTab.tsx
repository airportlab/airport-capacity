import type { AirportSource } from "../domain/airports";
import { UNOFFICIAL_NOTICE } from "../domain/notice";
import { sourceCitation } from "../domain/pmd";
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
        <h2 id="parametros-heading">Parâmetros mínimos de dimensionamento</h2>
        <p className="panel-lead">
          {airport.contract} ({airport.icao}). {airport.peakLabel} doméstico e
          internacional. Esta página só mostra as fontes do contrato. O
          componente operacional absorve Emp, Toi, v.a. e assentos na criação;
          aqui não se cadastra componente.
        </p>
        <p className="round-meta">
          Fonte: <strong>{sourceCitation(airport)}</strong>
        </p>
        <p className="round-meta">{UNOFFICIAL_NOTICE}</p>
        <PmdTable
          airport={airport}
          registry={registry}
          onOpenComponent={onOpenComponent}
        />
      </section>
    </div>
  );
}

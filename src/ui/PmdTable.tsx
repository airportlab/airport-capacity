import type { AirportSource } from "../domain/airports";
import {
  naturesUsedOnRow,
  pmdRows,
  pmdSideLines,
  usedByPmd,
  type PeakNature,
  type PmdRow,
} from "../domain/pmd";
import type { ComponentId, RegistryEntry } from "../domain/types";
import { formatNumber } from "./format";

interface PmdTableProps {
  airport: AirportSource;
  registry: RegistryEntry[];
  onOpenComponent?: (id: ComponentId) => void;
}

function natureLabel(nature: PeakNature): string {
  return nature === "internacional" ? "internacional" : "doméstico";
}

function PmdSide({
  row,
  nature,
}: {
  row: PmdRow;
  nature: PeakNature;
}) {
  const lines = pmdSideLines(row, nature);
  if (lines.length === 0) {
    return <span className="pmd-empty">—</span>;
  }
  return (
    <dl className="pmd-values">
      {lines.map((line) => (
        <div key={line.key} className="pmd-value">
          <dt>{line.label}</dt>
          <dd>
            {formatNumber(line.value)}{" "}
            <span className="unit">{line.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PmdTable({
  airport,
  registry,
  onOpenComponent,
}: PmdTableProps) {
  const rows = pmdRows(airport);
  return (
    <div className="pmd-wrap">
      <table className="pmd-table">
        <thead>
          <tr>
            <th scope="col">Componente</th>
            <th scope="col">Doméstico</th>
            <th scope="col">Internacional</th>
            <th scope="col">Usado por</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const users = usedByPmd(registry, row.id);
            return (
              <tr key={row.id}>
                <th scope="row">
                  <span className="pmd-title">{row.title}</span>
                </th>
                <td>
                  <PmdSide row={row} nature="domestico" />
                </td>
                <td>
                  <PmdSide row={row} nature="internacional" />
                </td>
                <td>
                  {users.length === 0 ? (
                    <span className="pmd-empty">Nenhum componente</span>
                  ) : (
                    <ul className="pmd-users">
                      {users.map((entry) => (
                        <li key={entry.id}>
                          {onOpenComponent ? (
                            <button
                              type="button"
                              className="linkish"
                              onClick={() => onOpenComponent(entry.id)}
                            >
                              {entry.title}
                            </button>
                          ) : (
                            entry.title
                          )}{" "}
                          <span className="pmd-user-nature">
                            (
                            {naturesUsedOnRow(entry, row.id)
                              .map((nature) => natureLabel(nature))
                              .join(", ") || natureLabel("domestico")}
                            )
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

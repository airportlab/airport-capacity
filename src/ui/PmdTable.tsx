import type { AirportSource } from "../domain/airports";
import {
  naturesUsedOnRow,
  pmdRows,
  pmdSideLines,
  standardTsec,
  usedByPmd,
  type PeakNature,
  type PmdRow,
  type PmdSideLine,
} from "../domain/pmd";
import type { ComponentId, RegistryEntry } from "../domain/types";
import { formatNumber } from "./format";
import { TexText } from "./FormulaCard";

/** `all` mantém Emp/Toi/v.a./assentos e tsec juntos (PDF). */
export type PmdTableMode = "all" | "pmd" | "tsec";

interface PmdTableProps {
  airport: AirportSource;
  registry: RegistryEntry[];
  onOpenComponent?: (id: ComponentId) => void;
  mode?: PmdTableMode;
}

function natureLabel(nature: PeakNature): string {
  return nature === "internacional" ? "internacional" : "doméstico";
}

function linesFor(
  row: PmdRow,
  nature: PeakNature,
  mode: PmdTableMode,
): PmdSideLine[] {
  if (mode === "tsec") {
    const value = standardTsec(row.id, nature);
    if (value == null) return [];
    return [{ key: "tsec", label: "tsec", unit: "s", value }];
  }
  const lines = pmdSideLines(row, nature);
  if (mode === "pmd") return lines.filter((line) => line.key !== "tsec");
  return lines;
}

function rowVisible(row: PmdRow, mode: PmdTableMode): boolean {
  if (mode !== "tsec") return true;
  return (
    standardTsec(row.id, "domestico") != null ||
    standardTsec(row.id, "internacional") != null
  );
}

function PmdSide({
  row,
  nature,
  mode,
}: {
  row: PmdRow;
  nature: PeakNature;
  mode: PmdTableMode;
}) {
  const lines = linesFor(row, nature, mode);
  if (lines.length === 0) {
    return <span className="pmd-empty">—</span>;
  }
  return (
    <dl className="pmd-values">
      {lines.map((line) => (
        <div key={line.key} className="pmd-value">
          <dt>
            <TexText text={line.label} />
          </dt>
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
  mode = "all",
}: PmdTableProps) {
  const rows = pmdRows(airport).filter((row) => rowVisible(row, mode));
  const showUsers = mode !== "tsec";
  return (
    <div className="pmd-wrap">
      <table className="pmd-table">
        <thead>
          <tr>
            <th scope="col">Componente</th>
            <th scope="col">Doméstico</th>
            <th scope="col">Internacional</th>
            {showUsers ? <th scope="col">Usado por</th> : null}
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
                  <PmdSide row={row} nature="domestico" mode={mode} />
                </td>
                <td>
                  <PmdSide row={row} nature="internacional" mode={mode} />
                </td>
                {showUsers ? (
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
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

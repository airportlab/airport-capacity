import { useEffect, useMemo, useState } from "react";
import {
  boardingDemandsFromHour,
  boardingFlowWeights,
  boardingPonderation,
  boardingWeightInputIds,
  type BoardingFlowWeight,
} from "../domain/boardingDhp";
import type { ComponentParamId, RegistryEntry, ResolvedInputs } from "../domain/types";
import {
  boardingPlaceActive,
  dhpCoverageText,
  dhpPeriodRange,
  listBoardingPlaces,
  searchBoardingDhp,
  type BoardingDhpWindow,
  type BoardingPlaceCatalog,
  type BoardingPlaceFilter,
  type DhpCoverage,
} from "../dhp/duckdb";
import { chartNeedsMoreHours, OrderedDemandChart, visibleDhpWindows } from "./DhpDemandChart";
import {
  formatEditable,
  formatFixed,
  formatNumber,
  formatSaturacaoTitulo,
  parseLocaleNumber,
  sameNumber,
} from "./format";
import { arquivoTexto, useMovimento } from "./useMovimento";

export interface BoardingDhpStamp {
  signature: string;
  values: Partial<Record<ComponentParamId, number>>;
}

export type BoardingDhpMark = "calculado" | "recalcular";

export function boardingDhpMarkText(mark: BoardingDhpMark): string {
  return mark === "calculado" ? "Calculado" : "Calcular novamente para validar";
}

export const EMPTY_BOARDING_PLACES: BoardingPlaceFilter = {
  boxes: [],
  terminals: [],
};

export function boardingDhpMark(
  stamp: BoardingDhpStamp | null,
  icao: string,
  entry: RegistryEntry,
  drafts: Record<ComponentParamId, string>,
  places: BoardingPlaceFilter = EMPTY_BOARDING_PLACES,
): BoardingDhpMark | null {
  if (!stamp) return null;
  const prepared = prepareBoardingFlows(entry, drafts);
  const signature = Array.isArray(prepared)
    ? flowSignature(icao, prepared, places)
    : null;
  if (signature !== stamp.signature) return "recalcular";
  for (const [id, value] of Object.entries(stamp.values) as [
    ComponentParamId,
    number,
  ][]) {
    const parsed = parseLocaleNumber(drafts[id] ?? "");
    const stamped = parseLocaleNumber(formatEditable(value));
    if (
      parsed === null ||
      stamped === null ||
      !sameNumber(parsed, stamped)
    ) {
      return "recalcular";
    }
  }
  return "calculado";
}

interface BoardingDhpButtonProps {
  icao: string;
  airportName: string;
  entry: RegistryEntry;
  drafts: Record<ComponentParamId, string>;
  mark: BoardingDhpMark | null;
  places: BoardingPlaceFilter;
  onPlacesChange: (places: BoardingPlaceFilter) => void;
  onApply: (values: Partial<Record<ComponentParamId, number>>) => void;
  onStamp: (stamp: BoardingDhpStamp) => void;
}

function janelasTitulo(range: string | null, airportName: string): string {
  const durante = range
    ? `30h de maior demanda durante o período de ${range}`
    : "30h de maior demanda durante o período";
  return `${durante} — ${airportName}`;
}

/** Área da 30ª hora dividida pela área medida. Sem hora 30 ou sem área, fica indefinida. */
export function saturacaoDaCurva(
  janelas: readonly { posicao: number; demandaPonderada: number }[],
  areaMedida: number | null,
): number {
  const hora = janelas.find((item) => item.posicao === 30);
  if (
    !hora ||
    areaMedida === null ||
    !Number.isFinite(hora.demandaPonderada) ||
    !Number.isFinite(areaMedida) ||
    areaMedida <= 0
  ) {
    return Number.NaN;
  }
  return (hora.demandaPonderada / areaMedida) * 100;
}

export function graficoTitulo(
  range: string | null,
  componentName: string,
  airportName: string,
  saturacao: number,
): string {
  return `Curva de DHP de ${range ?? "—"} do ${componentName} — ${airportName} — ${formatSaturacaoTitulo(saturacao)}`;
}

export const BOARDING_AREA_MISSING_MESSAGE = "O peso sai do requisito de área.";
export const BOARDING_AREA_INVALID_MESSAGE = "Informe os parâmetros da área.";
const SHORT_MESSAGE = "Não há 30 janelas no período.";

export function prepareBoardingFlows(
  entry: RegistryEntry,
  drafts: Record<ComponentParamId, string>,
): BoardingFlowWeight[] | "invalid" | "no-area" {
  const ids = boardingWeightInputIds(entry);
  if (!ids) return "no-area";
  const inputs = {} as ResolvedInputs;
  for (const id of ids) {
    const parsed = parseLocaleNumber(drafts[id] ?? "");
    if (parsed === null) return "invalid";
    inputs[id] = parsed;
  }
  const flows = boardingFlowWeights(entry, inputs);
  if (!flows || flows.some((flow) => !Number.isFinite(flow.peso))) return "invalid";
  return flows;
}

function comparePlace(a: string, b: string): number {
  return a.localeCompare(b, "pt", { numeric: true, sensitivity: "base" });
}

function flowSignature(
  icao: string,
  flows: readonly BoardingFlowWeight[],
  places: BoardingPlaceFilter,
): string {
  return JSON.stringify({
    icao,
    flows: flows.map((flow) => [flow.key, flow.peso]),
    boxes: [...places.boxes].sort(comparePlace),
    terminals: [...places.terminals].sort(comparePlace),
  });
}

function togglePlace(current: readonly string[], value: string): string[] {
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return [...next].sort(comparePlace);
}

function placeSummary(places: BoardingPlaceFilter): string {
  const lines: string[] = [];
  if (places.terminals.length > 0) {
    lines.push(`NR_TERMINAL: ${places.terminals.join(", ")}`);
  }
  if (places.boxes.length > 0) lines.push(`NR_BOX: ${places.boxes.join(", ")}`);
  return lines.join("\n");
}

function pessoasNaHora(
  item: BoardingDhpWindow,
  flows: readonly BoardingFlowWeight[],
): number {
  return flows.reduce((sum, flow) => sum + item.counts[flow.key], 0);
}

function PlaceLines({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: readonly string[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <h3 className="field-label">{label}</h3>
      {values.length === 0 ? (
        <p className="dhp-meta">Nenhum valor neste período.</p>
      ) : (
        <div className="dhp-place-row" role="group" aria-label={label}>
          {values.map((value) => (
            <label className="choice" key={value}>
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => onToggle(value)}
              />
              {value}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
      />
    </svg>
  );
}

export function BoardingDhpButton({
  icao,
  airportName,
  entry,
  drafts,
  mark,
  places,
  onPlacesChange,
  onApply,
  onStamp,
}: BoardingDhpButtonProps) {
  const movimento = useMovimento();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<
    (BoardingPlaceCatalog & { icao: string; arquivo: string }) | null
  >(null);
  const [stored, setStored] = useState<{
    signature: string;
    janelas: BoardingDhpWindow[];
    quantidadeJanelas: number;
  } | null>(null);
  const [coverage, setCoverage] = useState<{
    icao: string;
    value: DhpCoverage;
  } | null>(null);
  const prepared = useMemo(
    () => prepareBoardingFlows(entry, drafts),
    [entry, drafts],
  );
  const flows = Array.isArray(prepared) ? prepared : null;
  const signature = flows ? flowSignature(icao, flows, places) : null;
  const advanced = boardingPlaceActive(places);
  const shownCatalog =
    catalog && catalog.icao === icao && catalog.arquivo === movimento.nome
      ? catalog
      : null;
  const janelas =
    stored && signature === stored.signature ? stored.janelas : null;
  const quantidadeJanelas =
    stored && signature === stored.signature ? stored.quantidadeJanelas : 0;
  const tabela =
    janelas
      ?.filter((item) => item.posicao <= 30)
      .sort((a, b) => b.posicao - a.posicao) ?? null;
  const shownCoverage = coverage?.icao === icao ? coverage.value : null;
  const periodRange = shownCoverage ? dhpPeriodRange(shownCoverage) : null;
  const tituloJanelas = janelasTitulo(periodRange, airportName);
  const areaMedida = parseLocaleNumber(drafts.areaMedida ?? "");
  const capacidade =
    areaMedida !== null && areaMedida > 0 ? areaMedida : null;
  const tituloGrafico = graficoTitulo(
    periodRange,
    entry.title,
    airportName,
    saturacaoDaCurva(janelas ?? [], capacidade),
  );
  const graficoJanelas = janelas ? visibleDhpWindows(janelas, capacidade) : null;
  const ultimaHoraGrafico = graficoJanelas?.[graficoJanelas.length - 1]?.posicao;

  useEffect(() => {
    if (!settingsOpen || !movimento.nome) {
      setCatalogLoading(false);
      if (!movimento.nome) {
        setCatalog(null);
        setCatalogError(null);
      }
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    const arquivo = movimento.nome;
    void listBoardingPlaces(icao)
      .then((next) => {
        if (!cancelled) setCatalog({ icao, arquivo, ...next });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setCatalog(null);
        setCatalogError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível ler os boxes e os terminais.",
        );
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settingsOpen, icao, movimento.nome]);

  useEffect(() => {
    if (!shownCatalog) return;
    const boxes = places.boxes.filter((value) => shownCatalog.boxes.includes(value));
    const terminals = places.terminals.filter((value) =>
      shownCatalog.terminals.includes(value),
    );
    if (boxes.length === places.boxes.length && terminals.length === places.terminals.length) {
      return;
    }
    onPlacesChange({ boxes, terminals });
  }, [shownCatalog, places, onPlacesChange]);

  async function calculate() {
    if (!flows || !signature) return;
    setBusy(true);
    setError(null);
    setOpen(false);
    setChartOpen(false);
    setSettingsOpen(false);
    setCoverage(null);
    try {
      const result = await searchBoardingDhp(
        icao,
        boardingPonderation(flows),
        undefined,
        places,
      );
      setCoverage({ icao, value: result.coverage });
      const hora = result.janelas.find((item) => item.posicao === 30);
      if (!result.suficiente || !hora) {
        setStored(null);
        setError(SHORT_MESSAGE);
        return;
      }
      const values = boardingDemandsFromHour(flows, hora.counts);
      setStored({
        signature,
        janelas: result.janelas,
        quantidadeJanelas: result.quantidadeJanelas,
      });
      onApply(values);
      onStamp({ signature, values });
    } catch (caught) {
      setStored(null);
      setCoverage(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível consultar as janelas.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openChart() {
    if (!flows || !signature || !janelas) return;
    if (!chartNeedsMoreHours(janelas, capacidade, quantidadeJanelas)) {
      setChartOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    setOpen(false);
    try {
      let current = janelas;
      let total = quantidadeJanelas;
      let limit = current.length;
      while (chartNeedsMoreHours(current, capacidade, total)) {
        const next = Math.min(total, Math.max(limit + 500, limit * 2));
        if (next <= limit) break;
        const result = await searchBoardingDhp(
          icao,
          boardingPonderation(flows),
          next,
          places,
        );
        current = result.janelas;
        total = result.quantidadeJanelas;
        limit = next;
        if (current.length < next) break;
      }
      setStored({ signature, janelas: current, quantidadeJanelas: total });
      setChartOpen(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível consultar as janelas.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dhp-calc">
      {flows ? (
        <p className="dhp-meta dhp-ponderacoes">
          {[
            "Ponderações",
            ...flows.map(
              (flow) => `${flow.label}: ${formatNumber(flow.peso, 6)}`,
            ),
          ].join("\n")}
        </p>
      ) : (
        <p className="panel-lead">
          {prepared === "invalid" ? BOARDING_AREA_INVALID_MESSAGE : BOARDING_AREA_MISSING_MESSAGE}
        </p>
      )}
      {mark ? (
        <p className={`dhp-meta dhp-mark dhp-mark-${mark}`}>
          {boardingDhpMarkText(mark)}
        </p>
      ) : null}
      <p className="dhp-meta">
        {arquivoTexto(movimento, "Envie o arquivo de movimentação na aba DHp.")}
      </p>
      <div className="actions dhp-actions">
        <button
          type="button"
          className={advanced ? "dhp-gear accent" : "dhp-gear ghost"}
          aria-label="Configurações avançadas"
          aria-pressed={advanced}
          onClick={() => setSettingsOpen(true)}
          disabled={busy}
        >
          <GearIcon />
        </button>
        <button
          type="button"
          onClick={() => void calculate()}
          disabled={busy || flows === null}
        >
          {busy ? "Calculando…" : "Calcular DHp"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy || tabela === null}
        >
          Mostrar DHp
        </button>
        <button
          type="button"
          onClick={() => void openChart()}
          disabled={busy || janelas === null}
        >
          Gráfico
        </button>
      </div>
      {advanced ? (
        <p className="dhp-meta dhp-filtro">{placeSummary(places)}</p>
      ) : null}
      {shownCoverage ? (
        <p className="dhp-meta">{dhpCoverageText(shownCoverage)}</p>
      ) : null}
      {error ? <p className="panel-lead">{error}</p> : null}
      {open && tabela && flows ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="panel modal modal-dhp modal-dhp-tabela"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dhp-janelas-titulo"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="dhp-janelas-titulo">{tituloJanelas}</h2>
            {shownCoverage ? (
              <p className="dhp-meta">{dhpCoverageText(shownCoverage)}</p>
            ) : null}
            <p className="dhp-meta">
              A área mínima necessária cresce de cima para baixo. A linha 30 é a
              hora gravada no componente.
            </p>
            <table className="summary-table dhp-table">
              <thead>
                <tr>
                  <th className="num">Nº</th>
                  <th>Início</th>
                  <th>Fim</th>
                  {flows.map((flow) => (
                    <th key={flow.key} className="num">
                      {flow.label}
                    </th>
                  ))}
                  <th className="num">Pessoas</th>
                  <th className="num">Área mínima necessária</th>
                </tr>
              </thead>
              <tbody>
                {tabela.map((item) => (
                  <tr
                    key={`${item.inicio}-${item.posicao}`}
                    className={item.posicao === 30 ? "dhp-peak" : undefined}
                  >
                    <td className="num">{item.posicao}</td>
                    <td>{item.inicio}</td>
                    <td>{item.fim}</td>
                    {flows.map((flow) => (
                      <td key={flow.key} className="num">
                        {formatNumber(item.counts[flow.key], 0)}
                      </td>
                    ))}
                    <td className="num">
                      {formatNumber(pessoasNaHora(item, flows), 0)}
                    </td>
                    <td className="num">{formatFixed(item.demandaPonderada)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="actions modal-actions">
              <button type="button" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {chartOpen && janelas ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setChartOpen(false)}
        >
          <div
            className="panel modal modal-dhp"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dhp-grafico-titulo"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="dhp-grafico-titulo">{tituloGrafico}</h2>
            <p className="dhp-meta">
              A curva começa no Nº 1 e desce até o Nº {ultimaHoraGrafico}. O
              ponto 30 é a hora gravada no componente.
            </p>
            <OrderedDemandChart janelas={janelas} capacidade={capacidade} />
            {capacidade === null ? (
              <p className="panel-lead">
                Informe a área medida para ver a capacidade.
              </p>
            ) : null}
            <div className="actions modal-actions">
              <button type="button" onClick={() => setChartOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {settingsOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="panel modal modal-dhp-matriz"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dhp-avancado-titulo"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="dhp-avancado-titulo">Configurações avançadas</h2>
            <p className="panel-lead">
              A pesquisa padrão não usa estes filtros. Os seletores marcados são
              os que a pesquisa avançada considera.
            </p>
            {!movimento.nome ? (
              <p className="panel-lead">
                Envie o arquivo de movimentação na aba DHp.
              </p>
            ) : catalogLoading && !shownCatalog ? (
              <p className="dhp-meta">A ler os terminais e os boxes…</p>
            ) : catalogError ? (
              <p className="panel-lead">{catalogError}</p>
            ) : shownCatalog ? (
              <>
                <PlaceLines
                  label="NR_TERMINAL"
                  values={shownCatalog.terminals}
                  selected={places.terminals}
                  onToggle={(value) =>
                    onPlacesChange({
                      boxes: [...places.boxes],
                      terminals: togglePlace(places.terminals, value),
                    })
                  }
                />
                <PlaceLines
                  label="NR_BOX"
                  values={shownCatalog.boxes}
                  selected={places.boxes}
                  onToggle={(value) =>
                    onPlacesChange({
                      boxes: togglePlace(places.boxes, value),
                      terminals: [...places.terminals],
                    })
                  }
                />
              </>
            ) : null}
            <div className="actions modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => onPlacesChange(EMPTY_BOARDING_PLACES)}
                disabled={!advanced}
              >
                Limpar
              </button>
              <button type="button" onClick={() => setSettingsOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

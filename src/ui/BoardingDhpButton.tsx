import { useMemo, useState } from "react";
import {
  boardingDemandsFromHour,
  boardingFlowWeights,
  boardingPonderation,
  boardingWeightInputIds,
  type BoardingFlowWeight,
} from "../domain/boardingDhp";
import type { ComponentParamId, RegistryEntry, ResolvedInputs } from "../domain/types";
import {
  dhpCoverageText,
  dhpPeriodRange,
  searchBoardingDhp,
  type BoardingDhpWindow,
  type DhpCoverage,
} from "../dhp/duckdb";
import { formatFixed, formatNumber, parseLocaleNumber } from "./format";
import { arquivoTexto, useMovimento } from "./useMovimento";

interface BoardingDhpButtonProps {
  icao: string;
  airportName: string;
  entry: RegistryEntry;
  drafts: Record<ComponentParamId, string>;
  onApply: (values: Partial<Record<ComponentParamId, number>>) => void;
}

function janelasTitulo(range: string | null, airportName: string): string {
  const durante = range
    ? `30h de maior demanda durante o período de ${range}`
    : "30h de maior demanda durante o período";
  return `${durante} — ${airportName}`;
}

function graficoTitulo(range: string | null, airportName: string): string {
  return `Curva de DHP ${range ?? "—"} — ${airportName}`;
}

const AREA_MESSAGE = "O peso sai do requisito de área.";
const INVALID_MESSAGE = "Informe os parâmetros da área.";
const SHORT_MESSAGE = "Não há 30 janelas no período.";

function flowsFromDrafts(
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

function flowSignature(icao: string, flows: readonly BoardingFlowWeight[]): string {
  return `${icao}|${flows.map((flow) => `${flow.key}:${flow.peso}`).join("|")}`;
}

function pessoasNaHora(
  item: BoardingDhpWindow,
  flows: readonly BoardingFlowWeight[],
): number {
  return flows.reduce((sum, flow) => sum + item.counts[flow.key], 0);
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 340;
const CHART_PAD = { top: 20, right: 20, bottom: 36, left: 76 };

function yBounds(values: readonly number[], extras: readonly number[]): {
  min: number;
  max: number;
} {
  let min = Math.min(...values);
  let max = Math.max(...values);
  for (const extra of extras) {
    min = Math.min(min, extra);
    max = Math.max(max, extra);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.06;
  return { min: min - pad, max: max + pad };
}

const AXIS_LABEL_GAP = 14;

function axisLabelYs(
  demandY: number | null,
  capacityY: number | null,
  floor: number,
): { demand: number | null; capacity: number | null } {
  if (demandY === null || capacityY === null) {
    return { demand: demandY, capacity: capacityY };
  }
  if (Math.abs(demandY - capacityY) >= AXIS_LABEL_GAP) {
    return { demand: demandY, capacity: capacityY };
  }
  const top = Math.min(demandY, capacityY);
  let bottom = top + AXIS_LABEL_GAP;
  let nextTop = top;
  if (bottom > floor) {
    bottom = floor;
    nextTop = floor - AXIS_LABEL_GAP;
  }
  if (demandY <= capacityY) return { demand: nextTop, capacity: bottom };
  return { demand: bottom, capacity: nextTop };
}

function OrderedDemandChart({
  janelas,
  capacidade,
}: {
  janelas: readonly BoardingDhpWindow[];
  capacidade: number | null;
}) {
  const ordered = [...janelas].sort((a, b) => a.posicao - b.posicao);
  const bounds = yBounds(
    ordered.map((item) => item.demandaPonderada),
    capacidade === null ? [] : [capacidade],
  );
  const innerW = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const xOf = (index: number) =>
    CHART_PAD.left +
    (ordered.length === 1 ? innerW / 2 : (index / (ordered.length - 1)) * innerW);
  const yOf = (value: number) =>
    CHART_PAD.top +
    (1 - (value - bounds.min) / (bounds.max - bounds.min)) * innerH;
  const baseline = CHART_PAD.top + innerH;
  const points = ordered
    .map((item, index) => `${xOf(index)},${yOf(item.demandaPonderada)}`)
    .join(" ");
  const peakIndex = ordered.findIndex((item) => item.posicao === 30);
  const peak = peakIndex >= 0 ? ordered[peakIndex] : null;
  const peakY = peak ? yOf(peak.demandaPonderada) : null;
  const capacityY = capacidade === null ? null : yOf(capacidade);
  const cuts = axisLabelYs(peakY, capacityY, baseline - 4);
  const legendItems = [
    { label: "Demanda ponderada", mark: "dhp-chart-curve" },
    ...(peak
      ? [{ label: "Demanda da 30ª hora", mark: "dhp-chart-demand" }]
      : []),
    ...(capacidade !== null
      ? [{ label: "Capacidade (área medida)", mark: "dhp-chart-capacity" }]
      : []),
  ];
  const legendWidth = 228;
  const legendHeight = 14 + legendItems.length * 18;
  const legendX = CHART_WIDTH - CHART_PAD.right - legendWidth;
  const legendY = 8;
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  return (
    <>
      <svg
        className="dhp-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-labelledby="dhp-grafico-titulo"
      >
        <line
          className="dhp-chart-axis"
          x1={CHART_PAD.left}
          y1={CHART_PAD.top}
          x2={CHART_PAD.left}
          y2={baseline}
        />
        <line
          className="dhp-chart-axis"
          x1={CHART_PAD.left}
          y1={baseline}
          x2={CHART_PAD.left + innerW}
          y2={baseline}
        />
        <polyline className="dhp-chart-curve" points={points} />
        {peak && peakY !== null ? (
          <line
            className="dhp-chart-demand"
            x1={xOf(0)}
            y1={peakY}
            x2={xOf(ordered.length - 1)}
            y2={peakY}
          />
        ) : null}
        {capacidade !== null && capacityY !== null ? (
          <line
            className="dhp-chart-capacity"
            x1={xOf(0)}
            y1={capacityY}
            x2={xOf(ordered.length - 1)}
            y2={capacityY}
          />
        ) : null}
        {peak && peakY !== null && cuts.demand !== null ? (
          <text
            className="dhp-chart-cut"
            x={CHART_PAD.left - 8}
            y={cuts.demand + 4}
            textAnchor="end"
          >
            {formatFixed(peak.demandaPonderada)}
          </text>
        ) : null}
        {capacidade !== null && cuts.capacity !== null ? (
          <text
            className="dhp-chart-cut"
            x={CHART_PAD.left - 8}
            y={cuts.capacity + 4}
            textAnchor="end"
          >
            {formatFixed(capacidade)}
          </text>
        ) : null}
        {peak && peakY !== null ? (
          <>
            <line
              className="dhp-chart-rank"
              x1={xOf(peakIndex)}
              y1={peakY}
              x2={xOf(peakIndex)}
              y2={baseline}
            />
            <circle
              className="dhp-chart-peak"
              cx={xOf(peakIndex)}
              cy={peakY}
              r={4}
            />
            <text x={xOf(peakIndex)} y={baseline + 18} textAnchor="middle">
              30º
            </text>
          </>
        ) : null}
        {first ? (
          <text x={xOf(0)} y={baseline + 18} textAnchor="middle">
            {first.posicao}
          </text>
        ) : null}
        {last && ordered.length > 1 ? (
          <text x={xOf(ordered.length - 1)} y={baseline + 18} textAnchor="middle">
            {last.posicao}
          </text>
        ) : null}
        <g className="dhp-legend">
          <rect
            className="dhp-legend-box"
            x={legendX}
            y={legendY}
            width={legendWidth}
            height={legendHeight}
            rx={4}
          />
          {legendItems.map((item, index) => {
            const y = legendY + 16 + index * 18;
            return (
              <g key={item.label}>
                <line
                  className={item.mark}
                  x1={legendX + 10}
                  y1={y}
                  x2={legendX + 34}
                  y2={y}
                />
                <text x={legendX + 42} y={y + 4}>
                  {item.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </>
  );
}

export function BoardingDhpButton({
  icao,
  airportName,
  entry,
  drafts,
  onApply,
}: BoardingDhpButtonProps) {
  const movimento = useMovimento();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [stored, setStored] = useState<{
    signature: string;
    janelas: BoardingDhpWindow[];
  } | null>(null);
  const [coverage, setCoverage] = useState<{
    icao: string;
    value: DhpCoverage;
  } | null>(null);
  const prepared = useMemo(
    () => flowsFromDrafts(entry, drafts),
    [entry, drafts],
  );
  const flows = Array.isArray(prepared) ? prepared : null;
  const signature = flows ? flowSignature(icao, flows) : null;
  const janelas =
    stored && signature === stored.signature ? stored.janelas : null;
  const tabela = janelas?.filter((item) => item.posicao <= 30) ?? null;
  const shownCoverage = coverage?.icao === icao ? coverage.value : null;
  const periodRange = shownCoverage ? dhpPeriodRange(shownCoverage) : null;
  const tituloJanelas = janelasTitulo(periodRange, airportName);
  const tituloGrafico = graficoTitulo(periodRange, airportName);
  const areaMedida = parseLocaleNumber(drafts.areaMedida ?? "");
  const capacidade =
    areaMedida !== null && areaMedida > 0 ? areaMedida : null;

  async function calculate() {
    if (!flows || !signature) return;
    setBusy(true);
    setError(null);
    setOpen(false);
    setChartOpen(false);
    setCoverage(null);
    try {
      const result = await searchBoardingDhp(icao, boardingPonderation(flows));
      setCoverage({ icao, value: result.coverage });
      const hora = result.janelas.find((item) => item.posicao === 30);
      if (!result.suficiente || !hora) {
        setStored(null);
        setError(SHORT_MESSAGE);
        return;
      }
      setStored({ signature, janelas: result.janelas });
      onApply(boardingDemandsFromHour(flows, hora.counts));
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
          {prepared === "invalid" ? INVALID_MESSAGE : AREA_MESSAGE}
        </p>
      )}
      <p className="dhp-meta">
        {arquivoTexto(movimento, "Envie o arquivo de movimentação na aba DHp.")}
      </p>
      <div className="actions dhp-actions">
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
          onClick={() => setChartOpen(true)}
          disabled={busy || janelas === null}
        >
          Gráfico
        </button>
      </div>
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
              A demanda ponderada cresce de cima para baixo. A linha 30 é a
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
                  <th className="num">Demanda ponderada</th>
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
              A curva começa no Nº 1 e desce até o Nº {janelas.length}. O ponto
              30 é a hora gravada no componente.
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
    </div>
  );
}

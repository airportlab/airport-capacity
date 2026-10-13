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
import {
  formatEditable,
  formatFixed,
  formatNumber,
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

export function boardingDhpMark(
  stamp: BoardingDhpStamp | null,
  icao: string,
  entry: RegistryEntry,
  drafts: Record<ComponentParamId, string>,
): BoardingDhpMark | null {
  if (!stamp) return null;
  const prepared = flowsFromDrafts(entry, drafts);
  const signature = Array.isArray(prepared) ? flowSignature(icao, prepared) : null;
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
  onApply: (values: Partial<Record<ComponentParamId, number>>) => void;
  onStamp: (stamp: BoardingDhpStamp) => void;
}

function janelasTitulo(range: string | null, airportName: string): string {
  const durante = range
    ? `30h de maior demanda durante o período de ${range}`
    : "30h de maior demanda durante o período";
  return `${durante} — ${airportName}`;
}

function graficoTitulo(
  range: string | null,
  componentName: string,
  airportName: string,
): string {
  return `Curva de DHP de ${range ?? "—"} do ${componentName} — ${airportName}`;
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

const CHART_WIDTH = 854;
const CHART_HEIGHT = 360;
const CHART_PAD = { top: 20, right: 20, bottom: 56, left: 210 };
const AREA_TITLE_X = 16;
const HOURS_WHEN_CAPACITY_ABOVE = 100;
const HOURS_AFTER_CAPACITY = 50;
const RANK_LABEL_GAP = 28;

function capacityCrossIndex(
  ordered: readonly BoardingDhpWindow[],
  capacidade: number | null,
): number {
  if (ordered.length === 0 || capacidade === null) return -1;
  if (capacidade > ordered[0].demandaPonderada) return -1;
  return ordered.findIndex((item) => item.demandaPonderada <= capacidade);
}

function visibleDhpWindows(
  janelas: readonly BoardingDhpWindow[],
  capacidade: number | null,
): BoardingDhpWindow[] {
  const ordered = [...janelas].sort((a, b) => a.posicao - b.posicao);
  if (ordered.length === 0 || capacidade === null) return ordered;
  const first = ordered[0].demandaPonderada;
  if (capacidade > first) return ordered.slice(0, HOURS_WHEN_CAPACITY_ABOVE);
  const cross = capacityCrossIndex(ordered, capacidade);
  if (cross < 0) return ordered;
  return ordered.slice(0, cross + 1 + HOURS_AFTER_CAPACITY);
}

function chartNeedsMoreHours(
  janelas: readonly BoardingDhpWindow[],
  capacidade: number | null,
  quantidadeJanelas: number,
): boolean {
  if (capacidade === null || janelas.length === 0) return false;
  if (quantidadeJanelas > 0 && janelas.length >= quantidadeJanelas) return false;
  const ordered = [...janelas].sort((a, b) => a.posicao - b.posicao);
  if (capacidade > ordered[0].demandaPonderada) return false;
  const cross = capacityCrossIndex(ordered, capacidade);
  if (cross < 0) return true;
  return cross + 1 + HOURS_AFTER_CAPACITY > ordered.length;
}

function separateRankLabels(
  peakX: number | null,
  crossX: number | null,
): { peak: number | null; cross: number | null } {
  if (peakX === null || crossX === null) return { peak: peakX, cross: crossX };
  const gap = Math.abs(peakX - crossX);
  if (gap >= RANK_LABEL_GAP) return { peak: peakX, cross: crossX };
  const shift = (RANK_LABEL_GAP - gap) / 2;
  if (crossX < peakX) return { peak: peakX + shift, cross: crossX - shift };
  return { peak: peakX - shift, cross: crossX + shift };
}

function chartYMax(
  ordered: readonly BoardingDhpWindow[],
  capacidade: number | null,
): number {
  let max = 0;
  for (const item of ordered) max = Math.max(max, item.demandaPonderada);
  if (capacidade !== null) max = Math.max(max, capacidade);
  return max > 0 ? max : 1;
}

const AXIS_LABEL_GAP = 14;

function axisLabelYs(
  demandY: number | null,
  capacityY: number | null,
  floor: number,
): { demand: number | null; capacity: number | null } {
  const aboveZero = (y: number) => Math.min(y, floor);
  if (demandY === null || capacityY === null) {
    return {
      demand: demandY === null ? null : aboveZero(demandY),
      capacity: capacityY === null ? null : aboveZero(capacityY),
    };
  }
  let demand = aboveZero(demandY);
  let capacity = aboveZero(capacityY);
  if (Math.abs(demand - capacity) >= AXIS_LABEL_GAP) {
    return { demand, capacity };
  }
  const top = Math.min(demand, capacity);
  let bottom = top + AXIS_LABEL_GAP;
  let nextTop = top;
  if (bottom > floor) {
    bottom = floor;
    nextTop = floor - AXIS_LABEL_GAP;
  }
  if (demand <= capacity) return { demand: nextTop, capacity: bottom };
  return { demand: bottom, capacity: nextTop };
}

function OrderedDemandChart({
  janelas,
  capacidade,
}: {
  janelas: readonly BoardingDhpWindow[];
  capacidade: number | null;
}) {
  const ordered = visibleDhpWindows(janelas, capacidade);
  const yMax = chartYMax(ordered, capacidade);
  const innerW = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const xOf = (index: number) =>
    CHART_PAD.left +
    (ordered.length === 1 ? innerW / 2 : (index / (ordered.length - 1)) * innerW);
  const yOf = (value: number) =>
    CHART_PAD.top + (1 - value / yMax) * innerH;
  const baseline = CHART_PAD.top + innerH;
  const points = ordered
    .map((item, index) => `${xOf(index)},${yOf(item.demandaPonderada)}`)
    .join(" ");
  const peakIndex = ordered.findIndex((item) => item.posicao === 30);
  const peak = peakIndex >= 0 ? ordered[peakIndex] : null;
  const peakY = peak ? yOf(peak.demandaPonderada) : null;
  const capacityY = capacidade === null ? null : yOf(capacidade);
  const cuts = axisLabelYs(peakY, capacityY, baseline - AXIS_LABEL_GAP);
  const axisTitleY = CHART_PAD.top + innerH / 2;
  const crossIndex = capacityCrossIndex(ordered, capacidade);
  const cross = crossIndex >= 0 ? ordered[crossIndex] : null;
  const showCross = cross !== null && cross.posicao !== 30;
  const rankLabels = separateRankLabels(
    peakIndex >= 0 ? xOf(peakIndex) : null,
    showCross ? xOf(crossIndex) : null,
  );
  const markedRanks = new Set<number>();
  if (peak) markedRanks.add(peak.posicao);
  if (cross) markedRanks.add(cross.posicao);
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
            {formatNumber(peak.demandaPonderada, 2)}m²(Requisito)
          </text>
        ) : null}
        {capacidade !== null && cuts.capacity !== null ? (
          <text
            className="dhp-chart-cut"
            x={CHART_PAD.left - 8}
            y={cuts.capacity + 4}
            textAnchor="end"
          >
            {formatNumber(capacidade, 2)}m²(Capacidade)
          </text>
        ) : null}
        <text
          className="dhp-chart-cut"
          x={CHART_PAD.left - 8}
          y={baseline + 4}
          textAnchor="end"
        >
          0
        </text>
        <text
          x={AREA_TITLE_X}
          y={axisTitleY}
          textAnchor="middle"
          transform={`rotate(-90 ${AREA_TITLE_X} ${axisTitleY})`}
        >
          Área
        </text>
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
            <text x={rankLabels.peak ?? xOf(peakIndex)} y={baseline + 18} textAnchor="middle">
              30º
            </text>
          </>
        ) : null}
        {showCross && cross ? (
          <>
            <line
              className="dhp-chart-rank"
              x1={xOf(crossIndex)}
              y1={yOf(cross.demandaPonderada)}
              x2={xOf(crossIndex)}
              y2={baseline}
            />
            <circle
              className="dhp-chart-peak"
              cx={xOf(crossIndex)}
              cy={yOf(cross.demandaPonderada)}
              r={4}
            />
            <text
              x={rankLabels.cross ?? xOf(crossIndex)}
              y={baseline + 18}
              textAnchor="middle"
            >
              {cross.posicao}º
            </text>
          </>
        ) : null}
        {first && !markedRanks.has(first.posicao) ? (
          <text x={xOf(0)} y={baseline + 18} textAnchor="middle">
            {first.posicao}
          </text>
        ) : null}
        {last && last.posicao !== first?.posicao && !markedRanks.has(last.posicao) ? (
          <text x={xOf(ordered.length - 1)} y={baseline + 18} textAnchor="middle">
            {last.posicao}
          </text>
        ) : null}
        <text
          x={CHART_PAD.left + innerW / 2}
          y={baseline + 38}
          textAnchor="middle"
        >
          DHPº(h)
        </text>
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
  mark,
  onApply,
  onStamp,
}: BoardingDhpButtonProps) {
  const movimento = useMovimento();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
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
    () => flowsFromDrafts(entry, drafts),
    [entry, drafts],
  );
  const flows = Array.isArray(prepared) ? prepared : null;
  const signature = flows ? flowSignature(icao, flows) : null;
  const janelas =
    stored && signature === stored.signature ? stored.janelas : null;
  const quantidadeJanelas =
    stored && signature === stored.signature ? stored.quantidadeJanelas : 0;
  const tabela = janelas?.filter((item) => item.posicao <= 30) ?? null;
  const shownCoverage = coverage?.icao === icao ? coverage.value : null;
  const periodRange = shownCoverage ? dhpPeriodRange(shownCoverage) : null;
  const tituloJanelas = janelasTitulo(periodRange, airportName);
  const tituloGrafico = graficoTitulo(periodRange, entry.title, airportName);
  const areaMedida = parseLocaleNumber(drafts.areaMedida ?? "");
  const capacidade =
    areaMedida !== null && areaMedida > 0 ? areaMedida : null;
  const graficoJanelas = janelas ? visibleDhpWindows(janelas, capacidade) : null;
  const ultimaHoraGrafico = graficoJanelas?.[graficoJanelas.length - 1]?.posicao;

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
          {prepared === "invalid" ? INVALID_MESSAGE : AREA_MESSAGE}
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
    </div>
  );
}

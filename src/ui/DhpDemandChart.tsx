import type { BoardingDhpWindow } from "../dhp/duckdb";
import { formatNumber } from "./format";

const CHART_WIDTH = 854;
const CHART_HEIGHT = 360;
const CHART_PAD = { top: 20, right: 20, bottom: 56, left: 210 };
const AREA_TITLE_X = 16;
const HOURS_WHEN_CAPACITY_ABOVE = 100;
const HOURS_AFTER_CAPACITY = 50;
const RANK_LABEL_GAP = 28;
const AXIS_LABEL_GAP = 14;

function capacityCrossIndex(
  ordered: readonly BoardingDhpWindow[],
  capacidade: number | null,
): number {
  if (ordered.length === 0 || capacidade === null) return -1;
  if (capacidade > ordered[0].demandaPonderada) return -1;
  const index = ordered.findIndex((item) => item.demandaPonderada <= capacidade);
  if (index < 0) return -1;
  if (ordered[index].demandaPonderada === capacidade) return index;
  return index - 1;
}

export function visibleDhpWindows(
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

export function chartNeedsMoreHours(
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

export type DhpCurveForm = "continua" | "discreta";

export function OrderedDemandChart({
  janelas,
  capacidade,
  labelledBy = "dhp-grafico-titulo",
  forma = "continua",
}: {
  janelas: readonly BoardingDhpWindow[];
  capacidade: number | null;
  labelledBy?: string;
  forma?: DhpCurveForm;
}) {
  const ordered = visibleDhpWindows(janelas, capacidade);
  if (ordered.length === 0) return null;
  const yMax = chartYMax(ordered, capacidade);
  const innerW = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const discrete = forma === "discreta";
  const slot = innerW / ordered.length;
  const xOf = (index: number) => {
    if (discrete) return CHART_PAD.left + (index + 0.5) * slot;
    return (
      CHART_PAD.left +
      (ordered.length === 1 ? innerW / 2 : (index / (ordered.length - 1)) * innerW)
    );
  };
  const yOf = (value: number) =>
    CHART_PAD.top + (1 - value / yMax) * innerH;
  const baseline = CHART_PAD.top + innerH;
  const points = discrete
    ? ordered
        .flatMap((item, index) => {
          const y = yOf(item.demandaPonderada);
          const left = CHART_PAD.left + index * slot;
          return [`${left},${y}`, `${left + slot},${y}`];
        })
        .join(" ")
    : ordered
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
    { label: "Área mínima necessária", mark: "dhp-chart-curve" },
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
  const plotLeft = discrete ? CHART_PAD.left : xOf(0);
  const plotRight = discrete ? CHART_PAD.left + innerW : xOf(ordered.length - 1);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  return (
    <svg
      className="dhp-chart"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-labelledby={labelledBy}
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
          x1={plotLeft}
          y1={peakY}
          x2={plotRight}
          y2={peakY}
        />
      ) : null}
      {capacidade !== null && capacityY !== null ? (
        <line
          className="dhp-chart-capacity"
          x1={plotLeft}
          y1={capacityY}
          x2={plotRight}
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
  );
}

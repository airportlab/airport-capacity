import {
  defaultAirport,
  type AirportSource,
  type PmdTableId,
  type RoundId,
} from "./airports";
import type {
  ComponentId,
  ComponentParamId,
  ComponentParams,
  ParamField,
  PeakNature,
  PmdBinding,
  RegistryEntry,
  RegistryFlow,
  SizingParamId,
  SizingSources,
} from "./types";
import { isMixedNature, natureOfEntry } from "./types";
import { flowParamIds, tsecTargets, type TsecTarget } from "./contracts/flowParams";

export type { PeakNature, RoundId };
export type { AirportSource };

export const DEFAULT_PEAK_NATURE: PeakNature = "domestico";

export type EmpUnit = "m²/ocup" | "m²/pax";

export type LoungeAreaMode = "emp-e-assentos" | "sentado-em-pe";

export interface RoundAreaValues {
  emp: number | null;
  toiMinutes: number | null;
  vaPerPax: number | null;
  seatPercent: number | null;
  /** Máxima ocupação das salas (Ocup_max), só no modo sentado-em-pe. */
  occupancyPercent?: number | null;
  /** Espaço do passageiro em pé (Emp_p). */
  empStanding?: number | null;
  /** Tempo de ocupação do passageiro em pé (Toi_p). */
  toiStandingMinutes?: number | null;
}

export interface PmdRow {
  id: string;
  title: string;
  detail: string;
  empUnit: EmpUnit;
  /** Sala de embarque. Ausente nas outras linhas. */
  loungeMode?: LoungeAreaMode;
  domestico: RoundAreaValues;
  internacional: RoundAreaValues;
}

export interface PmdMetricView {
  key:
    | "emp"
    | "va"
    | "toi"
    | "seats"
    | "occupancy"
    | "empStanding"
    | "toiStanding"
    | "tsec";
  label: string;
  unit: string;
  domestico: number | null;
  internacional: number | null;
}

function sizing(
  emp: number | null,
  toiMinutes: number | null,
  vaPerPax: number | null = null,
  seatPercent: number | null = null,
  occupancyPercent: number | null = null,
  empStanding: number | null = null,
  toiStandingMinutes: number | null = null,
): RoundAreaValues {
  return {
    emp,
    toiMinutes,
    vaPerPax,
    seatPercent,
    occupancyPercent,
    empStanding,
    toiStandingMinutes,
  };
}

/** Tabela PMD compartilhada (1ª rodada — relicitação do SBSG, 6ª rodada Central e 7ª rodada). */
export const STANDARD_PMD: PmdRow[] = [
  {
    id: "saguao-embarque",
    title: "Saguão de embarque",
    detail:
      "Espaço mínimo por ocupante; relação visitante-acompanhante por passageiro (v.a.) e tempo médio de ocupação (min).",
    empUnit: "m²/ocup",
    domestico: sizing(2.3, 20, 1),
    internacional: sizing(2.3, 20, 1),
  },
  {
    id: "saguao-desembarque",
    title: "Saguão de desembarque",
    detail:
      "Espaço mínimo por ocupante, relação visitante-acompanhante por passageiro (v.a.) e tempo médio de ocupação (min).",
    empUnit: "m²/ocup",
    domestico: sizing(1.7, 15, 1),
    internacional: sizing(1.7, 25, 1),
  },
  {
    id: "checkin-bagagens",
    title: "Check-in e despacho de bagagens",
    detail:
      "Espaço mínimo por passageiro (m²/pax) e tempo máximo de ocupação no componente (min) na área destinada à formação de filas.",
    empUnit: "m²/pax",
    domestico: sizing(1.3, 20),
    internacional: sizing(1.8, 30),
  },
  {
    id: "inspecao",
    title: "Inspeção de segurança",
    detail:
      "Espaço mínimo por passageiro (m²/pax) e tempo máximo de ocupação (min) na área destinada à formação de fila.",
    empUnit: "m²/pax",
    domestico: sizing(1.0, 10),
    internacional: sizing(1.0, 15),
  },
  {
    id: "emigracao",
    title: "Emigração",
    detail:
      "Espaço mínimo por passageiro (m²/pax) e tempo máximo de ocupação (min) na área destinada à formação de fila.",
    empUnit: "m²/pax",
    domestico: sizing(null, null),
    internacional: sizing(1.0, 10),
  },
  {
    id: "imigracao",
    title: "Imigração",
    detail:
      "Espaço mínimo por passageiro (m²/pax) e tempo máximo de ocupação (min) na área destinada à formação de fila.",
    empUnit: "m²/pax",
    domestico: sizing(null, null),
    internacional: sizing(1.0, 10),
  },
  {
    id: "aduana",
    title: "Aduana",
    detail:
      "Espaço mínimo por passageiro (m²/pax) e tempo máximo de ocupação (min) na área destinada à formação de fila.",
    empUnit: "m²/pax",
    domestico: sizing(null, null),
    internacional: sizing(1.7, 10),
  },
  {
    id: "sala-embarque-pontes",
    title:
      "Sala de embarque de atendimento em posições próximas (pontes de embarque)",
    detail:
      "Espaço mínimo por passageiro (m²/pax), tempo médio de ocupação no componente (min) e percentual mínimo de assentos oferecidos.",
    empUnit: "m²/pax",
    loungeMode: "emp-e-assentos",
    domestico: sizing(2.3, 40, null, 70),
    internacional: sizing(2.3, 60, null, 70),
  },
  {
    id: "sala-embarque-remotas",
    title: "Sala de embarque de atendimento em posições remotas",
    detail:
      "Espaço mínimo por passageiro (m²/pax), tempo médio de ocupação no componente (min) e percentual mínimo de assentos oferecidos.",
    empUnit: "m²/pax",
    loungeMode: "emp-e-assentos",
    domestico: sizing(2.3, 40, null, 70),
    internacional: sizing(2.3, 60, null, 70),
  },
  {
    id: "sala-desembarque",
    title: "Sala de desembarque",
    detail:
      "Espaço mínimo por passageiro (m²/pax) e tempo médio de ocupação no componente (min).",
    empUnit: "m²/pax",
    domestico: sizing(1.7, 20),
    internacional: sizing(1.7, 45),
  },
];

const SALAS_EMBARQUE_NORDESTE: PmdRow = {
  id: "salas-embarque",
  title: "Salas de embarque",
  detail:
    "Máxima ocupação das salas (Ocup_max), acesso a assentos (Pa), área e tempo do passageiro sentado e do passageiro em pé. Ad pondera os dois e divide por Ocup_max.",
  empUnit: "m²/pax",
  loungeMode: "sentado-em-pe",
  domestico: sizing(1.7, 40, null, 70, 65, 1.2, 20),
  internacional: sizing(1.7, 60, null, 70, 65, 1.2, 20),
};

function withArrivalsToi(row: PmdRow, domestico: number, internacional: number): PmdRow {
  return {
    ...row,
    domestico: sizing(row.domestico.emp, domestico),
    internacional: sizing(row.internacional.emp, internacional),
  };
}

/** Bloco Nordeste, Termo Aditivo n. 002/2023. Sala de embarque única, sentado e em pé. */
export const NORDESTE_PMD: PmdRow[] = STANDARD_PMD.flatMap((row) => {
  if (row.id === "sala-embarque-pontes" || row.id === "sala-embarque-remotas") {
    return row.id === "sala-embarque-pontes" ? [SALAS_EMBARQUE_NORDESTE] : [];
  }
  if (row.id === "sala-desembarque") return [withArrivalsToi(row, 30, 45)];
  return [row];
});

const PMD_TABLES: Record<PmdTableId, PmdRow[]> = {
  standard: STANDARD_PMD,
  nordeste: NORDESTE_PMD,
};

const PMD_BY_ID: Record<string, PmdRow> = {};
for (const table of Object.values(PMD_TABLES)) {
  for (const row of table) {
    if (!PMD_BY_ID[row.id]) PMD_BY_ID[row.id] = row;
  }
}

export interface TsecByNature {
  domestico: number | null;
  internacional: number | null;
}

/**
 * Tempo de serviço do equipamento (s). Manual de Anteprojeto, fora do PMD do contrato.
 * Na falta de outro tempo informado, este é o padrão do requisito de equipamentos.
 */
export const STANDARD_TSEC: Record<string, TsecByNature> = {
  "checkin-bagagens": { domestico: 150, internacional: 180 },
  inspecao: { domestico: 25, internacional: 37 },
  emigracao: { domestico: null, internacional: 75 },
  imigracao: { domestico: null, internacional: 75 },
};

export const TSEC_MANUAL_URL =
  "https://www.gov.br/anac/pt-br/assuntos/concessoes/ManualdeAnteprojeto.pdf";

export const TSEC_MANUAL_CITATION =
  "Manual de Anteprojeto (ANAC). Tempo de serviço do equipamento (tsec), em segundos. Padrão do requisito de equipamentos na falta de outro tempo informado.";

/** Nome da equação 10. Só o Excel usa este rótulo. */
export const TSEC_MANUAL_LABEL =
  "tempo médio de processamento de passageiros nos processadores (Tsec)";

export function standardTsec(
  rowId: string,
  nature: PeakNature,
): number | null {
  return STANDARD_TSEC[rowId]?.[nature] ?? null;
}

/** Padrão do tsec único. Com vários fluxos, cada um tem o seu. */
export function standardTsecForEntry(entry: RegistryEntry): number | null {
  const nature = natureOfEntry(entry);
  if (!nature || nature === "misto") return null;
  const rowId = entry.pmd?.rowId ?? entry.flows?.[0]?.pmd.rowId;
  if (!rowId) return null;
  return standardTsec(rowId, nature);
}

function rowIdForTsecTarget(
  entry: RegistryEntry,
  target: TsecTarget,
): string | undefined {
  const flow = entry.flows?.find(
    (item) => item.role === target.role && item.pmd.nature === target.nature,
  );
  if (flow) return flow.pmd.rowId;
  if (entry.pmd?.nature === target.nature) return entry.pmd.rowId;
  return entry.pmd?.rowId ?? entry.flows?.[0]?.pmd.rowId;
}

/** Padrão do Manual de Anteprojeto para o tsec daquele fluxo. */
export function standardTsecForParam(
  entry: RegistryEntry,
  id: ComponentParamId,
): number | null {
  const target = tsecTargets(entry).find((item) => item.id === id);
  if (!target) return id === "tsec" ? standardTsecForEntry(entry) : null;
  const rowId = rowIdForTsecTarget(entry, target);
  if (!rowId) return null;
  return standardTsec(rowId, target.nature);
}

/**
 * Na troca de desenho, cada fluxo reabsorve o tsec só se o valor ainda era o
 * padrão anterior (ou 0, se não havia padrão). Fluxo novo nasce no padrão dele.
 */
export function reabsorbTsecParams(
  previousEntry: RegistryEntry,
  entry: RegistryEntry,
  previousParams: ComponentParams,
  params: ComponentParams,
  origens: Record<ComponentParamId, string>,
  activeIds: ReadonlySet<ComponentParamId>,
): void {
  const previousBySlot = new Map<
    string,
    { id: ComponentParamId; value: number; standard: number | null }
  >();
  const previousById = new Map<
    ComponentParamId,
    { value: number; standard: number | null }
  >();
  for (const target of tsecTargets(previousEntry)) {
    const standard = standardTsecForParam(previousEntry, target.id);
    const item = {
      id: target.id,
      value: previousParams[target.id] ?? 0,
      standard,
    };
    previousBySlot.set(`${target.role}:${target.nature}`, item);
    previousById.set(target.id, item);
  }
  for (const target of tsecTargets(entry)) {
    if (!activeIds.has(target.id)) continue;
    const nextStandard = standardTsecForParam(entry, target.id);
    const prev = previousBySlot.get(`${target.role}:${target.nature}`);
    if (prev) {
      const stillDefault =
        prev.standard != null ? prev.value === prev.standard : prev.value === 0;
      if (stillDefault) {
        params[target.id] = nextStandard ?? 0;
        if (nextStandard != null) origens[target.id] = TSEC_MANUAL_CITATION;
      } else if (prev.id !== target.id) {
        params[target.id] = prev.value;
      }
      continue;
    }
    const same = previousById.get(target.id);
    if (same) {
      const stillDefault =
        same.standard != null ? same.value === same.standard : same.value === 0;
      if (stillDefault) {
        params[target.id] = nextStandard ?? 0;
        if (nextStandard != null) origens[target.id] = TSEC_MANUAL_CITATION;
      }
      continue;
    }
    params[target.id] = nextStandard ?? 0;
    if (nextStandard != null) origens[target.id] = TSEC_MANUAL_CITATION;
  }
}

export function pmdRows(source: AirportSource = defaultAirport()): PmdRow[] {
  return PMD_TABLES[source.pmdTableId];
}

/** Ids antigos de semente → linha de PMD. */
export const LEGACY_COMPONENT_TO_PMD: Record<string, string> = {
  hall: "saguao-embarque",
  hallArrivals: "saguao-desembarque",
  checkin: "checkin-bagagens",
  security: "inspecao",
  emigration: "emigracao",
  immigration: "imigracao",
  customs: "aduana",
  boarding: "sala-embarque-pontes",
  boardingRemote: "sala-embarque-remotas",
  arrivals: "sala-desembarque",
};

export function pmdById(id: string, tableId?: PmdTableId): PmdRow | undefined {
  if (tableId) return PMD_TABLES[tableId].find((row) => row.id === id);
  return PMD_BY_ID[id];
}

export function pmdRowFor(
  rowId: string,
  source: AirportSource = defaultAirport(),
): PmdRow | undefined {
  return pmdRows(source).find((row) => row.id === rowId);
}

const LOUNGE_ROW_IDS = new Set([
  "sala-embarque-pontes",
  "sala-embarque-remotas",
  "salas-embarque",
]);

export function loungeRowIds(entry: RegistryEntry): string[] {
  const ids = [
    entry.pmd?.rowId,
    ...(entry.flows?.map((flow) => flow.pmd.rowId) ?? []),
  ];
  return [...new Set(ids.filter((id): id is string => id != null && LOUNGE_ROW_IDS.has(id)))];
}

/** A sala nasceu noutra conta de área e não vale para o aeroporto selecionado. */
export function loungeInvalidForAirport(
  entry: RegistryEntry,
  source: AirportSource = defaultAirport(),
): boolean {
  const ids = loungeRowIds(entry);
  if (ids.length === 0) return false;
  const rows = new Set(pmdRows(source).map((row) => row.id));
  return ids.some((id) => !rows.has(id));
}

export function isSplitLoungeRow(row: PmdRow | undefined): boolean {
  return row?.loungeMode === "sentado-em-pe";
}

export function isSplitLoungeEntry(entry: RegistryEntry): boolean {
  return loungeRowIds(entry).some((id) => isSplitLoungeRow(pmdById(id)));
}

export function roundLabel(roundId: RoundId = defaultAirport().roundId): string {
  return `${roundId}ª rodada`;
}

export function peakNatureLabel(nature: PeakNature): string {
  return nature === "internacional" ? "internacional" : "doméstico";
}

export function sourceCitation(source: AirportSource = defaultAirport()): string {
  return `${source.contract} (${source.icao}) · ${roundLabel(source.roundId)}`;
}

export function roundOrigem(
  nature: PeakNature,
  source: AirportSource = defaultAirport(),
): string {
  return `${source.contract} (${source.icao}) · ${source.peakLabel} ${peakNatureLabel(nature)}.`;
}

export function natureHasValues(row: PmdRow, nature: PeakNature): boolean {
  const values = row[nature];
  return (
    values.emp != null ||
    values.toiMinutes != null ||
    values.vaPerPax != null ||
    values.seatPercent != null ||
    values.occupancyPercent != null ||
    values.empStanding != null ||
    values.toiStandingMinutes != null
  );
}

export function defaultNatureFor(row: PmdRow): PeakNature {
  return natureHasValues(row, "domestico") ? "domestico" : "internacional";
}

export function normalizePmdBinding(binding: PmdBinding): PmdBinding | undefined {
  const row = pmdById(binding.rowId);
  if (!row) return undefined;
  const nature = natureHasValues(row, binding.nature)
    ? binding.nature
    : defaultNatureFor(row);
  return { rowId: row.id, nature };
}

export function pmdOrigem(
  binding: PmdBinding,
  source: AirportSource = defaultAirport(),
): string {
  const row = pmdById(binding.rowId);
  const peak = binding.nature === "domestico" ? "doméstico" : "internacional";
  return `${roundLabel(source.roundId)} · PMD “${row?.title ?? binding.rowId}” · hora-pico ${peak}.`;
}

export function sourceKey(binding: PmdBinding): string {
  return `${binding.rowId}::${binding.nature}`;
}

export function parseSourceKey(raw: string): PmdBinding | undefined {
  const [rowId, nature] = raw.split("::");
  if (!rowId || (nature !== "domestico" && nature !== "internacional")) {
    return undefined;
  }
  return normalizePmdBinding({ rowId, nature });
}

export function sizingMetricFor(
  id: SizingParamId,
): PmdMetricView["key"] {
  if (id === "percentualMinimoAssentos") return "seats";
  if (id === "percentualOcupacaoMaxima") return "occupancy";
  if (id === "espacoMinimoEmPe") return "empStanding";
  if (id === "tempoDeOcupacaoEmPe") return "toiStanding";
  if (id === "va" || id.startsWith("va")) return "va";
  if (id.startsWith("tempoDeOcupacao")) return "toi";
  return "emp";
}

function areaValue(
  values: RoundAreaValues,
  id: SizingParamId,
): number | null {
  switch (sizingMetricFor(id)) {
    case "emp":
      return values.emp;
    case "toi":
      return values.toiMinutes;
    case "va":
      return values.vaPerPax;
    case "seats":
      return values.seatPercent;
    case "occupancy":
      return values.occupancyPercent ?? null;
    case "empStanding":
      return values.empStanding ?? null;
    case "toiStanding":
      return values.toiStandingMinutes ?? null;
    case "tsec":
      return null;
  }
}

export function pmdValueFor(
  binding: PmdBinding,
  id: SizingParamId,
  source: AirportSource = defaultAirport(),
): number | null {
  const row = pmdRowFor(binding.rowId, source);
  if (!row) return null;
  return areaValue(pickAreaValues(row, binding.nature), id);
}

export interface PmdFieldOption {
  key: string;
  rowId: string;
  nature: PeakNature;
  label: string;
  value: number;
  unit: string;
}

export function pmdOptionsFor(
  id: SizingParamId,
  source: AirportSource = defaultAirport(),
): PmdFieldOption[] {
  const metricKey = sizingMetricFor(id);
  const options: PmdFieldOption[] = [];
  for (const row of pmdRows(source)) {
    for (const nature of ["domestico", "internacional"] as const) {
      const metric = pmdMetrics(row).find((item) => item.key === metricKey);
      const value = nature === "domestico" ? metric?.domestico : metric?.internacional;
      if (metric == null || value == null) continue;
      const peak = nature === "domestico" ? "doméstico" : "internacional";
      options.push({
        key: sourceKey({ rowId: row.id, nature }),
        rowId: row.id,
        nature,
        label: `${row.title} · ${peak} · ${value} ${metric.unit}`,
        value,
        unit: metric.unit,
      });
    }
  }
  return options;
}

export function sizingSourcesFromBinding(
  binding: PmdBinding | undefined,
): SizingSources {
  const normalized = binding ? normalizePmdBinding(binding) : undefined;
  if (!normalized) return {};
  const values = contractSizingValues(normalized);
  const next: SizingSources = {};
  for (const id of Object.keys(values) as SizingParamId[]) {
    if (values[id] != null) next[id] = normalized;
  }
  return next;
}

function assignFlowSources(
  next: SizingSources,
  flow: RegistryFlow,
  mixedNature: boolean,
): void {
  const binding = normalizePmdBinding(flow.pmd);
  if (!binding) return;
  const values = contractSizingValues(binding);
  const ids = flowParamIds(flow, mixedNature);
  if (values.espacoMinimoPorPassageiro != null) next[ids.emp] = binding;
  if (values.tempoDeOcupacao != null) next[ids.toi] = binding;
  if (values.va != null) next[ids.va] = binding;
  if (
    !mixedNature &&
    flow.role === "embarque" &&
    values.percentualMinimoAssentos != null
  ) {
    next.percentualMinimoAssentos = binding;
  }
  if (values.percentualOcupacaoMaxima != null) {
    next.percentualOcupacaoMaxima = binding;
  }
  if (values.espacoMinimoEmPe != null) next.espacoMinimoEmPe = binding;
  if (values.tempoDeOcupacaoEmPe != null) next.tempoDeOcupacaoEmPe = binding;
}

export function sizingSourcesFromFlows(flows: RegistryFlow[]): SizingSources {
  const mixedNature = isMixedNature({
    id: "",
    title: "",
    requirements: {},
    flows,
  });
  const next: SizingSources = {};
  for (const flow of flows) {
    assignFlowSources(next, flow, mixedNature);
  }
  return next;
}

export function resolvedSources(entry: RegistryEntry): SizingSources {
  if (entry.sizingSources && Object.keys(entry.sizingSources).length > 0) {
    return entry.sizingSources;
  }
  if (entry.flows && entry.flows.length > 0) {
    return sizingSourcesFromFlows(entry.flows);
  }
  return sizingSourcesFromBinding(entry.pmd);
}

export function overlaySizingSources(
  entry: RegistryEntry,
  params: ComponentParams,
  origens: Record<ComponentParamId, string>,
  source: AirportSource = defaultAirport(),
): { params: ComponentParams; origens: Record<ComponentParamId, string> } {
  const nextParams = { ...params };
  const nextOrigens = { ...origens };
  const sources = resolvedSources(entry);
  for (const id of Object.keys(sources) as SizingParamId[]) {
    const ref = sources[id];
    if (!ref) continue;
    const value = pmdValueFor(ref, id, source);
    if (value == null) continue;
    nextParams[id] = value;
    nextOrigens[id] = pmdOrigem(ref, source);
  }
  return { params: nextParams, origens: nextOrigens };
}

export function relabelPmdOrigens(
  registry: RegistryEntry[],
  origens: Record<ComponentId, Record<ComponentParamId, string>>,
  previous: AirportSource,
  next: AirportSource,
): Record<ComponentId, Record<ComponentParamId, string>> {
  const updated: Record<ComponentId, Record<ComponentParamId, string>> = {
    ...origens,
  };
  for (const entry of registry) {
    const current = updated[entry.id];
    if (!current) continue;
    const nextOrigens = { ...current };
    const sources = resolvedSources(entry);
    for (const id of Object.keys(sources) as SizingParamId[]) {
      const ref = sources[id];
      if (!ref) continue;
      if (!pmdRowFor(ref.rowId, next)) continue;
      if (nextOrigens[id] === pmdOrigem(ref, previous)) {
        nextOrigens[id] = pmdOrigem(ref, next);
      }
    }
    updated[entry.id] = nextOrigens;
  }
  return updated;
}

export interface PmdSideLine {
  key: PmdMetricView["key"];
  label: string;
  unit: string;
  value: number;
}

export function pmdSideLines(
  row: PmdRow,
  nature: PeakNature,
): PmdSideLine[] {
  const values = row[nature];
  const lines: PmdSideLine[] = [];
  if (row.loungeMode === "sentado-em-pe") {
    if (values.occupancyPercent != null) {
      lines.push({
        key: "occupancy",
        label: "Ocup_max",
        unit: "%",
        value: values.occupancyPercent,
      });
    }
    if (values.seatPercent != null) {
      lines.push({
        key: "seats",
        label: "Acesso a assentos (Pa)",
        unit: "%",
        value: values.seatPercent,
      });
    }
    if (values.emp != null) {
      lines.push({
        key: "emp",
        label: "Emp_s",
        unit: row.empUnit,
        value: values.emp,
      });
    }
    if (values.toiMinutes != null) {
      lines.push({
        key: "toi",
        label: "Toi_s",
        unit: "min",
        value: values.toiMinutes,
      });
    }
    if (values.empStanding != null) {
      lines.push({
        key: "empStanding",
        label: "Emp_p",
        unit: row.empUnit,
        value: values.empStanding,
      });
    }
    if (values.toiStandingMinutes != null) {
      lines.push({
        key: "toiStanding",
        label: "Toi_p",
        unit: "min",
        value: values.toiStandingMinutes,
      });
    }
    return lines;
  }
  if (values.emp != null) {
    lines.push({
      key: "emp",
      label: "Emp",
      unit: row.empUnit,
      value: values.emp,
    });
  }
  if (values.vaPerPax != null) {
    lines.push({
      key: "va",
      label: "v.a.",
      unit: "v.a./pax",
      value: values.vaPerPax,
    });
  }
  if (values.toiMinutes != null) {
    lines.push({
      key: "toi",
      label: "Toi",
      unit: "min",
      value: values.toiMinutes,
    });
  }
  if (values.seatPercent != null) {
    lines.push({
      key: "seats",
      label: "Assentos",
      unit: "%",
      value: values.seatPercent,
    });
  }
  const tsec = standardTsec(row.id, nature);
  if (tsec != null) {
    lines.push({
      key: "tsec",
      label: "tsec",
      unit: "s",
      value: tsec,
    });
  }
  return lines;
}

export function pmdMetrics(row: PmdRow): PmdMetricView[] {
  const metrics: PmdMetricView[] = [];
  if (row.loungeMode === "sentado-em-pe") {
    metrics.push(
      {
        key: "occupancy",
        label: "Máxima ocupação das salas (Ocup_max)",
        unit: "%",
        domestico: row.domestico.occupancyPercent ?? null,
        internacional: row.internacional.occupancyPercent ?? null,
      },
      {
        key: "seats",
        label: "Acesso a assentos (Pa)",
        unit: "%",
        domestico: row.domestico.seatPercent,
        internacional: row.internacional.seatPercent,
      },
      {
        key: "emp",
        label: "Área para passageiros sentados (Emp_s)",
        unit: row.empUnit,
        domestico: row.domestico.emp,
        internacional: row.internacional.emp,
      },
      {
        key: "toi",
        label: "Tempo de ocupação sentado (Toi_s)",
        unit: "min",
        domestico: row.domestico.toiMinutes,
        internacional: row.internacional.toiMinutes,
      },
      {
        key: "empStanding",
        label: "Área para passageiros em pé (Emp_p)",
        unit: row.empUnit,
        domestico: row.domestico.empStanding ?? null,
        internacional: row.internacional.empStanding ?? null,
      },
      {
        key: "toiStanding",
        label: "Tempo de ocupação em pé (Toi_p)",
        unit: "min",
        domestico: row.domestico.toiStandingMinutes ?? null,
        internacional: row.internacional.toiStandingMinutes ?? null,
      },
    );
    return metrics;
  }
  if (row.domestico.emp != null || row.internacional.emp != null) {
    metrics.push({
      key: "emp",
      label: "Espaço mínimo (Emp)",
      unit: row.empUnit,
      domestico: row.domestico.emp,
      internacional: row.internacional.emp,
    });
  }
  if (row.domestico.vaPerPax != null || row.internacional.vaPerPax != null) {
    metrics.push({
      key: "va",
      label: "Visitante-acompanhante (v.a.)",
      unit: "v.a./pax",
      domestico: row.domestico.vaPerPax,
      internacional: row.internacional.vaPerPax,
    });
  }
  if (row.domestico.toiMinutes != null || row.internacional.toiMinutes != null) {
    metrics.push({
      key: "toi",
      label: "Tempo de ocupação (Toi)",
      unit: "min",
      domestico: row.domestico.toiMinutes,
      internacional: row.internacional.toiMinutes,
    });
  }
  if (row.domestico.seatPercent != null || row.internacional.seatPercent != null) {
    metrics.push({
      key: "seats",
      label: "Percentual mínimo de assentos",
      unit: "%",
      domestico: row.domestico.seatPercent,
      internacional: row.internacional.seatPercent,
    });
  }
  const tsecDomestico = standardTsec(row.id, "domestico");
  const tsecInternacional = standardTsec(row.id, "internacional");
  if (tsecDomestico != null || tsecInternacional != null) {
    metrics.push({
      key: "tsec",
      label: "Tempo de serviço do equipamento (tsec)",
      unit: "s",
      domestico: tsecDomestico,
      internacional: tsecInternacional,
    });
  }
  return metrics;
}

export function pickAreaValues(
  row: PmdRow,
  nature: PeakNature,
): RoundAreaValues {
  return row[natureHasValues(row, nature) ? nature : defaultNatureFor(row)];
}

export function applyPmdRequirements(entry: RegistryEntry): RegistryEntry {
  if (entry.flows && entry.flows.length > 0) {
    const flows: RegistryFlow[] = [];
    for (const flow of entry.flows) {
      const pmd = normalizePmdBinding(flow.pmd);
      if (!pmd) continue;
      flows.push({ role: flow.role, pmd });
    }
    const sizingSources = {
      ...sizingSourcesFromFlows(flows),
      ...(entry.sizingSources ?? {}),
    };
    const embarque = flows.find((flow) => flow.role === "embarque");
    return {
      ...entry,
      flows,
      pmd: embarque?.pmd ?? flows[0]?.pmd ?? entry.pmd,
      sizingSources:
        Object.keys(sizingSources).length > 0 ? sizingSources : undefined,
    };
  }
  const binding = entry.pmd ? normalizePmdBinding(entry.pmd) : undefined;
  const sizingSources = {
    ...sizingSourcesFromBinding(binding),
    ...(entry.sizingSources ?? {}),
  };
  const empSource = sizingSources.espacoMinimoPorPassageiro;
  return {
    ...entry,
    pmd: empSource ?? binding,
    sizingSources: Object.keys(sizingSources).length > 0 ? sizingSources : undefined,
  };
}

export function overlayRoundParams(
  binding: PmdBinding | undefined,
  params: ComponentParams,
  origens: Record<ComponentParamId, string>,
  source: AirportSource = defaultAirport(),
): { params: ComponentParams; origens: Record<ComponentParamId, string> } {
  const normalized = binding ? normalizePmdBinding(binding) : undefined;
  if (!normalized) return { params, origens };
  const row = pmdById(normalized.rowId);
  if (!row) return { params, origens };
  const values = pickAreaValues(row, normalized.nature);
  const origem = pmdOrigem(normalized, source);
  const nextParams = { ...params };
  const nextOrigens = { ...origens };
  if (values.emp != null) {
    nextParams.espacoMinimoPorPassageiro = values.emp;
    nextOrigens.espacoMinimoPorPassageiro = origem;
  }
  if (values.toiMinutes != null) {
    nextParams.tempoDeOcupacao = values.toiMinutes;
    nextOrigens.tempoDeOcupacao = origem;
  }
  if (values.vaPerPax != null) {
    nextParams.va = values.vaPerPax;
    nextOrigens.va = origem;
  }
  if (values.seatPercent != null) {
    nextParams.percentualMinimoAssentos = values.seatPercent;
    nextOrigens.percentualMinimoAssentos = origem;
  }
  if (values.occupancyPercent != null) {
    nextParams.percentualOcupacaoMaxima = values.occupancyPercent;
    nextOrigens.percentualOcupacaoMaxima = origem;
  }
  if (values.empStanding != null) {
    nextParams.espacoMinimoEmPe = values.empStanding;
    nextOrigens.espacoMinimoEmPe = origem;
  }
  if (values.toiStandingMinutes != null) {
    nextParams.tempoDeOcupacaoEmPe = values.toiStandingMinutes;
    nextOrigens.tempoDeOcupacaoEmPe = origem;
  }
  return { params: nextParams, origens: nextOrigens };
}

export function contractSizingValues(
  binding: PmdBinding | undefined,
): Partial<Record<SizingParamId, number>> {
  const normalized = binding ? normalizePmdBinding(binding) : undefined;
  if (!normalized) return {};
  const row = pmdById(normalized.rowId);
  if (!row) return {};
  const values = pickAreaValues(row, normalized.nature);
  const next: Partial<Record<SizingParamId, number>> = {};
  if (values.emp != null) next.espacoMinimoPorPassageiro = values.emp;
  if (values.toiMinutes != null) next.tempoDeOcupacao = values.toiMinutes;
  if (values.vaPerPax != null) next.va = values.vaPerPax;
  if (values.seatPercent != null) next.percentualMinimoAssentos = values.seatPercent;
  if (values.occupancyPercent != null) {
    next.percentualOcupacaoMaxima = values.occupancyPercent;
  }
  if (values.empStanding != null) next.espacoMinimoEmPe = values.empStanding;
  if (values.toiStandingMinutes != null) {
    next.tempoDeOcupacaoEmPe = values.toiStandingMinutes;
  }
  return next;
}

export function roundHasSeats(entry: RegistryEntry): boolean {
  if (!entry.requirements.area) return false;
  if (isSplitLoungeEntry(entry)) return false;
  const sources = resolvedSources(entry);
  if (sources.percentualMinimoAssentos) return true;
  for (const ref of Object.values(sources)) {
    const row = pmdById(ref.rowId);
    if (!row) continue;
    if (row.domestico.seatPercent != null || row.internacional.seatPercent != null) {
      return true;
    }
  }
  return false;
}

export function empUnitFor(
  entry: RegistryEntry,
  companions: boolean,
): EmpUnit {
  const sources = resolvedSources(entry);
  const ref =
    sources.espacoMinimoPorPassageiro ??
    sources.espacoMinimoPorPassageiroEmbarque ??
    sources.espacoMinimoPorPassageiroEmbarqueDomestico ??
    sources.espacoMinimoPorPassageiroDomestico ??
    entry.pmd;
  const row = ref ? pmdById(ref.rowId) : undefined;
  return row?.empUnit ?? (companions ? "m²/ocup" : "m²/pax");
}

export function empUnitForFlow(
  entry: RegistryEntry,
  role: RegistryFlow["role"],
  companions: boolean,
): EmpUnit {
  const sources = resolvedSources(entry);
  const ref =
    role === "embarque"
      ? (sources.espacoMinimoPorPassageiroEmbarque ??
        sources.espacoMinimoPorPassageiroEmbarqueDomestico ??
        entry.flows?.find((flow) => flow.role === "embarque")?.pmd)
      : (sources.espacoMinimoPorPassageiroDesembarque ??
        sources.espacoMinimoPorPassageiroDesembarqueDomestico ??
        entry.flows?.find((flow) => flow.role === "desembarque")?.pmd);
  const row = ref ? pmdById(ref.rowId) : undefined;
  return row?.empUnit ?? (companions ? "m²/ocup" : "m²/pax");
}

export function empLabelFor(unit: EmpUnit): string {
  return unit === "m²/ocup"
    ? "Espaço mínimo por ocupante (Emp)"
    : "Espaço mínimo por passageiro (Emp)";
}

export function resolveContractValue(
  entry: RegistryEntry | undefined,
  field: ParamField<ComponentParamId>,
  source: AirportSource = defaultAirport(),
): { value: number; source: "pmd" | "model" } {
  if (field.kind === "sizing" && entry) {
    const ref = resolvedSources(entry)[field.id as SizingParamId];
    if (ref) {
      const fromPmd = pmdValueFor(ref, field.id as SizingParamId, source);
      if (fromPmd != null) return { value: fromPmd, source: "pmd" };
    }
  }
  return { value: field.defaultValue, source: "model" };
}

export function usedByPmd(
  registry: RegistryEntry[],
  rowId: string,
): RegistryEntry[] {
  return registry.filter((entry) =>
    Object.values(resolvedSources(entry)).some((ref) => ref.rowId === rowId),
  );
}

export function naturesUsedOnRow(
  entry: RegistryEntry,
  rowId: string,
): PeakNature[] {
  const natures = new Set<PeakNature>();
  for (const ref of Object.values(resolvedSources(entry))) {
    if (ref.rowId === rowId) natures.add(ref.nature);
  }
  return [...natures];
}

export function migrateLegacyPmd(
  entry: RegistryEntry,
  peakNature: PeakNature = DEFAULT_PEAK_NATURE,
): RegistryEntry {
  if (entry.pmd) {
    return applyPmdRequirements({
      ...entry,
      pmd: normalizePmdBinding(entry.pmd),
    });
  }
  const rowId = LEGACY_COMPONENT_TO_PMD[entry.id];
  if (!rowId) return entry;
  return applyPmdRequirements({
    ...entry,
    pmd: { rowId, nature: peakNature },
  });
}

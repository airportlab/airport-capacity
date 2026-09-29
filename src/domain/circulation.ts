export const PMM_STANDARD = 20;
export const EFFECT_MINIMUM_M = 0.5;
export const WIDTH_FLOOR_M = 1.5;

export type CirculationKind = "interna" | "transicao";

export interface HorizontalCirculation {
  id: string;
  title: string;
  kind: CirculationKind;
  componentId: string;
  fromId: string;
  toId: string;
  dhp: number;
  pmm: number;
  pmmJustificativa: string;
  efeitoBorda: boolean;
  eb: number;
  ebJustificativa: string;
  efeitoContrafluxo: boolean;
  ec: number;
  ecJustificativa: string;
  observacoes: string;
  larguraMedida: number | null;
}

export interface CirculationWidths {
  le: number;
  lt: number;
  chp: number | null;
  raised: boolean;
  atende: boolean | null;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function createCirculation(id: string, title: string): HorizontalCirculation {
  return {
    id,
    title,
    kind: "interna",
    componentId: "",
    fromId: "",
    toId: "",
    dhp: 0,
    pmm: PMM_STANDARD,
    pmmJustificativa: "",
    efeitoBorda: false,
    eb: EFFECT_MINIMUM_M,
    ebJustificativa: "",
    efeitoContrafluxo: false,
    ec: EFFECT_MINIMUM_M,
    ecJustificativa: "",
    observacoes: "",
    larguraMedida: null,
  };
}

export function pmmNeedsJustification(pmm: number): boolean {
  return !near(pmm, PMM_STANDARD);
}

export function effectNeedsJustification(value: number): boolean {
  return !near(value, EFFECT_MINIMUM_M);
}

function appliedEb(item: HorizontalCirculation): number {
  return item.efeitoBorda ? item.eb : 0;
}

function appliedEc(item: HorizontalCirculation): number {
  return item.efeitoContrafluxo ? item.ec : 0;
}

export function circulationWidths(item: HorizontalCirculation): CirculationWidths {
  const le = item.pmm > 0 ? item.dhp / (item.pmm * 60) : Number.NaN;
  const extra = 2 * appliedEb(item) + appliedEc(item);
  const raw = Number.isFinite(le) ? le + extra : Number.NaN;
  const finiteRaw = Number.isFinite(raw);
  const lt = finiteRaw ? Math.max(WIDTH_FLOOR_M, raw) : Number.NaN;
  const raised = finiteRaw && raw < WIDTH_FLOOR_M - 1e-9;
  const atende =
    item.larguraMedida != null && Number.isFinite(lt)
      ? item.larguraMedida + 1e-9 >= lt
      : null;
  let chp: number | null = null;
  if (item.larguraMedida != null && item.pmm > 0) {
    const util = item.larguraMedida - extra;
    chp = util < 0 ? 0 : util * item.pmm * 60;
  }
  return { le, lt, chp, raised, atende };
}

export function clearCirculationComponent(
  items: HorizontalCirculation[],
  componentId: string,
): HorizontalCirculation[] {
  return items.map((item) => ({
    ...item,
    componentId: item.componentId === componentId ? "" : item.componentId,
    fromId: item.fromId === componentId ? "" : item.fromId,
    toId: item.toId === componentId ? "" : item.toId,
  }));
}

export function clearCirculationLinks(
  items: HorizontalCirculation[],
): HorizontalCirculation[] {
  return items.map((item) => ({
    ...item,
    componentId: "",
    fromId: "",
    toId: "",
  }));
}

function keepId(id: string, validIds: ReadonlySet<string>): string {
  return validIds.has(id) ? id : "";
}

function clampEffect(value: unknown): number {
  if (!finite(value)) return EFFECT_MINIMUM_M;
  return value;
}

export function parseCirculations(
  raw: unknown,
  validIds: ReadonlySet<string>,
): HorizontalCirculation[] {
  if (!Array.isArray(raw)) return [];
  const items: HorizontalCirculation[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || record.id.trim() === "" || seen.has(record.id)) {
      continue;
    }
    seen.add(record.id);
    const kind: CirculationKind = record.kind === "transicao" ? "transicao" : "interna";
    const dhp = finite(record.dhp) && record.dhp >= 0 ? record.dhp : 0;
    const pmm = finite(record.pmm) && record.pmm > 0 ? record.pmm : PMM_STANDARD;
    const larguraMedida =
      finite(record.larguraMedida) && record.larguraMedida >= 0
        ? record.larguraMedida
        : null;
    items.push({
      id: record.id,
      title: typeof record.title === "string" && record.title.trim() !== ""
        ? record.title
        : "Circulação",
      kind,
      componentId: kind === "interna" && typeof record.componentId === "string"
        ? keepId(record.componentId, validIds)
        : "",
      fromId: kind === "transicao" && typeof record.fromId === "string"
        ? keepId(record.fromId, validIds)
        : "",
      toId: kind === "transicao" && typeof record.toId === "string"
        ? keepId(record.toId, validIds)
        : "",
      dhp,
      pmm,
      pmmJustificativa:
        typeof record.pmmJustificativa === "string" ? record.pmmJustificativa : "",
      efeitoBorda:
        typeof record.efeitoBorda === "boolean"
          ? record.efeitoBorda
          : record.withEffects === true,
      eb: clampEffect(record.eb),
      ebJustificativa:
        typeof record.ebJustificativa === "string" ? record.ebJustificativa : "",
      efeitoContrafluxo:
        typeof record.efeitoContrafluxo === "boolean"
          ? record.efeitoContrafluxo
          : record.withEffects === true && record.bidirectional === true,
      ec: clampEffect(record.ec),
      ecJustificativa:
        typeof record.ecJustificativa === "string" ? record.ecJustificativa : "",
      observacoes: typeof record.observacoes === "string" ? record.observacoes : "",
      larguraMedida,
    });
  }
  return items;
}

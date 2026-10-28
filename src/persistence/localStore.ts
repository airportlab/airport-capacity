import {
  airportById,
  defaultAirport,
  parseAirportId,
  type AirportId,
  type AirportSource,
} from "../domain/airports";
import {
  parseCirculations,
  type HorizontalCirculation,
} from "../domain/circulation";
import {
  defaultComponentOrigens,
  defaultComponentParams,
  emptyJustificativas,
  origensFromRegistry,
  paramsFromRegistry,
} from "../domain/contracts/catalog";
import { isTaxaParam } from "../domain/contracts/fields";
import { exampleStudy } from "../domain/exampleStudy";
import { makeContract } from "../domain/contracts/factory";
import {
  organAllowsCompanions,
  organAllowsEquipment,
  organAllowsEquipmentTaxa,
  rebindOrganNature,
  remapDemandaOnNatureChange,
} from "../domain/templates/organs";
import {
  applyPmdRequirements,
  normalizePmdBinding,
  overlaySizingSources,
  type RoundId,
} from "../domain/pmd";
import type {
  AreaRequirement,
  ComponentId,
  ComponentJustificativas,
  ComponentParamId,
  ComponentParams,
  ComponentRequirements,
  EquipmentRequirement,
  EsteiraRequirement,
  OrganFunctionRole,
  PmdBinding,
  RegistryEntry,
  RegistryFlow,
  SizingSources,
} from "../domain/types";
import {
  BOARDING_CONNECTION_CATALOG,
  COMPONENT_PARAM_IDS,
  JUSTIFICATIVA_IDS,
  SIZING_PARAM_IDS,
  isMixedNature,
  natureOfEntry,
  type BoardingConnections,
  type JustificativaId,
} from "../domain/types";

export interface PersistedAirportState {
  savedAt: string;
  airportId: AirportId;
  airportName: string;
  roundId: RoundId;
  evaluationMonth: number | null;
  evaluationYear: number | null;
  registry: RegistryEntry[];
  components: Record<ComponentId, ComponentParams>;
  componentOrigens: Record<ComponentId, Record<ComponentParamId, string>>;
  justificativas: Record<ComponentId, ComponentJustificativas>;
  circulations: HorizontalCirculation[];
}

export type EditorState = Omit<PersistedAirportState, "savedAt"> & {
  savedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseEvaluationMonth(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 12) return null;
  return value;
}

function parseEvaluationYear(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 9999) return null;
  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pickNumbers<K extends string>(
  source: Record<string, unknown>,
  keys: readonly K[],
  fallback: Record<K, number>,
): Record<K, number> {
  const next = { ...fallback };
  for (const key of keys) {
    if (isFiniteNumber(source[key])) {
      next[key] = source[key];
    }
  }
  return next;
}

/** O DHp antigo de DOM/INT vira DOM-INT. O internacional era a soma e não se reparte. */
function copyLegacyArrivalsConnection(
  raw: Record<string, unknown>,
  params: ComponentParams,
): void {
  if (isFiniteNumber(raw.demandaPicoConexaoDesembarqueDomInt)) return;
  if (!isFiniteNumber(raw.demandaPicoConexaoDesembarqueDomestico)) return;
  params.demandaPicoConexaoDesembarqueDomInt =
    raw.demandaPicoConexaoDesembarqueDomestico;
}

function copyLegacyEquipmentTaxa(
  entry: RegistryEntry,
  raw: Record<string, unknown>,
  params: ComponentParams,
): void {
  if (entry.kind !== "checkin-bagagens" || natureOfEntry(entry) !== "misto") return;
  if (!isFiniteNumber(raw.taxaDeUsoEquipamento)) return;
  if (!isFiniteNumber(raw.taxaDeUsoEquipamentoDomestico)) {
    params.taxaDeUsoEquipamentoDomestico = raw.taxaDeUsoEquipamento;
  }
  if (!isFiniteNumber(raw.taxaDeUsoEquipamentoInternacional)) {
    params.taxaDeUsoEquipamentoInternacional = raw.taxaDeUsoEquipamento;
  }
}

function pickStrings<K extends string>(
  source: Record<string, unknown>,
  keys: readonly K[],
  fallback: Record<K, string>,
): Record<K, string> {
  const next = { ...fallback };
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      next[key] = value;
    }
  }
  return next;
}

function parsePmd(raw: unknown): PmdBinding | undefined {
  if (!isRecord(raw) || typeof raw.rowId !== "string") return undefined;
  return normalizePmdBinding({
    rowId: raw.rowId,
    nature: raw.nature === "internacional" ? "internacional" : "domestico",
  });
}

function parseFlowRole(raw: unknown): OrganFunctionRole | undefined {
  return raw === "embarque" || raw === "desembarque" || raw === "unico"
    ? raw
    : undefined;
}

function parseFlows(raw: unknown): RegistryFlow[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const flows: RegistryFlow[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const role = parseFlowRole(item.role);
    const pmd = parsePmd(item.pmd);
    if (!role || !pmd) continue;
    flows.push({ role, pmd });
  }
  return flows.length > 0 ? flows : undefined;
}

function parseSizingSources(raw: unknown): SizingSources | undefined {
  if (!isRecord(raw)) return undefined;
  const next: SizingSources = {};
  for (const id of SIZING_PARAM_IDS) {
    const binding = parsePmd(raw[id]);
    if (binding) next[id] = binding;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function parseAreaRequirement(raw: unknown): AreaRequirement | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    companions: raw.companions === true,
  };
}

function parseEquipmentRequirement(
  raw: unknown,
): EquipmentRequirement | undefined {
  if (raw === true) return {};
  if (!isRecord(raw)) return undefined;
  return raw.taxaDiferente === true ? { taxaDiferente: true } : {};
}

function parseEsteiraRequirement(raw: unknown): EsteiraRequirement | undefined {
  if (raw === true) return {};
  if (!isRecord(raw)) return undefined;
  return raw.taxaDiferente === true ? { taxaDiferente: true } : {};
}

function clampArrivalsRequirements(entry: RegistryEntry): RegistryEntry {
  let next = entry;
  if (!organAllowsEquipment(entry) && entry.requirements.equipment) {
    const requirements = { ...entry.requirements };
    delete requirements.equipment;
    next = { ...entry, requirements };
  }
  if (next.kind === "sala-desembarque" || !next.requirements.esteira) return next;
  const requirements = { ...next.requirements };
  delete requirements.esteira;
  return { ...next, requirements };
}

function clampEquipmentTaxa(entry: RegistryEntry): RegistryEntry {
  const equipment = entry.requirements.equipment;
  if (!equipment?.taxaDiferente || organAllowsEquipmentTaxa(entry)) return entry;
  const next = { ...equipment };
  delete next.taxaDiferente;
  return {
    ...entry,
    requirements: { ...entry.requirements, equipment: next },
  };
}

function clampAreaCompanions(entry: RegistryEntry): RegistryEntry {
  const area = entry.requirements.area;
  if (!area?.companions || organAllowsCompanions(entry)) return entry;
  return {
    ...entry,
    requirements: {
      ...entry.requirements,
      area: { ...area, companions: false },
    },
  };
}

function ensureAreaRequirement(entry: RegistryEntry): RegistryEntry {
  if (entry.requirements.area) return entry;
  return {
    ...entry,
    requirements: {
      ...entry.requirements,
      area: { companions: organAllowsCompanions(entry) },
    },
  };
}

function parseRequirements(raw: unknown): ComponentRequirements | null {
  if (!isRecord(raw)) return null;
  const requirements: ComponentRequirements = {};
  const area = parseAreaRequirement(raw.area);
  if (area) requirements.area = area;
  const equipment = parseEquipmentRequirement(raw.equipment);
  if (equipment) requirements.equipment = equipment;
  const esteira = parseEsteiraRequirement(raw.esteira);
  if (esteira) requirements.esteira = esteira;
  return requirements;
}

function isCurbEntry(item: Record<string, unknown>): boolean {
  if (item.id === "curb" || item.kind === "special") return true;
  const title = typeof item.title === "string" ? item.title.trim().toLowerCase() : "";
  return title === "meio-fio" || title === "meio fio";
}

function parseOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseConexoes(raw: unknown): BoardingConnections | undefined {
  if (!isRecord(raw)) return undefined;
  const next: BoardingConnections = {};
  let seen = false;
  for (const spec of BOARDING_CONNECTION_CATALOG) {
    if (raw[spec.pair] === true || raw[spec.pair] === false) {
      next[spec.pair] = raw[spec.pair] === true;
      seen = true;
    }
  }
  return seen ? next : undefined;
}

function parseRegistry(raw: unknown): RegistryEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const entries: RegistryEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.title !== "string") {
      return null;
    }
    if (isCurbEntry(item)) continue;
    const fromRequirements = parseRequirements(item.requirements);
    if (!fromRequirements) return null;
    const observacoes = parseOptionalText(item.observacoes);
    const conexoes = parseConexoes(item.conexoes);
    const conexoesDesembarque = parseConexoes(item.conexoesDesembarque);
    entries.push(
      ensureAreaRequirement(
        clampEquipmentTaxa(clampArrivalsRequirements(clampAreaCompanions({
          id: item.id,
          title: item.title,
          kind: typeof item.kind === "string" ? item.kind : undefined,
          requirements: fromRequirements,
          pmd: parsePmd(item.pmd),
          flows: parseFlows(item.flows),
          sizingSources: parseSizingSources(item.sizingSources),
          observacoes,
          ...(item.hasConnection === true ? { hasConnection: true } : {}),
          ...(conexoes ? { conexoes } : {}),
          ...(item.hasDesembarqueConnection === true
            ? { hasDesembarqueConnection: true }
            : {}),
          ...(conexoesDesembarque ? { conexoesDesembarque } : {}),
        }))),
      ),
    );
  }
  return entries;
}

function overlayComponents(
  registry: RegistryEntry[],
  rawComponents: unknown,
  rawOrigens: unknown,
  source = defaultAirport(),
): Pick<PersistedAirportState, "components" | "componentOrigens"> {
  const defaults = {
    components: paramsFromRegistry(registry, source),
    componentOrigens: origensFromRegistry(registry, source),
  };
  const components = { ...defaults.components };
  const componentOrigens = { ...defaults.componentOrigens };

  if (isRecord(rawComponents)) {
    for (const entry of registry) {
      if (isRecord(rawComponents[entry.id])) {
        components[entry.id] = pickNumbers(
          rawComponents[entry.id] as Record<string, unknown>,
          COMPONENT_PARAM_IDS,
          defaults.components[entry.id] ?? defaultComponentParams(makeContract(entry)),
        );
        copyLegacyEquipmentTaxa(
          entry,
          rawComponents[entry.id] as Record<string, unknown>,
          components[entry.id],
        );
        copyLegacyArrivalsConnection(
          rawComponents[entry.id] as Record<string, unknown>,
          components[entry.id],
        );
      }
    }
  }

  if (isRecord(rawOrigens)) {
    for (const entry of registry) {
      if (isRecord(rawOrigens[entry.id])) {
        componentOrigens[entry.id] = pickStrings(
          rawOrigens[entry.id] as Record<string, unknown>,
          COMPONENT_PARAM_IDS,
          defaults.componentOrigens[entry.id] ??
            defaultComponentOrigens(makeContract(entry)),
        );
      }
    }
  }

  return { components, componentOrigens };
}

function emptyJustificativaStrings(): Record<JustificativaId, string> {
  return Object.fromEntries(JUSTIFICATIVA_IDS.map((id) => [id, ""])) as Record<
    JustificativaId,
    string
  >;
}

function parseJustificativas(
  raw: unknown,
  registry: RegistryEntry[],
): Record<ComponentId, ComponentJustificativas> {
  const next = emptyJustificativas();
  if (!isRecord(raw)) return next;
  for (const entry of registry) {
    if (!isRecord(raw[entry.id])) continue;
    const picked = pickStrings(
      raw[entry.id] as Record<string, unknown>,
      JUSTIFICATIVA_IDS,
      emptyJustificativaStrings(),
    );
    const trimmed: ComponentJustificativas = {};
    for (const id of JUSTIFICATIVA_IDS) {
      if (picked[id].trim() !== "") trimmed[id] = picked[id];
    }
    next[entry.id] = trimmed;
  }
  return next;
}

/** Sala mista gravada reabre na natureza do pmd. O DHp dessa coluna permanece. */
function collapseMixedArrivalsHall(entry: RegistryEntry): RegistryEntry {
  if (entry.kind !== "sala-desembarque" || !isMixedNature(entry)) return entry;
  const nature =
    entry.pmd?.nature === "internacional" ? "internacional" : "domestico";
  return rebindOrganNature(entry, nature);
}

function restoreCollapsedArrivals(
  from: RegistryEntry,
  to: RegistryEntry,
  rawParams: Record<string, unknown> | undefined,
  rawOrigens: Record<string, unknown> | undefined,
  source: AirportSource,
): { params: ComponentParams; origens: Record<ComponentParamId, string> } {
  const contract = makeContract(to);
  const previous = makeContract(from);
  const params = defaultComponentParams(contract);
  const origens = defaultComponentOrigens(contract);
  const keep = new Set(previous.params.map((field) => field.id));
  const picked = rawParams
    ? pickNumbers(rawParams, COMPONENT_PARAM_IDS, params)
    : params;
  if (rawParams) {
    for (const field of contract.params) {
      if (keep.has(field.id) || isTaxaParam(field.id)) {
        params[field.id] = picked[field.id];
      }
    }
    const remapped = remapDemandaOnNatureChange(from, to, picked);
    for (const id of Object.keys(remapped) as ComponentParamId[]) {
      const value = remapped[id];
      if (value != null) params[id] = value;
    }
  }
  if (rawOrigens) {
    const pickedOrigens = pickStrings(
      rawOrigens,
      COMPONENT_PARAM_IDS,
      origens,
    );
    for (const field of contract.params) {
      if (!keep.has(field.id)) continue;
      const origem = pickedOrigens[field.id];
      if (origem) origens[field.id] = origem;
    }
  }
  return overlaySizingSources(to, params, origens, source);
}

export function parsePersistedState(raw: unknown): PersistedAirportState | null {
  if (!isRecord(raw) || typeof raw.savedAt !== "string") return null;
  const parsed = parseRegistry(raw.registry);
  if (parsed === null) return null;
  const collapsedFrom = new Map<ComponentId, RegistryEntry>();
  const registry = parsed.map((entry) => {
    const collapsed = collapseMixedArrivalsHall(entry);
    if (collapsed !== entry) collapsedFrom.set(entry.id, entry);
    return applyPmdRequirements(collapsed);
  });
  const airport = airportById(parseAirportId(raw.airportId));
  const overlaid = overlayComponents(
    registry,
    raw.components,
    raw.componentOrigens,
    airport,
  );
  const rawComponents = isRecord(raw.components) ? raw.components : undefined;
  const rawOrigens = isRecord(raw.componentOrigens)
    ? raw.componentOrigens
    : undefined;
  for (const [id, from] of collapsedFrom) {
    const to = registry.find((entry) => entry.id === id);
    if (!to) continue;
    const restored = restoreCollapsedArrivals(
      from,
      to,
      rawComponents && isRecord(rawComponents[id]) ? rawComponents[id] : undefined,
      rawOrigens && isRecord(rawOrigens[id]) ? rawOrigens[id] : undefined,
      airport,
    );
    overlaid.components[id] = restored.params;
    overlaid.componentOrigens[id] = restored.origens;
  }

  return {
    savedAt: raw.savedAt,
    airportId: airport.id,
    airportName: typeof raw.airportName === "string" ? raw.airportName : "",
    roundId: airport.roundId,
    evaluationMonth: parseEvaluationMonth(raw.evaluationMonth),
    evaluationYear: parseEvaluationYear(raw.evaluationYear),
    registry,
    components: overlaid.components,
    componentOrigens: overlaid.componentOrigens,
    justificativas: parseJustificativas(raw.justificativas, registry),
    circulations: parseCirculations(
      raw.circulations,
      new Set(registry.map((entry) => entry.id)),
    ),
  };
}

export function createPersistedState(
  state: Omit<PersistedAirportState, "savedAt">,
): PersistedAirportState {
  return {
    savedAt: new Date().toISOString(),
    ...state,
  };
}

export function emptyEditorState(): EditorState {
  const airport = defaultAirport();
  return {
    savedAt: null,
    airportId: airport.id,
    airportName: "",
    roundId: airport.roundId,
    evaluationMonth: null,
    evaluationYear: null,
    registry: [],
    components: {},
    componentOrigens: {},
    justificativas: {},
    circulations: [],
  };
}

export function exampleEditorState(
  airportName = "",
  airportId: AirportId = defaultAirport().id,
  evaluationMonth: number | null = null,
  evaluationYear: number | null = null,
): EditorState {
  const airport = airportById(airportId);
  const study = exampleStudy(airport);
  return {
    savedAt: null,
    airportId: airport.id,
    airportName: airportName.trim() ? airportName : "Exemplo fictício",
    roundId: airport.roundId,
    ...study,
    evaluationMonth,
    evaluationYear,
  };
}

import {
  airportById,
  defaultAirport,
  parseAirportId,
  type AirportId,
} from "../domain/airports";
import {
  defaultComponentOrigens,
  defaultComponentParams,
  emptyAirportDefaults,
  emptyJustificativas,
  origensFromRegistry,
  paramsFromRegistry,
  seedRegistry,
} from "../domain/contracts/catalog";
import { makeContract, requirementsFromLegacyTemplate } from "../domain/contracts/factory";
import {
  applyPmdRequirements,
  DEFAULT_PEAK_NATURE,
  migrateLegacyPmd,
  normalizePmdBinding,
  type PeakNature,
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
  OrganFunctionRole,
  PmdBinding,
  RegistryEntry,
  RegistryFlow,
  SizingParamId,
  SizingSources,
} from "../domain/types";
import { COMPONENT_PARAM_IDS, SIZING_PARAM_IDS } from "../domain/types";

export const STATE_VERSION = 7 as const;

export interface PersistedAirportState {
  version: typeof STATE_VERSION;
  savedAt: string;
  airportId: AirportId;
  airportName: string;
  roundId: RoundId;
  registry: RegistryEntry[];
  components: Record<ComponentId, ComponentParams>;
  componentOrigens: Record<ComponentId, Record<ComponentParamId, string>>;
  justificativas: Record<ComponentId, ComponentJustificativas>;
}

export type EditorState = Omit<PersistedAirportState, "savedAt"> & {
  savedAt: string | null;
};

function parsePeakNature(raw: unknown): PeakNature {
  return raw === "internacional" ? "internacional" : DEFAULT_PEAK_NATURE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function asPercent(value: number): number {
  if (value > 0 && value <= 1) return value * 100;
  return value;
}

function normalizeTaxaFields(params: ComponentParams): ComponentParams {
  const next = { ...params };
  if (next.taxaDeUsoArea > 0 && next.taxaDeUsoArea <= 1) {
    next.taxaDeUsoArea = next.taxaDeUsoArea * 100;
  }
  if (next.taxaDeUsoEquipamento > 0 && next.taxaDeUsoEquipamento <= 1) {
    next.taxaDeUsoEquipamento = next.taxaDeUsoEquipamento * 100;
  }
  return next;
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
  return raw === "embarque" || raw === "desembarque" ? raw : undefined;
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
    ...(raw.taxaDiferente === true ? { taxaDiferente: true } : {}),
  };
}

function parseEquipmentRequirement(
  raw: unknown,
): EquipmentRequirement | undefined {
  if (raw === true) return {};
  if (!isRecord(raw)) return undefined;
  return raw.taxaDiferente === true ? { taxaDiferente: true } : {};
}

function parseRequirements(raw: unknown): ComponentRequirements | null {
  if (!isRecord(raw)) return null;
  const requirements: ComponentRequirements = {};
  const area = parseAreaRequirement(raw.area);
  if (area) requirements.area = area;
  const equipment = parseEquipmentRequirement(raw.equipment);
  if (equipment) requirements.equipment = equipment;
  return requirements;
}

function isCurbEntry(item: Record<string, unknown>): boolean {
  if (item.id === "curb" || item.kind === "special") return true;
  const title = typeof item.title === "string" ? item.title.trim().toLowerCase() : "";
  return title === "meio-fio" || title === "meio fio";
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
    if (fromRequirements) {
      entries.push({
        id: item.id,
        title: item.title,
        kind: typeof item.kind === "string" ? item.kind : undefined,
        requirements: fromRequirements,
        pmd: parsePmd(item.pmd),
        flows: parseFlows(item.flows),
        sizingSources: parseSizingSources(item.sizingSources),
      });
      continue;
    }
    if (item.template === "area" || item.template === "areaAndEquipment") {
      entries.push({
        id: item.id,
        title: item.title,
        requirements: requirementsFromLegacyTemplate(item.template),
      });
      continue;
    }
    return null;
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
        components[entry.id] = normalizeTaxaFields(
          pickNumbers(
            rawComponents[entry.id] as Record<string, unknown>,
            COMPONENT_PARAM_IDS,
            defaults.components[entry.id] ?? defaultComponentParams(makeContract(entry)),
          ),
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

function migrateTaxaPorRequisito(
  registry: RegistryEntry[],
  components: Record<ComponentId, ComponentParams>,
  rawComponents: unknown,
): {
  registry: RegistryEntry[];
  components: Record<ComponentId, ComponentParams>;
} {
  const nextComponents = { ...components };
  const nextRegistry = registry.map((entry) => {
    const params = { ...(nextComponents[entry.id] ?? ({} as ComponentParams)) };
    const raw =
      isRecord(rawComponents) && isRecord(rawComponents[entry.id])
        ? (rawComponents[entry.id] as Record<string, unknown>)
        : null;
    const hasNewTaxa =
      (raw && isFiniteNumber(raw.taxaDeUsoArea)) ||
      (raw && isFiniteNumber(raw.taxaDeUsoEquipamento)) ||
      entry.requirements.area?.taxaDiferente === true ||
      entry.requirements.equipment?.taxaDiferente === true;
    const legacy =
      raw && isFiniteNumber(raw.taxaDeUso)
        ? asPercent(raw.taxaDeUso)
        : undefined;
    if (hasNewTaxa || legacy == null || legacy === 100) {
      nextComponents[entry.id] = params;
      return entry;
    }
    const requirements = { ...entry.requirements };
    if (requirements.area) {
      requirements.area = { ...requirements.area, taxaDiferente: true };
      params.taxaDeUsoArea = legacy;
    }
    if (requirements.equipment) {
      requirements.equipment = {
        ...requirements.equipment,
        taxaDiferente: true,
      };
      params.taxaDeUsoEquipamento = legacy;
    }
    nextComponents[entry.id] = params;
    return { ...entry, requirements };
  });
  return { registry: nextRegistry, components: nextComponents };
}

function applyLegacySharedDhp(
  components: Record<ComponentId, ComponentParams>,
  rawShared: unknown,
): Record<ComponentId, ComponentParams> {
  if (!isRecord(rawShared) || !isFiniteNumber(rawShared.demandaPico)) {
    return components;
  }
  const dhp = rawShared.demandaPico;
  return Object.fromEntries(
    Object.entries(components).map(([id, params]) => [
      id,
      { ...params, demandaPico: dhp },
    ]),
  ) as Record<ComponentId, ComponentParams>;
}

function emptySizingStrings(): Record<SizingParamId, string> {
  return Object.fromEntries(SIZING_PARAM_IDS.map((id) => [id, ""])) as Record<
    SizingParamId,
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
      SIZING_PARAM_IDS,
      emptySizingStrings(),
    );
    const trimmed: ComponentJustificativas = {};
    for (const id of SIZING_PARAM_IDS) {
      if (picked[id].trim() !== "") trimmed[id] = picked[id];
    }
    next[entry.id] = trimmed;
  }
  return next;
}

function parseCurrent(raw: Record<string, unknown>): PersistedAirportState | null {
  const parsed = parseRegistry(raw.registry);
  if (parsed === null || typeof raw.savedAt !== "string") return null;
  const nature = parsePeakNature(raw.peakNature);
  const registry =
    raw.version === 7
      ? parsed.map((entry) => applyPmdRequirements(entry))
      : parsed.map((entry) => migrateLegacyPmd(entry, nature));
  const airport = airportById(parseAirportId(raw.airportId));
  const overlaid = overlayComponents(
    registry,
    raw.components,
    raw.componentOrigens,
    airport,
  );
  const migrated = migrateTaxaPorRequisito(
    registry,
    overlaid.components,
    raw.components,
  );

  return {
    version: STATE_VERSION,
    savedAt: raw.savedAt,
    airportId: airport.id,
    airportName: typeof raw.airportName === "string" ? raw.airportName : "",
    roundId: airport.roundId,
    registry: migrated.registry,
    components: applyLegacySharedDhp(migrated.components, raw.shared),
    componentOrigens: overlaid.componentOrigens,
    justificativas: parseJustificativas(raw.justificativas, migrated.registry),
  };
}

function parseV2(raw: Record<string, unknown>): PersistedAirportState | null {
  if (!isRecord(raw.shared) || !isRecord(raw.components) || typeof raw.savedAt !== "string") {
    return null;
  }

  const airport = defaultAirport();
  const registry = seedRegistry();
  const overlaid = overlayComponents(
    registry,
    raw.components,
    raw.componentOrigens,
    airport,
  );
  const migrated = migrateTaxaPorRequisito(
    registry,
    overlaid.components,
    raw.components,
  );

  return {
    version: STATE_VERSION,
    savedAt: raw.savedAt,
    airportId: airport.id,
    airportName: typeof raw.airportName === "string" ? raw.airportName : "",
    roundId: airport.roundId,
    registry: migrated.registry,
    components: applyLegacySharedDhp(migrated.components, raw.shared),
    componentOrigens: overlaid.componentOrigens,
    justificativas: emptyJustificativas(),
  };
}

function parseLegacyCheckin(raw: unknown): PersistedAirportState | null {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.inputs)) {
    return null;
  }
  if (typeof raw.savedAt !== "string") return null;

  const airport = defaultAirport();
  const defaults = emptyAirportDefaults(airport);
  const inputs = raw.inputs;
  const origens = isRecord(raw.origens) ? raw.origens : {};
  const registry = seedRegistry();
  const checkinParams = pickNumbers(
    inputs,
    COMPONENT_PARAM_IDS,
    defaults.components.checkin,
  );
  if (isFiniteNumber(inputs.demandaPico)) {
    checkinParams.demandaPico = inputs.demandaPico;
  }

  return {
    version: STATE_VERSION,
    savedAt: raw.savedAt,
    airportId: airport.id,
    airportName: "",
    roundId: airport.roundId,
    registry,
    components: {
      ...defaults.components,
      checkin: checkinParams,
    },
    componentOrigens: {
      ...defaults.componentOrigens,
      checkin: pickStrings(
        origens,
        COMPONENT_PARAM_IDS,
        defaults.componentOrigens.checkin,
      ),
    },
    justificativas: emptyJustificativas(),
  };
}

export function parsePersistedState(raw: unknown): PersistedAirportState | null {
  if (!isRecord(raw)) return null;
  if (
    raw.version === 7 ||
    raw.version === 6 ||
    raw.version === 5 ||
    raw.version === 4 ||
    raw.version === 3
  ) {
    return parseCurrent(raw);
  }
  if (raw.version === 2) return parseV2(raw);
  if (raw.version === 1) return parseLegacyCheckin(raw);
  return null;
}

export function createPersistedState(
  state: Omit<PersistedAirportState, "version" | "savedAt">,
): PersistedAirportState {
  return {
    version: STATE_VERSION,
    savedAt: new Date().toISOString(),
    ...state,
  };
}

export function emptyEditorState(): EditorState {
  const airport = defaultAirport();
  return {
    version: STATE_VERSION,
    savedAt: null,
    airportId: airport.id,
    airportName: "",
    roundId: airport.roundId,
    registry: [],
    components: {},
    componentOrigens: {},
    justificativas: {},
  };
}

export function exampleEditorState(
  airportName = "",
  airportId: AirportId = defaultAirport().id,
): EditorState {
  const defaults = emptyAirportDefaults(airportById(airportId));
  return {
    version: STATE_VERSION,
    savedAt: null,
    airportName,
    ...defaults,
  };
}

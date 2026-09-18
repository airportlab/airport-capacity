import type {
  ComponentParamId,
  RegistryEntry,
  RegistryFlow,
  ResolvedInputs,
  ResultId,
  SizingParamId,
} from "../types";
import { isMixedNature } from "../types";

export interface FlowParamIds {
  demanda: ComponentParamId;
  emp: SizingParamId;
  toi: SizingParamId;
  va: SizingParamId;
  area: ResultId;
}

export function flowParamIds(
  flow: RegistryFlow,
  mixedNature: boolean,
): FlowParamIds {
  const role = flow.role === "embarque" ? "Embarque" : "Desembarque";
  if (mixedNature) {
    const nature =
      flow.pmd.nature === "internacional" ? "Internacional" : "Domestico";
    return {
      demanda: `demandaPico${role}${nature}` as ComponentParamId,
      emp: `espacoMinimoPorPassageiro${role}${nature}` as SizingParamId,
      toi: `tempoDeOcupacao${role}${nature}` as SizingParamId,
      va: `va${role}${nature}` as SizingParamId,
      area: `areaMinima${role}${nature}` as ResultId,
    };
  }
  return {
    demanda: `demandaPico${role}` as ComponentParamId,
    emp: `espacoMinimoPorPassageiro${role}` as SizingParamId,
    toi: `tempoDeOcupacao${role}` as SizingParamId,
    va: `va${role}` as SizingParamId,
    area: `areaMinima${role}` as ResultId,
  };
}

export function entryFlowParams(entry: RegistryEntry): FlowParamIds[] {
  if (!entry.flows || entry.flows.length === 0) return [];
  const mixed = isMixedNature(entry);
  return entry.flows.map((flow) => flowParamIds(flow, mixed));
}

export const DUAL_IDENTITY_IDS: ComponentParamId[] = [
  "demandaPicoEmbarque",
  "demandaPicoDesembarque",
];

export const MIXED_IDENTITY_IDS: ComponentParamId[] = [
  "demandaPicoEmbarqueDomestico",
  "demandaPicoEmbarqueInternacional",
  "demandaPicoDesembarqueDomestico",
  "demandaPicoDesembarqueInternacional",
];

export const DUAL_AREA_BODY_IDS: ComponentParamId[] = [
  "areaMedida",
  "espacoMinimoPorPassageiroEmbarque",
  "tempoDeOcupacaoEmbarque",
  "vaEmbarque",
  "espacoMinimoPorPassageiroDesembarque",
  "tempoDeOcupacaoDesembarque",
  "vaDesembarque",
];

export const MIXED_AREA_BODY_IDS: ComponentParamId[] = [
  "areaMedida",
  "espacoMinimoPorPassageiroEmbarqueDomestico",
  "tempoDeOcupacaoEmbarqueDomestico",
  "vaEmbarqueDomestico",
  "espacoMinimoPorPassageiroEmbarqueInternacional",
  "tempoDeOcupacaoEmbarqueInternacional",
  "vaEmbarqueInternacional",
  "espacoMinimoPorPassageiroDesembarqueDomestico",
  "tempoDeOcupacaoDesembarqueDomestico",
  "vaDesembarqueDomestico",
  "espacoMinimoPorPassageiroDesembarqueInternacional",
  "tempoDeOcupacaoDesembarqueInternacional",
  "vaDesembarqueInternacional",
];

export function identityParamIds(entry: RegistryEntry): ComponentParamId[] {
  const flows = entryFlowParams(entry);
  if (flows.length > 0) return flows.map((flow) => flow.demanda);
  return ["demandaPico"];
}

export function areaBodyIdsFromFlows(
  flows: FlowParamIds[],
  companions: boolean,
): ComponentParamId[] {
  const ids: ComponentParamId[] = ["areaMedida"];
  for (const flow of flows) {
    ids.push(flow.emp, flow.toi);
    if (companions) ids.push(flow.va);
  }
  return ids;
}

export function mixedSpecsForParams(
  params: ReadonlyArray<{ id: string }>,
): FlowParamIds[] {
  const ids = new Set(params.map((field) => field.id));
  return MIXED_FLOW_SPECS.filter((spec) => ids.has(spec.demanda));
}

export function mixedFlowLabel(spec: FlowParamIds): string {
  const index = MIXED_FLOW_SPECS.findIndex(
    (item) => item.demanda === spec.demanda,
  );
  return index >= 0 ? MIXED_FLOW_LABELS[index] : spec.demanda;
}

export function demandSum(
  inputs: ResolvedInputs,
  demandIds: readonly ComponentParamId[],
): number {
  return demandIds.reduce((sum, id) => sum + inputs[id], 0);
}

export const MIXED_FLOW_SPECS: FlowParamIds[] = (
  [
    ["embarque", "domestico"],
    ["embarque", "internacional"],
    ["desembarque", "domestico"],
    ["desembarque", "internacional"],
  ] as const
).map(([role, nature]) =>
  flowParamIds({ role, pmd: { rowId: "", nature } }, true),
);

export const MIXED_FLOW_LABELS = [
  "embarque doméstico",
  "embarque internacional",
  "desembarque doméstico",
  "desembarque internacional",
] as const;

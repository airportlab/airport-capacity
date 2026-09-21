import type {
  ComponentParamId,
  EquipmentTerm,
  OrganFunctionRole,
  RegistryEntry,
  RegistryFlow,
  ResolvedInputs,
  ResultId,
  SizingParamId,
} from "../types";
import { hasBoardingConnection, isMixedNature } from "../types";

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
  if (flow.role === "unico") {
    const nature =
      flow.pmd.nature === "internacional" ? "Internacional" : "Domestico";
    return {
      demanda: `demandaPico${nature}` as ComponentParamId,
      emp: `espacoMinimoPorPassageiro${nature}` as SizingParamId,
      toi: `tempoDeOcupacao${nature}` as SizingParamId,
      va: `va${nature}` as SizingParamId,
      area: `areaMinima${nature}` as ResultId,
    };
  }
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
  const ids: ComponentParamId[] =
    flows.length > 0 ? flows.map((flow) => flow.demanda) : ["demandaPico"];
  if (hasBoardingConnection(entry)) ids.push("demandaPicoConexao");
  return ids;
}

export function connectionAreaParams(
  entry: RegistryEntry,
): FlowParamIds | null {
  if (!hasBoardingConnection(entry)) return null;
  const flows = entryFlowParams(entry);
  if (isMixedNature(entry)) {
    const boarding = flows.find(
      (flow) => flow.demanda === "demandaPicoEmbarqueDomestico",
    );
    if (!boarding) return null;
    return {
      demanda: "demandaPicoConexao",
      emp: boarding.emp,
      toi: boarding.toi,
      va: boarding.va,
      area: "areaMinimaConexao",
    };
  }
  if (flows.length > 0) {
    const boarding =
      flows.find((flow) => flow.area === "areaMinimaEmbarque") ?? flows[0];
    return {
      demanda: "demandaPicoConexao",
      emp: boarding.emp,
      toi: boarding.toi,
      va: boarding.va,
      area: "areaMinimaConexao",
    };
  }
  return {
    demanda: "demandaPicoConexao",
    emp: "espacoMinimoPorPassageiro",
    toi: "tempoDeOcupacao",
    va: "va",
    area: "areaMinimaConexao",
  };
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

const TOI_TO_TSEC: Partial<Record<ComponentParamId, ComponentParamId>> = {
  tempoDeOcupacaoEmbarque: "tsecEmbarque",
  tempoDeOcupacaoDesembarque: "tsecDesembarque",
  tempoDeOcupacaoEmbarqueDomestico: "tsecEmbarqueDomestico",
  tempoDeOcupacaoEmbarqueInternacional: "tsecEmbarqueInternacional",
  tempoDeOcupacaoDesembarqueDomestico: "tsecDesembarqueDomestico",
  tempoDeOcupacaoDesembarqueInternacional: "tsecDesembarqueInternacional",
  tempoDeOcupacaoDomestico: "tsecDomestico",
  tempoDeOcupacaoInternacional: "tsecInternacional",
};

/** Um fluxo só usa `tsec`. Vários fluxos usam o sufixo do Toi. */
export function tsecIdForToi(
  toi: ComponentParamId,
  multi: boolean,
): ComponentParamId {
  if (!multi) return "tsec";
  return TOI_TO_TSEC[toi] ?? "tsec";
}

function singleFlowRole(entry: RegistryEntry): OrganFunctionRole {
  switch (entry.kind) {
    case "saguao-embarque":
    case "sala-embarque-pontes":
    case "sala-embarque-remotas":
      return "embarque";
    case "saguao-desembarque":
    case "sala-desembarque":
      return "desembarque";
    default:
      return "unico";
  }
}

export interface TsecTarget {
  id: ComponentParamId;
  role: OrganFunctionRole;
  nature: "domestico" | "internacional";
}

/** Um tsec por fluxo. Componente de um fluxo só permanece em `tsec`. */
export function tsecTargets(entry: RegistryEntry): TsecTarget[] {
  const specs = entryFlowParams(entry);
  if (specs.length === 0) {
    const nature = entry.pmd?.nature;
    if (!nature) return [];
    return [{ id: "tsec", role: singleFlowRole(entry), nature }];
  }
  const multi = specs.length > 1;
  const flows = entry.flows ?? [];
  return specs.map((spec, index) => ({
    id: tsecIdForToi(spec.toi, multi),
    role: flows[index]?.role ?? "unico",
    nature: flows[index]?.pmd.nature ?? "domestico",
  }));
}

/** Um termo por fluxo de área. Conexão soma na demanda do embarque, com o Toi e o tsec desse fluxo. */
export function equipmentTerms(entry: RegistryEntry): EquipmentTerm[] {
  const flows = entryFlowParams(entry);
  const connection = connectionAreaParams(entry);
  const multi = flows.length > 1;
  if (flows.length === 0) {
    const demandIds: ComponentParamId[] = ["demandaPico"];
    if (connection) demandIds.push(connection.demanda);
    return [{ demandIds, toi: "tempoDeOcupacao", tsec: "tsec" }];
  }
  return flows.map((flow) => {
    const demandIds: ComponentParamId[] = [flow.demanda];
    if (connection && connection.toi === flow.toi) {
      demandIds.push(connection.demanda);
    }
    return { demandIds, toi: flow.toi, tsec: tsecIdForToi(flow.toi, multi) };
  });
}

export function demandSum(
  inputs: ResolvedInputs,
  demandIds: readonly ComponentParamId[],
): number {
  return demandIds.reduce((sum, id) => sum + inputs[id], 0);
}

const HALL_FLOW_SPECS: FlowParamIds[] = (
  [
    ["embarque", "domestico"],
    ["embarque", "internacional"],
    ["desembarque", "domestico"],
    ["desembarque", "internacional"],
  ] as const
).map(([role, nature]) =>
  flowParamIds({ role, pmd: { rowId: "", nature } }, true),
);

const NATURE_FLOW_SPECS: FlowParamIds[] = (
  ["domestico", "internacional"] as const
).map((nature) =>
  flowParamIds({ role: "unico", pmd: { rowId: "", nature } }, true),
);

export const MIXED_FLOW_SPECS: FlowParamIds[] = [
  ...HALL_FLOW_SPECS,
  ...NATURE_FLOW_SPECS,
];

export const MIXED_FLOW_LABELS = [
  "embarque doméstico",
  "embarque internacional",
  "desembarque doméstico",
  "desembarque internacional",
  "doméstico",
  "internacional",
] as const;

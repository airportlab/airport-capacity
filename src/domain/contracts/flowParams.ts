import type {
  ArrivalsConnectionPair,
  BoardingConnectionPair,
  ComponentParamId,
  EquipmentTerm,
  OrganFunctionRole,
  PeakNature,
  RegistryEntry,
  RegistryFlow,
  ResolvedInputs,
  ResultId,
  SizingParamId,
  SizingSources,
} from "../types";
import {
  ARRIVALS_CONNECTION_CATALOG,
  arrivalsConnectionColumn,
  boardingConnectionSpec,
  enabledArrivalsConnections,
  enabledBoardingConnections,
  hasArrivalsConnection,
  hasBoardingConnection,
  isMixedNature,
  natureOfEntry,
} from "../types";

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

export function isArrivalsOnlyMixed(flows: readonly FlowParamIds[]): boolean {
  return (
    flows.length > 0 &&
    flows.every(
      (flow) =>
        flow.area === "areaMinimaDesembarqueDomestico" ||
        flow.area === "areaMinimaDesembarqueInternacional",
    )
  );
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
  if (hasBoardingConnection(entry)) {
    for (const pair of enabledBoardingConnections(entry)) {
      ids.push(boardingConnectionSpec(pair).demanda);
    }
  }
  if (hasArrivalsConnection(entry)) {
    for (const flow of connectionFlows(entry)) ids.push(flow.demanda);
  }
  return ids;
}

function boardingSizing(
  entry: RegistryEntry,
): Pick<FlowParamIds, "emp" | "toi" | "va"> | null {
  if (!hasBoardingConnection(entry)) return null;
  const flows = entryFlowParams(entry);
  if (isMixedNature(entry)) {
    const boarding = flows.find(
      (flow) => flow.demanda === "demandaPicoEmbarqueDomestico",
    );
    if (!boarding) return null;
    return { emp: boarding.emp, toi: boarding.toi, va: boarding.va };
  }
  if (flows.length > 0) {
    const boarding =
      flows.find((flow) => flow.area === "areaMinimaEmbarque") ?? flows[0];
    return { emp: boarding.emp, toi: boarding.toi, va: boarding.va };
  }
  return {
    emp: "espacoMinimoPorPassageiro",
    toi: "tempoDeOcupacao",
    va: "va",
  };
}

function salaHallNature(entry: RegistryEntry): PeakNature {
  return natureOfEntry(entry) === "internacional"
    ? "internacional"
    : "domestico";
}

function salaColumnOf(pair: ArrivalsConnectionPair): PeakNature {
  return arrivalsConnectionColumn(pair);
}

function salaConnectionFlows(entry: RegistryEntry): FlowParamIds[] {
  const hall = salaHallNature(entry);
  const enabled = new Set(enabledArrivalsConnections(entry));
  return ARRIVALS_CONNECTION_CATALOG.flatMap((spec) => {
    if (!enabled.has(spec.pair)) return [];
    const own = salaColumnOf(spec.pair) === hall;
    return [
      {
        demanda: spec.demanda,
        emp: (own
          ? "espacoMinimoPorPassageiro"
          : spec.emp) as SizingParamId,
        toi: (own ? "tempoDeOcupacao" : spec.toi) as SizingParamId,
        va: "va",
        area: spec.area,
      },
    ];
  });
}

function hallArrivalsConnectionFlows(entry: RegistryEntry): FlowParamIds[] {
  const enabled = new Set(enabledArrivalsConnections(entry));
  const fromFlows = entryFlowParams(entry).find(
    (flow) => flow.area === "areaMinimaDesembarque",
  );
  const own: FlowParamIds = fromFlows ?? {
    demanda: "demandaPico",
    emp: "espacoMinimoPorPassageiro",
    toi: "tempoDeOcupacao",
    va: "vaDesembarque",
    area: "areaMinima",
  };
  return ARRIVALS_CONNECTION_CATALOG.flatMap((spec) => {
    if (!enabled.has(spec.pair)) return [];
    return [
      {
        demanda: spec.demanda,
        emp: own.emp,
        toi: own.toi,
        va: own.va,
        area: spec.area,
      },
    ];
  });
}

/** O saguão simples reusa Emp e Toi do próprio saguão. */
export function hallArrivalsConnectionSources(
  entry: RegistryEntry,
): SizingSources {
  if (entry.kind !== "saguao-desembarque" || isMixedNature(entry)) return {};
  return {};
}

/** Emp e Toi da coluna que não é a da sala, lidos do PMD dessa coluna. */
export function salaConnectionSources(entry: RegistryEntry): SizingSources {
  if (entry.kind !== "sala-desembarque" || !entry.pmd?.rowId) return {};
  const sources: SizingSources = {};
  for (const flow of salaConnectionFlows(entry)) {
    if (flow.emp === "espacoMinimoPorPassageiro") continue;
    const nature: PeakNature = String(flow.emp).includes("Internacional")
      ? "internacional"
      : "domestico";
    const binding = { rowId: entry.pmd.rowId, nature };
    sources[flow.emp] = binding;
    sources[flow.toi] = binding;
  }
  return sources;
}

function boardingColumnSizing(
  entry: RegistryEntry,
  pair: BoardingConnectionPair,
  shared: Pick<FlowParamIds, "emp" | "toi" | "va">,
): Pick<FlowParamIds, "emp" | "toi" | "va"> | null {
  if (entry.kind !== "saguao-embarque" || !isMixedNature(entry)) return shared;
  if (pair !== "domInt" && pair !== "intInt") return shared;
  const boarding = entryFlowParams(entry).find(
    (flow) => flow.demanda === "demandaPicoEmbarqueInternacional",
  );
  if (!boarding) return null;
  return { emp: boarding.emp, toi: boarding.toi, va: boarding.va };
}

export function connectionFlows(entry: RegistryEntry): FlowParamIds[] {
  const sizing = boardingSizing(entry);
  if (sizing) {
    return enabledBoardingConnections(entry).flatMap((pair) => {
      const column = boardingColumnSizing(entry, pair, sizing);
      if (!column) return [];
      const spec = boardingConnectionSpec(pair);
      return [
        {
          demanda: spec.demanda,
          emp: column.emp,
          toi: column.toi,
          va: column.va,
          area: spec.area,
        },
      ];
    });
  }
  if (!hasArrivalsConnection(entry)) return [];
  if (entry.kind === "sala-desembarque") return salaConnectionFlows(entry);
  if (entry.kind === "saguao-desembarque" && !isMixedNature(entry)) {
    return hallArrivalsConnectionFlows(entry);
  }
  const enabled = new Set(enabledArrivalsConnections(entry));
  const flows = entryFlowParams(entry);
  const domestico = flows.find(
    (flow) => flow.demanda === "demandaPicoDesembarqueDomestico",
  );
  const internacional = flows.find(
    (flow) => flow.demanda === "demandaPicoDesembarqueInternacional",
  );
  return ARRIVALS_CONNECTION_CATALOG.flatMap((spec) => {
    if (!enabled.has(spec.pair)) return [];
    const sizing =
      arrivalsConnectionColumn(spec.pair) === "domestico"
        ? domestico
        : internacional;
    if (!sizing) return [];
    return [
      {
        demanda: spec.demanda,
        emp: sizing.emp,
        toi: sizing.toi,
        va: sizing.va,
        area: spec.area,
      },
    ];
  });
}

export function connectionAreaParams(
  entry: RegistryEntry,
): FlowParamIds | null {
  return connectionFlows(entry)[0] ?? null;
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
    case "sala-embarque-pontes-sentado":
    case "sala-embarque-remotas-sentado":
    case "salas-embarque":
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

/** Check-in misto: um termo doméstico e um internacional. */
export function isSplitCheckinEquipment(terms: readonly EquipmentTerm[]): boolean {
  const ids = new Set(terms.map((term) => term.tsec));
  return ids.has("tsecDomestico") && ids.has("tsecInternacional");
}

export function splitEquipmentTaxaId(
  tsec: ComponentParamId,
): ComponentParamId | null {
  if (tsec === "tsecDomestico") return "taxaDeUsoEquipamentoDomestico";
  if (tsec === "tsecInternacional") return "taxaDeUsoEquipamentoInternacional";
  return null;
}

export function splitEquipmentResultId(tsec: ComponentParamId): ResultId | null {
  if (tsec === "tsecDomestico") return "numeroMinimoEquipamentosDomestico";
  if (tsec === "tsecInternacional") return "numeroMinimoEquipamentosInternacional";
  return null;
}

/** Um termo por fluxo de área. Cada conexão soma na demanda do fluxo com o mesmo Toi. */
export function equipmentTerms(entry: RegistryEntry): EquipmentTerm[] {
  const flows = entryFlowParams(entry);
  const connections = connectionFlows(entry);
  const multi = flows.length > 1;
  if (flows.length === 0) {
    const demandIds: ComponentParamId[] = ["demandaPico"];
    for (const connection of connections) demandIds.push(connection.demanda);
    return [{ demandIds, toi: "tempoDeOcupacao", tsec: "tsec" }];
  }
  return flows.map((flow) => {
    const demandIds: ComponentParamId[] = [flow.demanda];
    for (const connection of connections) {
      if (connection.toi === flow.toi) demandIds.push(connection.demanda);
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

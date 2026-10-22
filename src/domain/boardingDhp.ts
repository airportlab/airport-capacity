import { areaCoefficient } from "./contracts/formulas";
import { connectionFlows, entryFlowParams } from "./contracts/flowParams";
import type {
  ComponentParamId,
  RegistryEntry,
  ResolvedInputs,
} from "./types";
import {
  ARRIVALS_CONNECTION_CATALOG,
  BOARDING_CONNECTION_CATALOG,
  hasArrivalsConnection,
  hasBoardingConnection,
  isMixedNature,
  natureOfEntry,
  usesAreaTaxa,
  type ArrivalsConnectionPair,
} from "./types";

/** Fluxo da hora. Embarque usa origem; desembarque usa destino. O outro lado fica em 0. */
export type BoardingFlowKey =
  | "origemDom"
  | "origemInt"
  | "destinoDom"
  | "destinoInt"
  | "conexaoDomDom"
  | "conexaoIntDom"
  | "conexaoDomInt"
  | "conexaoIntInt"
  | "chegadaDomDom"
  | "chegadaDomInt"
  | "chegadaIntDom"
  | "chegadaIntInt";

export const BOARDING_FLOW_KEYS: readonly BoardingFlowKey[] = [
  "origemDom",
  "origemInt",
  "destinoDom",
  "destinoInt",
  "conexaoDomDom",
  "conexaoIntDom",
  "conexaoDomInt",
  "conexaoIntInt",
  "chegadaDomDom",
  "chegadaDomInt",
  "chegadaIntDom",
  "chegadaIntInt",
];

export interface BoardingFlowWeight {
  demanda: ComponentParamId;
  label: string;
  peso: number;
  key: BoardingFlowKey;
}

export type BoardingPonderation = Record<BoardingFlowKey, number>;

export type BoardingHourCounts = Record<BoardingFlowKey, number>;

interface WeightSpec {
  demanda: ComponentParamId;
  label: string;
  key: BoardingFlowKey;
  emp: ComponentParamId;
  toi: ComponentParamId;
  va?: ComponentParamId;
}

const CONNECTION_FLOW_KEY: Record<
  (typeof BOARDING_CONNECTION_CATALOG)[number]["pair"],
  BoardingFlowKey
> = {
  domDom: "conexaoDomDom",
  intDom: "conexaoIntDom",
  domInt: "conexaoDomInt",
  intInt: "conexaoIntInt",
};

const ARRIVAL_FLOW_KEY: Record<ArrivalsConnectionPair, BoardingFlowKey> = {
  domDom: "chegadaDomDom",
  domInt: "chegadaDomInt",
  intDom: "chegadaIntDom",
  intInt: "chegadaIntInt",
};

function arrivalWeightSpecs(entry: RegistryEntry): WeightSpec[] | null {
  if (entry.kind !== "saguao-desembarque" || !entry.requirements.area) return null;
  const nature = natureOfEntry(entry);
  if (!nature) return null;
  const companions = entry.requirements.area.companions === true;
  const specs: WeightSpec[] = [];
  if (isMixedNature(entry)) {
    for (const flow of entryFlowParams(entry)) {
      if (flow.demanda === "demandaPicoDesembarqueDomestico") {
        specs.push({
          demanda: flow.demanda,
          label: "destino DOM",
          key: "destinoDom",
          emp: flow.emp,
          toi: flow.toi,
          va: companions ? flow.va : undefined,
        });
      }
      if (flow.demanda === "demandaPicoDesembarqueInternacional") {
        specs.push({
          demanda: flow.demanda,
          label: "destino INT",
          key: "destinoInt",
          emp: flow.emp,
          toi: flow.toi,
          va: companions ? flow.va : undefined,
        });
      }
    }
  } else {
    const international = nature === "internacional";
    const arrivals = entryFlowParams(entry).find(
      (flow) => flow.area === "areaMinimaDesembarque",
    );
    specs.push({
      demanda: arrivals?.demanda ?? "demandaPico",
      label: international ? "destino INT" : "destino DOM",
      key: international ? "destinoInt" : "destinoDom",
      emp: arrivals?.emp ?? "espacoMinimoPorPassageiro",
      toi: arrivals?.toi ?? "tempoDeOcupacao",
      va: companions ? (arrivals?.va ?? "va") : undefined,
    });
  }
  if (hasArrivalsConnection(entry)) {
    for (const item of connectionFlows(entry)) {
      const spec = ARRIVALS_CONNECTION_CATALOG.find(
        (pair) => pair.demanda === item.demanda,
      );
      if (!spec) continue;
      specs.push({
        demanda: item.demanda,
        label: `conexão ${spec.label}`,
        key: ARRIVAL_FLOW_KEY[spec.pair],
        emp: item.emp,
        toi: item.toi,
      });
    }
  }
  return specs.length > 0 ? specs : null;
}

function weightSpecs(entry: RegistryEntry): WeightSpec[] | null {
  if (entry.kind === "saguao-desembarque") return arrivalWeightSpecs(entry);
  if (entry.kind !== "saguao-embarque" || !entry.requirements.area) return null;
  const nature = natureOfEntry(entry);
  if (!nature) return null;
  const companions = entry.requirements.area.companions === true;
  const specs: WeightSpec[] = [];
  if (isMixedNature(entry)) {
    for (const flow of entryFlowParams(entry)) {
      if (flow.demanda === "demandaPicoEmbarqueDomestico") {
        specs.push({
          demanda: flow.demanda,
          label: "origem DOM",
          key: "origemDom",
          emp: flow.emp,
          toi: flow.toi,
          va: companions ? flow.va : undefined,
        });
      }
      if (flow.demanda === "demandaPicoEmbarqueInternacional") {
        specs.push({
          demanda: flow.demanda,
          label: "origem INT",
          key: "origemInt",
          emp: flow.emp,
          toi: flow.toi,
          va: companions ? flow.va : undefined,
        });
      }
    }
  } else {
    const international = nature === "internacional";
    const boarding = entryFlowParams(entry).find(
      (flow) => flow.area === "areaMinimaEmbarque",
    );
    specs.push({
      demanda: boarding?.demanda ?? "demandaPico",
      label: international ? "origem INT" : "origem DOM",
      key: international ? "origemInt" : "origemDom",
      emp: boarding?.emp ?? "espacoMinimoPorPassageiro",
      toi: boarding?.toi ?? "tempoDeOcupacao",
      va: companions ? (boarding?.va ?? "va") : undefined,
    });
  }
  if (hasBoardingConnection(entry)) {
    for (const item of connectionFlows(entry)) {
      const spec = BOARDING_CONNECTION_CATALOG.find(
        (pair) => pair.demanda === item.demanda,
      );
      if (!spec) continue;
      specs.push({
        demanda: item.demanda,
        label: `conexão ${spec.label}`,
        key: CONNECTION_FLOW_KEY[spec.pair],
        emp: item.emp,
        toi: item.toi,
      });
    }
  }
  return specs.length > 0 ? specs : null;
}

/** Campos da área que entram no peso. Sem requisito de área, não há peso. */
export function boardingWeightInputIds(
  entry: RegistryEntry,
): ComponentParamId[] | null {
  const specs = weightSpecs(entry);
  if (!specs) return null;
  const ids = new Set<ComponentParamId>();
  if (usesAreaTaxa(entry.requirements)) ids.add("taxaDeUsoArea");
  for (const spec of specs) {
    ids.add(spec.emp);
    ids.add(spec.toi);
    if (spec.va) ids.add(spec.va);
  }
  return [...ids];
}

/** Peso de cada fluxo ligado do saguão: coeficiente da área, sem o DHp. */
export function boardingFlowWeights(
  entry: RegistryEntry,
  inputs: ResolvedInputs,
): BoardingFlowWeight[] | null {
  const specs = weightSpecs(entry);
  if (!specs) return null;
  const taxaId = usesAreaTaxa(entry.requirements) ? "taxaDeUsoArea" : null;
  return specs.map((spec) => ({
    demanda: spec.demanda,
    label: spec.label,
    key: spec.key,
    peso: areaCoefficient(inputs, spec.emp, spec.toi, spec.va, taxaId),
  }));
}

/** Pesos enviados na consulta. Fluxo ausente fica em 0 e não desloca a hora. */
export function boardingPonderation(
  flows: readonly BoardingFlowWeight[],
): BoardingPonderation {
  const pesos = Object.fromEntries(
    BOARDING_FLOW_KEYS.map((key) => [key, 0]),
  ) as BoardingPonderation;
  for (const flow of flows) pesos[flow.key] = flow.peso;
  return pesos;
}

/** Contagem da 30ª hora. INT/DOM e INT/INT do desembarque somam no mesmo DHp. */
export function boardingDemandsFromHour(
  flows: readonly BoardingFlowWeight[],
  hour: BoardingHourCounts,
): Partial<Record<ComponentParamId, number>> {
  const values: Partial<Record<ComponentParamId, number>> = {};
  for (const flow of flows) {
    values[flow.demanda] = (values[flow.demanda] ?? 0) + hour[flow.key];
  }
  return values;
}

import { areaCoefficient } from "./contracts/formulas";
import {
  connectionAreaParams,
  entryFlowParams,
} from "./contracts/flowParams";
import type {
  ComponentParamId,
  RegistryEntry,
  ResolvedInputs,
} from "./types";
import {
  hasBoardingConnection,
  isMixedNature,
  natureOfEntry,
  usesAreaTaxa,
} from "./types";

/** Fluxo da hora. Destino existe na consulta; o saguão de embarque não o usa. */
export type BoardingFlowKey =
  | "origemDom"
  | "origemInt"
  | "destinoDom"
  | "destinoInt"
  | "conexaoDomDom"
  | "conexaoIntDom"
  | "conexaoDomInt"
  | "conexaoIntInt";

export const BOARDING_FLOW_KEYS: readonly BoardingFlowKey[] = [
  "origemDom",
  "origemInt",
  "destinoDom",
  "destinoInt",
  "conexaoDomDom",
  "conexaoIntDom",
  "conexaoDomInt",
  "conexaoIntInt",
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

const CONNECTION_PAIRS: ReadonlyArray<{
  key: BoardingFlowKey;
  label: string;
  /** Natureza do voo que embarca. Doméstico leva os pares que terminam em DOM. */
  leg: "dom" | "int";
}> = [
  { key: "conexaoDomDom", label: "conexão DOM-DOM", leg: "dom" },
  { key: "conexaoIntDom", label: "conexão INT-DOM", leg: "dom" },
  { key: "conexaoDomInt", label: "conexão DOM-INT", leg: "int" },
  { key: "conexaoIntInt", label: "conexão INT-INT", leg: "int" },
];

function weightSpecs(entry: RegistryEntry): WeightSpec[] | null {
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
    specs.push({
      demanda: "demandaPico",
      label: international ? "origem INT" : "origem DOM",
      key: international ? "origemInt" : "origemDom",
      emp: "espacoMinimoPorPassageiro",
      toi: "tempoDeOcupacao",
      va: companions ? "va" : undefined,
    });
  }
  if (hasBoardingConnection(entry)) {
    const connection = connectionAreaParams(entry);
    if (!connection) return null;
    const leg =
      nature === "internacional" ? "int" : nature === "domestico" ? "dom" : null;
    for (const pair of CONNECTION_PAIRS) {
      if (leg && pair.leg !== leg) continue;
      specs.push({
        demanda: connection.demanda,
        label: pair.label,
        key: pair.key,
        emp: connection.emp,
        toi: connection.toi,
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

/** Peso de cada fluxo do saguão de embarque: coeficiente da área, sem o DHp. */
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

/** Contagem da 30ª hora. Os pares de conexão da situação somam num DHp só. */
export function boardingDemandsFromHour(
  flows: readonly BoardingFlowWeight[],
  hour: BoardingHourCounts,
): Partial<Record<ComponentParamId, number>> {
  const values: Partial<Record<ComponentParamId, number>> = {};
  for (const flow of flows) {
    const count = hour[flow.key];
    if (flow.key === "origemDom" || flow.key === "origemInt") {
      values[flow.demanda] = count;
    } else {
      values[flow.demanda] = (values[flow.demanda] ?? 0) + count;
    }
  }
  return values;
}

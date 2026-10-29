import { areaCoefficient, splitLoungeCoefficient } from "./contracts/formulas";
import { connectionFlows, entryFlowParams } from "./contracts/flowParams";
import { isSplitLoungeEntry } from "./pmd";
import type {
  ComponentParamId,
  RegistryEntry,
  ResolvedInputs,
} from "./types";
import {
  ARRIVALS_CONNECTION_CATALOG,
  BOARDING_CONNECTION_CATALOG,
  natureOfEntry,
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
  /** Sala sentado e em pé: o peso é o coeficiente do passageiro normal. */
  sentado?: boolean;
}

const SPLIT_LOUNGE_WEIGHT_IDS: readonly ComponentParamId[] = [
  "percentualMinimoAssentos",
  "percentualOcupacaoMaxima",
  "espacoMinimoPorPassageiro",
  "tempoDeOcupacao",
  "espacoMinimoEmPe",
  "tempoDeOcupacaoEmPe",
];

const CONNECTION_FLOW_KEY: Record<
  (typeof BOARDING_CONNECTION_CATALOG)[number]["pair"],
  BoardingFlowKey
> = {
  domDom: "conexaoDomDom",
  intDom: "conexaoIntDom",
  domInt: "conexaoDomInt",
  intInt: "conexaoIntInt",
};

/** A primeira letra é o voo. DOM-INT lê chegada_dom_int; INT-DOM lê chegada_int_dom. */
const ARRIVAL_FLOW_KEY: Record<ArrivalsConnectionPair, BoardingFlowKey> = {
  domDom: "chegadaDomDom",
  domInt: "chegadaDomInt",
  intDom: "chegadaIntDom",
  intInt: "chegadaIntInt",
};

function arrivalComponent(entry: RegistryEntry): boolean {
  return (
    entry.kind === "saguao-desembarque" ||
    entry.kind === "sala-desembarque" ||
    entry.kind === "imigracao" ||
    entry.kind === "aduana"
  );
}

function flowKey(
  nature: "domestico" | "internacional",
  leg: "embarque" | "desembarque",
): BoardingFlowKey {
  if (leg === "embarque") {
    return nature === "internacional" ? "origemInt" : "origemDom";
  }
  return nature === "internacional" ? "destinoInt" : "destinoDom";
}

function flowLabel(key: BoardingFlowKey): string {
  switch (key) {
    case "origemDom":
      return "origem DOM";
    case "origemInt":
      return "origem INT";
    case "destinoDom":
      return "destino DOM";
    case "destinoInt":
      return "destino INT";
    default:
      return key;
  }
}

function packFlow(
  nature: "domestico" | "internacional",
  leg: "embarque" | "desembarque",
): { key: BoardingFlowKey; label: string } {
  const key = flowKey(nature, leg);
  return { key, label: flowLabel(key) };
}

function demandFlow(
  entry: RegistryEntry,
  demanda: ComponentParamId,
): { key: BoardingFlowKey; label: string } | null {
  const boarding = BOARDING_CONNECTION_CATALOG.find(
    (pair) => pair.demanda === demanda,
  );
  if (boarding) {
    return {
      key: CONNECTION_FLOW_KEY[boarding.pair],
      label: `conexão ${boarding.label}`,
    };
  }
  const arrival = ARRIVALS_CONNECTION_CATALOG.find(
    (pair) => pair.demanda === demanda,
  );
  if (arrival) {
    return {
      key: ARRIVAL_FLOW_KEY[arrival.pair],
      label: `conexão ${arrival.label}`,
    };
  }
  const leg = arrivalComponent(entry) ? "desembarque" : "embarque";
  const nature = natureOfEntry(entry);
  if (demanda === "demandaPicoEmbarqueDomestico") return packFlow("domestico", "embarque");
  if (demanda === "demandaPicoEmbarqueInternacional") {
    return packFlow("internacional", "embarque");
  }
  if (demanda === "demandaPicoDesembarqueDomestico") {
    return packFlow("domestico", "desembarque");
  }
  if (demanda === "demandaPicoDesembarqueInternacional") {
    return packFlow("internacional", "desembarque");
  }
  if (demanda === "demandaPicoDomestico") return packFlow("domestico", leg);
  if (demanda === "demandaPicoInternacional") return packFlow("internacional", leg);
  if (demanda === "demandaPicoEmbarque") {
    if (nature !== "domestico" && nature !== "internacional") return null;
    return packFlow(nature, "embarque");
  }
  if (demanda === "demandaPicoDesembarque") {
    if (nature !== "domestico" && nature !== "internacional") return null;
    return packFlow(nature, "desembarque");
  }
  if (demanda === "demandaPico") {
    if (nature !== "domestico" && nature !== "internacional") return null;
    return packFlow(nature, leg);
  }
  return null;
}

function weightSpecs(entry: RegistryEntry): WeightSpec[] | null {
  if (!entry.requirements.area) return null;
  if (!entry.kind || entry.kind === "generic" || entry.kind === "special") {
    return null;
  }
  const sentado = isSplitLoungeEntry(entry);
  const companions = entry.requirements.area.companions === true && !sentado;
  const specs: WeightSpec[] = [];
  const flows = entryFlowParams(entry);
  if (flows.length === 0) {
    const mapped = demandFlow(entry, "demandaPico");
    if (!mapped) return null;
    specs.push({
      demanda: "demandaPico",
      ...mapped,
      emp: "espacoMinimoPorPassageiro",
      toi: "tempoDeOcupacao",
      va: companions ? "va" : undefined,
      sentado,
    });
  } else {
    for (const flow of flows) {
      const mapped = demandFlow(entry, flow.demanda);
      if (!mapped) continue;
      specs.push({
        demanda: flow.demanda,
        ...mapped,
        emp: flow.emp,
        toi: flow.toi,
        va: companions ? flow.va : undefined,
        sentado,
      });
    }
  }
  for (const item of connectionFlows(entry)) {
    const mapped = demandFlow(entry, item.demanda);
    if (!mapped) continue;
    specs.push({
      demanda: item.demanda,
      ...mapped,
      emp: item.emp,
      toi: item.toi,
      sentado,
    });
  }
  return specs.length > 0 ? specs : null;
}

/** Campos da área que entram no peso. Sem requisito de área, não há peso. */
export function boardingWeightInputIds(
  entry: RegistryEntry,
): ComponentParamId[] | null {
  const specs = weightSpecs(entry);
  if (!specs) return null;
  if (specs.some((spec) => spec.sentado)) return [...SPLIT_LOUNGE_WEIGHT_IDS];
  const ids = new Set<ComponentParamId>();
  for (const spec of specs) {
    ids.add(spec.emp);
    ids.add(spec.toi);
    if (spec.va) ids.add(spec.va);
  }
  return [...ids];
}

/** Peso de cada fluxo ligado: coeficiente da área, sem o DHp. */
export function boardingFlowWeights(
  entry: RegistryEntry,
  inputs: ResolvedInputs,
): BoardingFlowWeight[] | null {
  const specs = weightSpecs(entry);
  if (!specs) return null;
  const sentado = specs.some((spec) => spec.sentado)
    ? splitLoungeCoefficient(inputs)
    : null;
  return specs.map((spec) => ({
    demanda: spec.demanda,
    label: spec.label,
    key: spec.key,
    peso:
      sentado != null
        ? sentado
        : areaCoefficient(inputs, spec.emp, spec.toi, spec.va),
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

/** Contagem da 30ª hora. Cada par grava a sua. */
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

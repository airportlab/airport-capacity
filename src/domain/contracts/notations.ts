import type {
  ArrivalsConnectionPair,
  BoardingConnectionPair,
  ComponentParamId,
  EquipmentTerm,
} from "../types";
import { arrivalsConnectionSpec, boardingConnectionSpec } from "../types";

export const AREA_NOTATIONS = [
  { symbol: "Ad", meaning: "Área mínima necessária", unit: "m²" },
  { symbol: "DHp", meaning: "Demanda hora pico do componente", unit: "pax/h" },
  {
    symbol: "DHp_c",
    meaning: "Demanda hora pico de embarque via conexão",
    unit: "pax/h",
  },
  { symbol: "Tu", meaning: "Taxa de utilização", unit: "%" },
  { symbol: "Emp", meaning: "Espaço mínimo por passageiro / ocupante", unit: "m²/pax" },
  { symbol: "Toi", meaning: "Tempo de ocupação", unit: "min" },
  { symbol: "v.a", meaning: "Acompanhantes", unit: "adimensional" },
] as const;

function withTu(head: string, includeTaxa: boolean, tu = "Tu"): string {
  return includeTaxa ? `${head} × ${tu}` : head;
}

export function areaNumerator(
  companions: boolean,
  includeTaxa = false,
  suffix = "",
  tu = "Tu",
): string {
  const demand = withTu(`DHp${suffix}`, includeTaxa, tu);
  const body = `${demand} × Emp${suffix} × Toi${suffix}`;
  return companions ? `${body} × (1 + v.a${suffix})` : body;
}

export function areaFormulaRhs(
  companions: boolean,
  includeTaxa = false,
): string {
  return `(${areaNumerator(companions, includeTaxa)}) / 60`;
}

export function splitLoungeFormulaDisplay(includeTaxa = false): string {
  const demand = includeTaxa ? "DHp × Tu" : "DHp";
  return `Ad = ${demand} × [(Pa%) × Emp_s × (Toi_s/60) + (1 − Pa%) × Emp_p × (Toi_p/60)] / (Ocup_max%)`;
}

export function areaFormulaDisplay(
  companions: boolean,
  includeTaxa = false,
): string {
  return `Ad = ${areaFormulaRhs(companions, includeTaxa)}`;
}

export function dualBoardingAreaRhs(
  companions: boolean,
  includeTaxa = false,
): string {
  return `(${areaNumerator(companions, includeTaxa, "_e")}) / 60`;
}

export function dualArrivalsAreaRhs(
  companions: boolean,
  includeTaxa = false,
): string {
  return `(${areaNumerator(companions, includeTaxa, "_d")}) / 60`;
}

export function boardingConnectionAreaList(
  pairs: readonly BoardingConnectionPair[],
): string {
  return pairs
    .map((pair) => boardingConnectionSpec(pair).areaSymbol)
    .join(" + ");
}

export function dualAreaSumDisplay(
  hasConnection = false,
  pairs: readonly BoardingConnectionPair[] = [],
): string {
  if (pairs.length > 0) {
    return `Ad = Ad_e + Ad_d + ${boardingConnectionAreaList(pairs)}`;
  }
  return hasConnection ? "Ad = Ad_e + Ad_d + Ad_c" : "Ad = Ad_e + Ad_d";
}

export function dualAreaFormulaDisplay(
  companions: boolean,
  includeTaxa = false,
  hasConnection = false,
  pairs: readonly BoardingConnectionPair[] = [],
): string {
  const connection =
    pairs.length > 0
      ? ` ${boardingConnectionAreasClause(pairs, includeTaxa, "_e")}`
      : hasConnection
        ? ` Ad_c = ${connectionAreaRhs(includeTaxa, "_e")};`
        : "";
  return `Ad_e = ${dualBoardingAreaRhs(companions, includeTaxa)}; Ad_d = ${dualArrivalsAreaRhs(companions, includeTaxa)};${connection} ${dualAreaSumDisplay(hasConnection, pairs)}`;
}

export function singleFunctionMixedSumDisplay(): string {
  return "Ad = Ad_dom + Ad_int";
}

export function singleFunctionMixedFormulaDisplay(
  companions: boolean,
  includeTaxa = false,
): string {
  const rhs = (suffix: string, tu: string) =>
    `(${areaNumerator(companions, includeTaxa, suffix, tu)}) / 60`;
  return `Ad_dom = ${rhs("_dom", "Tu_dom")}; Ad_int = ${rhs("_int", "Tu_int")}; ${singleFunctionMixedSumDisplay()}`;
}

export function mixedAreaSumDisplay(
  flowCount = 4,
  hasConnection = false,
  arrivalsOnly = false,
  pairs: readonly BoardingConnectionPair[] = [],
  arrivalsPairs: readonly ArrivalsConnectionPair[] = [],
): string {
  if (arrivalsOnly) {
    const parts = ["Ad_d,dom", "Ad_d,int"];
    for (const pair of arrivalsPairs) {
      parts.push(arrivalsConnectionSpec(pair).areaSymbol);
    }
    return `Ad = ${parts.join(" + ")}`;
  }
  const base =
    flowCount <= 2
      ? "Ad = Ad_e,dom + Ad_e,int"
      : "Ad = Ad_e,dom + Ad_e,int + Ad_d,dom + Ad_d,int";
  if (pairs.length > 0) return `${base} + ${boardingConnectionAreaList(pairs)}`;
  return hasConnection ? `${base} + Ad_c` : base;
}

export function mixedAreaFormulaDisplay(
  companions: boolean,
  flowCount = 4,
  includeTaxa = false,
  hasConnection = false,
  arrivalsOnly = false,
  pairs: readonly BoardingConnectionPair[] = [],
  arrivalsPairs: readonly ArrivalsConnectionPair[] = [],
): string {
  const rhs = areaFormulaRhs(companions, includeTaxa);
  const connection =
    pairs.length > 0
      ? ` ${boardingConnectionAreasClause(pairs, includeTaxa, "_e,dom")}`
      : hasConnection
        ? ` Ad_c = ${connectionAreaRhs(includeTaxa, "_e,dom")};`
        : "";
  if (arrivalsOnly) {
    const arrivals = arrivalsPairs
      .map((pair) => ` ${arrivalsConnectionAreaDisplay(pair, includeTaxa)};`)
      .join("");
    return `Ad_d,dom = ${rhs}; Ad_d,int = ${rhs};${arrivals} ${mixedAreaSumDisplay(2, arrivalsPairs.length > 0, true, [], arrivalsPairs)}`;
  }
  if (flowCount <= 2) {
    return `Ad_e,dom = ${rhs}; Ad_e,int = ${rhs};${connection} ${mixedAreaSumDisplay(2, hasConnection, false, pairs)}`;
  }
  return `Ad_e,dom = ${rhs}; Ad_e,int = ${rhs}; Ad_d,dom = ${rhs}; Ad_d,int = ${rhs};${connection} ${mixedAreaSumDisplay(4, hasConnection, false, pairs)}`;
}

export function arrivalsConnectionNumerator(
  pair: ArrivalsConnectionPair,
  includeTaxa = false,
): string {
  const spec = arrivalsConnectionSpec(pair);
  const demand = withTu(spec.dhpSymbol, includeTaxa);
  return `${demand} × Emp${spec.empSuffix} × Toi${spec.empSuffix}`;
}

export function arrivalsConnectionAreaDisplay(
  pair: ArrivalsConnectionPair,
  includeTaxa = false,
): string {
  const spec = arrivalsConnectionSpec(pair);
  return `${spec.areaSymbol} = (${arrivalsConnectionNumerator(pair, includeTaxa)}) / 60`;
}

export function salaArrivalsSumDisplay(
  pairs: readonly ArrivalsConnectionPair[],
): string {
  const parts = pairs.map((pair) => arrivalsConnectionSpec(pair).areaSymbol);
  return `Ad = Ad_d + ${parts.join(" + ")}`;
}

export function salaArrivalsFormulaDisplay(
  includeTaxa: boolean,
  pairs: readonly ArrivalsConnectionPair[],
): string {
  const hall = areaFormulaDisplay(false, includeTaxa).replace(
    "Ad = ",
    "Ad_d = ",
  );
  const pieces = pairs.map((pair) =>
    arrivalsConnectionAreaDisplay(pair, includeTaxa),
  );
  return `${hall}; ${pieces.join("; ")}; ${salaArrivalsSumDisplay(pairs)}`;
}

export function beltConnectionSymbol(pair: ArrivalsConnectionPair): string {
  return arrivalsConnectionSpec(pair).areaSymbol.replace(/^Ad/, "C");
}

export function beltConnectionNumerator(
  pair: ArrivalsConnectionPair,
  includeTaxa = false,
): string {
  const spec = arrivalsConnectionSpec(pair);
  const demand = includeTaxa ? `${spec.dhpSymbol} × Tu` : spec.dhpSymbol;
  return `${demand} × Tr × Lmp × Toi${spec.empSuffix}`;
}

export function salaBeltFormulaDisplay(
  includeTaxa: boolean,
  pairs: readonly ArrivalsConnectionPair[],
): string {
  if (pairs.length === 0) return `C = ${beltTermRhs(includeTaxa)}`;
  const hall = `C_d = ${beltTermRhs(includeTaxa)}`;
  const pieces = pairs.map(
    (pair) =>
      `${beltConnectionSymbol(pair)} = (${beltConnectionNumerator(pair, includeTaxa)}) / 60`,
  );
  return `C = C_d + ${pairs.map(beltConnectionSymbol).join(" + ")}; ${hall}; ${pieces.join("; ")}`;
}

export function connectionAreaNumerator(
  includeTaxa = false,
  empSuffix = "",
): string {
  const demand = withTu("DHp_c", includeTaxa);
  return `${demand} × Emp${empSuffix} × Toi${empSuffix}`;
}

export function connectionAreaRhs(
  includeTaxa = false,
  empSuffix = "",
): string {
  return `(${connectionAreaNumerator(includeTaxa, empSuffix)}) / 60`;
}

export function connectionAreaDisplay(
  includeTaxa = false,
  empSuffix = "",
): string {
  return `Ad_c = ${connectionAreaRhs(includeTaxa, empSuffix)}`;
}

export function boardingConnectionNumerator(
  pair: BoardingConnectionPair,
  includeTaxa = false,
  empSuffix = "",
): string {
  const demand = withTu(boardingConnectionSpec(pair).dhpSymbol, includeTaxa);
  return `${demand} × Emp${empSuffix} × Toi${empSuffix}`;
}

export function boardingConnectionAreaDisplay(
  pair: BoardingConnectionPair,
  includeTaxa = false,
  empSuffix = "",
): string {
  const lhs = boardingConnectionSpec(pair).areaSymbol;
  return `${lhs} = (${boardingConnectionNumerator(pair, includeTaxa, empSuffix)}) / 60`;
}

function boardingConnectionAreasClause(
  pairs: readonly BoardingConnectionPair[],
  includeTaxa: boolean,
  empSuffix: string,
): string {
  return `${pairs
    .map((pair) => boardingConnectionAreaDisplay(pair, includeTaxa, empSuffix))
    .join("; ")};`;
}

export function simpleConnectionSumDisplay(
  pairs: readonly BoardingConnectionPair[] = [],
): string {
  if (pairs.length > 0) {
    return `Ad = Ad_e + ${boardingConnectionAreaList(pairs)}`;
  }
  return "Ad = Ad_e + Ad_c";
}

export function simpleConnectionFormulaDisplay(
  companions: boolean,
  includeTaxa = false,
  pairs: readonly BoardingConnectionPair[] = [],
): string {
  const connection =
    pairs.length > 0
      ? boardingConnectionAreasClause(pairs, includeTaxa, "_e")
      : `${connectionAreaDisplay(includeTaxa)};`;
  return `Ad_e = ${areaFormulaRhs(companions, includeTaxa)}; ${connection} ${simpleConnectionSumDisplay(pairs)}`;
}

export function demandSymbol(id: ComponentParamId): string {
  switch (id) {
    case "demandaPicoEmbarque":
      return "DHp_e";
    case "demandaPicoDesembarque":
      return "DHp_d";
    case "demandaPicoEmbarqueDomestico":
      return "DHp_e,dom";
    case "demandaPicoEmbarqueInternacional":
      return "DHp_e,int";
    case "demandaPicoDesembarqueDomestico":
      return "DHp_d,dom";
    case "demandaPicoDesembarqueInternacional":
      return "DHp_d,int";
    case "demandaPicoDomestico":
      return "DHp_dom";
    case "demandaPicoInternacional":
      return "DHp_int";
    case "demandaPicoConexao":
      return "DHp_c";
    case "demandaPicoConexaoDomDom":
      return "DHp_c,DomDom";
    case "demandaPicoConexaoIntDom":
      return "DHp_c,IntDom";
    case "demandaPicoConexaoDomInt":
      return "DHp_c,DomInt";
    case "demandaPicoConexaoIntInt":
      return "DHp_c,IntInt";
    case "demandaPicoConexaoDesembarqueDomInt":
      return "DHp_c,DomInt";
    case "demandaPicoConexaoDesembarqueIntDom":
      return "DHp_c,IntDom";
    case "demandaPicoConexaoDesembarqueIntInt":
      return "DHp_c,IntInt";
    default:
      return "DHp";
  }
}

export function equipmentDemandDisplay(
  demandIds: readonly ComponentParamId[],
): string {
  if (demandIds.length <= 1) {
    return demandSymbol(demandIds[0] ?? "demandaPico");
  }
  return `(${demandIds.map(demandSymbol).join(" + ")})`;
}

export function equipmentTsecSymbol(id: ComponentParamId = "tsec"): string {
  switch (id) {
    case "tsecEmbarque":
      return "Tsec_e";
    case "tsecDesembarque":
      return "Tsec_d";
    case "tsecEmbarqueDomestico":
      return "Tsec_e,dom";
    case "tsecEmbarqueInternacional":
      return "Tsec_e,int";
    case "tsecDesembarqueDomestico":
      return "Tsec_d,dom";
    case "tsecDesembarqueInternacional":
      return "Tsec_d,int";
    case "tsecDomestico":
      return "Tsec_dom";
    case "tsecInternacional":
      return "Tsec_int";
    default:
      return "Tsec";
  }
}

export function equipmentTuSymbol(id?: ComponentParamId | null): string {
  if (id === "taxaDeUsoEquipamentoDomestico") return "Tu_dom";
  if (id === "taxaDeUsoEquipamentoInternacional") return "Tu_int";
  return "Tu";
}

export function equipmentNumerator(
  demandIds: readonly ComponentParamId[] = ["demandaPico"],
  includeTaxa = false,
  tsec: ComponentParamId = "tsec",
  taxa?: ComponentParamId | null,
): string {
  const demand = equipmentDemandDisplay(demandIds);
  const head = taxa
    ? `${demand} × ${equipmentTuSymbol(taxa)}`
    : withTu(demand, includeTaxa);
  return `${head} × ${equipmentTsecSymbol(tsec)}`;
}

export function splitEquipmentSymbol(tsec: ComponentParamId): string {
  if (tsec === "tsecDomestico") return "N_dom";
  if (tsec === "tsecInternacional") return "N_int";
  return "N";
}

export function equipmentToiSymbol(id: ComponentParamId): string {
  switch (id) {
    case "tempoDeOcupacaoEmbarque":
      return "Toi_e";
    case "tempoDeOcupacaoDesembarque":
      return "Toi_d";
    case "tempoDeOcupacaoEmbarqueDomestico":
      return "Toi_e,dom";
    case "tempoDeOcupacaoEmbarqueInternacional":
      return "Toi_e,int";
    case "tempoDeOcupacaoDesembarqueDomestico":
      return "Toi_d,dom";
    case "tempoDeOcupacaoDesembarqueInternacional":
      return "Toi_d,int";
    case "tempoDeOcupacaoDomestico":
      return "Toi_dom";
    case "tempoDeOcupacaoInternacional":
      return "Toi_int";
    default:
      return "Toi";
  }
}

export function equipmentTermDisplay(
  term: EquipmentTerm,
  includeTaxa = false,
): string {
  const taxa = term.taxa ?? (includeTaxa ? "taxaDeUsoEquipamento" : null);
  return `(${equipmentNumerator(term.demandIds, includeTaxa, term.tsec, taxa)}) / (60 × (60 + ${equipmentToiSymbol(term.toi)}))`;
}

export function splitEquipmentFormulaDisplay(
  terms: readonly EquipmentTerm[],
): string {
  const ordered = [...terms].sort((left, right) =>
    left.tsec === "tsecDomestico" ? -1 : right.tsec === "tsecDomestico" ? 1 : 0,
  );
  const parts = ordered.map(
    (term) =>
      `${splitEquipmentSymbol(term.tsec)} = ⌈${equipmentTermDisplay(term)}⌉`,
  );
  return `${parts.join("; ")}; N = N_dom + N_int`;
}

const SINGLE_EQUIPMENT_TERM: EquipmentTerm = {
  demandIds: ["demandaPico"],
  toi: "tempoDeOcupacao",
  tsec: "tsec",
};

export function beltNumerator(includeTaxa = false): string {
  const demand = includeTaxa ? "DHp × Tu" : "DHp";
  return `${demand} × Tr × Lmp × Toi`;
}

export function beltTermRhs(includeTaxa = false): string {
  return `(${beltNumerator(includeTaxa)}) / 60`;
}

export function equipmentFormulaDisplay(
  terms: readonly EquipmentTerm[] = [SINGLE_EQUIPMENT_TERM],
  includeTaxa = false,
): string {
  const parts = (terms.length > 0 ? terms : [SINGLE_EQUIPMENT_TERM]).map(
    (term) => equipmentTermDisplay(term, includeTaxa),
  );
  if (parts.length === 1) return `N = ⌈${parts[0]}⌉`;
  return `N = ⌈${parts.join(" + ")}⌉`;
}

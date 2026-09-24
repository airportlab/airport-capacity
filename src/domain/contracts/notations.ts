import type { ComponentParamId, EquipmentTerm } from "../types";

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

function withTu(head: string, includeTaxa: boolean): string {
  return includeTaxa ? `${head} × Tu` : head;
}

export function areaNumerator(
  companions: boolean,
  includeTaxa = false,
  suffix = "",
): string {
  const demand = withTu(`DHp${suffix}`, includeTaxa);
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

export function dualAreaSumDisplay(hasConnection = false): string {
  return hasConnection ? "Ad = Ad_e + Ad_d + Ad_c" : "Ad = Ad_e + Ad_d";
}

export function dualAreaFormulaDisplay(
  companions: boolean,
  includeTaxa = false,
  hasConnection = false,
): string {
  const connection = hasConnection
    ? ` Ad_c = ${connectionAreaRhs(includeTaxa, "_e")};`
    : "";
  return `Ad_e = ${dualBoardingAreaRhs(companions, includeTaxa)}; Ad_d = ${dualArrivalsAreaRhs(companions, includeTaxa)};${connection} ${dualAreaSumDisplay(hasConnection)}`;
}

export function singleFunctionMixedSumDisplay(): string {
  return "Ad = Ad_dom + Ad_int";
}

export function singleFunctionMixedFormulaDisplay(
  companions: boolean,
  includeTaxa = false,
): string {
  const rhs = (suffix: string) =>
    `(${areaNumerator(companions, includeTaxa, suffix)}) / 60`;
  return `Ad_dom = ${rhs("_dom")}; Ad_int = ${rhs("_int")}; ${singleFunctionMixedSumDisplay()}`;
}

export function mixedAreaSumDisplay(
  flowCount = 4,
  hasConnection = false,
  arrivalsOnly = false,
): string {
  if (arrivalsOnly) {
    return hasConnection
      ? "Ad = Ad_d,dom + Ad_d,int + Ad_c,dom + Ad_c,int"
      : "Ad = Ad_d,dom + Ad_d,int";
  }
  const base =
    flowCount <= 2
      ? "Ad = Ad_e,dom + Ad_e,int"
      : "Ad = Ad_e,dom + Ad_e,int + Ad_d,dom + Ad_d,int";
  return hasConnection ? `${base} + Ad_c` : base;
}

export function mixedAreaFormulaDisplay(
  companions: boolean,
  flowCount = 4,
  includeTaxa = false,
  hasConnection = false,
  arrivalsOnly = false,
): string {
  const rhs = areaFormulaRhs(companions, includeTaxa);
  const connection = hasConnection
    ? ` Ad_c = ${connectionAreaRhs(includeTaxa, "_e,dom")};`
    : "";
  if (arrivalsOnly) {
    const connection = hasConnection
      ? ` ${arrivalsConnectionAreaDisplay("dom", includeTaxa)}; ${arrivalsConnectionAreaDisplay("int", includeTaxa)};`
      : "";
    return `Ad_d,dom = ${rhs}; Ad_d,int = ${rhs};${connection} ${mixedAreaSumDisplay(2, hasConnection, true)}`;
  }
  if (flowCount <= 2) {
    return `Ad_e,dom = ${rhs}; Ad_e,int = ${rhs};${connection} ${mixedAreaSumDisplay(2, hasConnection)}`;
  }
  return `Ad_e,dom = ${rhs}; Ad_e,int = ${rhs}; Ad_d,dom = ${rhs}; Ad_d,int = ${rhs};${connection} ${mixedAreaSumDisplay(4, hasConnection)}`;
}

export function arrivalsConnectionNumerator(
  kind: "dom" | "int",
  includeTaxa = false,
): string {
  const demand = withTu(
    kind === "dom" ? "DHp_c,dom" : "DHp_c,int",
    includeTaxa,
  );
  const suffix = kind === "dom" ? "_d,dom" : "_d,int";
  return `${demand} × Emp${suffix} × Toi${suffix}`;
}

export function arrivalsConnectionAreaDisplay(
  kind: "dom" | "int",
  includeTaxa = false,
): string {
  const lhs = kind === "dom" ? "Ad_c,dom" : "Ad_c,int";
  return `${lhs} = (${arrivalsConnectionNumerator(kind, includeTaxa)}) / 60`;
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

export function simpleConnectionSumDisplay(): string {
  return "Ad = Ad_e + Ad_c";
}

export function simpleConnectionFormulaDisplay(
  companions: boolean,
  includeTaxa = false,
): string {
  return `Ad_e = ${areaFormulaRhs(companions, includeTaxa)}; ${connectionAreaDisplay(includeTaxa)}; ${simpleConnectionSumDisplay()}`;
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
    case "demandaPicoConexaoDesembarqueDomestico":
      return "DHp_c,dom";
    case "demandaPicoConexaoDesembarqueInternacional":
      return "DHp_c,int";
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

export function equipmentNumerator(
  demandIds: readonly ComponentParamId[] = ["demandaPico"],
  includeTaxa = false,
  tsec: ComponentParamId = "tsec",
): string {
  return `${withTu(equipmentDemandDisplay(demandIds), includeTaxa)} × ${equipmentTsecSymbol(tsec)}`;
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
  return `(${equipmentNumerator(term.demandIds, includeTaxa, term.tsec)}) / (60 × (60 + ${equipmentToiSymbol(term.toi)}))`;
}

const SINGLE_EQUIPMENT_TERM: EquipmentTerm = {
  demandIds: ["demandaPico"],
  toi: "tempoDeOcupacao",
  tsec: "tsec",
};

export function beltSuffix(area: string): string {
  switch (area) {
    case "areaMinimaDesembarqueDomestico":
      return "_d,dom";
    case "areaMinimaDesembarqueInternacional":
      return "_d,int";
    case "areaMinimaDesembarque":
      return "_d";
    default:
      return "";
  }
}

export function beltNumerator(suffix = ""): string {
  const dhp = suffix ? `DHp${suffix}` : "DHp";
  const toi = suffix ? `Toi${suffix}` : "Toi";
  return `${dhp} × Tr × Lmp × ${toi}`;
}

export function beltTermRhs(suffix = ""): string {
  return `(${beltNumerator(suffix)}) / 60`;
}

export function beltLhs(suffix: string): string {
  if (suffix === "_d,dom") return "C_d,dom";
  if (suffix === "_d,int") return "C_d,int";
  return "C";
}

export function beltTermDisplay(suffix: string): string {
  return `${beltLhs(suffix)} = ${beltTermRhs(suffix)}`;
}

export function beltSumDisplay(): string {
  return "C = C_d,dom + C_d,int";
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

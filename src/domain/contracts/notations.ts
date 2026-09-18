export const AREA_NOTATIONS = [
  { symbol: "Ad", meaning: "Área mínima necessária", unit: "m²" },
  { symbol: "DHp", meaning: "Demanda hora pico do componente", unit: "pax/h" },
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

export function dualAreaSumDisplay(): string {
  return "Ad = Ad_e + Ad_d";
}

export function dualAreaFormulaDisplay(
  companions: boolean,
  includeTaxa = false,
): string {
  return `Ad_e = ${dualBoardingAreaRhs(companions, includeTaxa)}; Ad_d = ${dualArrivalsAreaRhs(companions, includeTaxa)}; ${dualAreaSumDisplay()}`;
}

export function mixedAreaSumDisplay(flowCount = 4): string {
  return flowCount <= 2
    ? "Ad = Ad_e,dom + Ad_e,int"
    : "Ad = Ad_e,dom + Ad_e,int + Ad_d,dom + Ad_d,int";
}

export function mixedAreaFormulaDisplay(
  companions: boolean,
  flowCount = 4,
  includeTaxa = false,
): string {
  const rhs = areaFormulaRhs(companions, includeTaxa);
  if (flowCount <= 2) {
    return `Ad_e,dom = ${rhs}; Ad_e,int = ${rhs}; ${mixedAreaSumDisplay(2)}`;
  }
  return `Ad_e,dom = ${rhs}; Ad_e,int = ${rhs}; Ad_d,dom = ${rhs}; Ad_d,int = ${rhs}; ${mixedAreaSumDisplay(4)}`;
}

export function equipmentNumerator(
  demandCount = 1,
  mixedNature = false,
  includeTaxa = false,
): string {
  const demand =
    demandCount >= 4
      ? "(DHp_e,dom + DHp_e,int + DHp_d,dom + DHp_d,int)"
      : demandCount >= 2 && mixedNature
        ? "(DHp_e,dom + DHp_e,int)"
        : demandCount >= 2
          ? "(DHp_e + DHp_d)"
          : "DHp";
  return `${withTu(demand, includeTaxa)} × tsec`;
}

export function equipmentFormulaDisplay(
  demandCount = 1,
  mixedNature = false,
  includeTaxa = false,
): string {
  return `N = ⌈(${equipmentNumerator(demandCount, mixedNature, includeTaxa)}) / (60 × (60 + Toi))⌉`;
}

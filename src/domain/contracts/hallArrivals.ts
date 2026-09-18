import type { ComponentContract } from "../types";
import { AREA_WITH_COMPANIONS_PARAM_IDS, pickFields } from "./fields";
import { capacityFormulas } from "./formulas";
import { DEFAULT_PEAK_NATURE, roundOrigem } from "../pmd";

export const hallArrivalsContract: ComponentContract = {
  id: "hallArrivals",
  title: "Saguão de desembarque",
  sheetName: "Saguao desc.",
  requirements: {
    area: { companions: true },
  },
  subtitle:
    "Saguão de desembarque. Emp por ocupante, v.a. e tempo médio de ocupação do PMD.",
  params: pickFields(AREA_WITH_COMPANIONS_PARAM_IDS, {
    areaMedida: {
      defaultValue: 400,
      origem: "Área informada / medida do saguão de desembarque.",
    },
    espacoMinimoPorPassageiro: {
      defaultValue: 1.7,
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
    tempoDeOcupacao: {
      defaultValue: 15,
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
    va: {
      defaultValue: 1,
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
  }),
  formulas: capacityFormulas({
    includeArea: true,
    companions: true,
  }),
};

import type { ComponentContract } from "../types";
import { AREA_WITH_COMPANIONS_PARAM_IDS, pickFields } from "./fields";
import { capacityFormulas } from "./formulas";
import { DEFAULT_PEAK_NATURE, roundOrigem } from "../pmd";

export const hallContract: ComponentContract = {
  id: "hall",
  title: "Saguão de embarque",
  sheetName: "Saguao emb.",
  requirements: {
    area: { companions: true },
  },
  subtitle:
    "Saguão de embarque. Emp por ocupante, v.a. e tempo médio de ocupação do PMD.",
  params: pickFields(AREA_WITH_COMPANIONS_PARAM_IDS, {
    areaMedida: {
      defaultValue: 650,
      origem: "Área informada / medida do saguão de embarque.",
    },
    espacoMinimoPorPassageiro: {
      defaultValue: 2.3,
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
    tempoDeOcupacao: {
      defaultValue: 20,
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

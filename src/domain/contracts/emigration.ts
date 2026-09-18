import type { ComponentContract } from "../types";
import { AREA_PARAM_IDS, pickFields } from "./fields";
import { capacityFormulas } from "./formulas";
import { roundOrigem } from "../pmd";

export const emigrationContract: ComponentContract = {
  id: "emigration",
  title: "Emigração",
  sheetName: "Emigracao",
  requirements: {
    area: { companions: false },
  },
  subtitle:
    "Fila de emigração. Área pelo guia mínimo — só há valor de contrato na hora-pico internacional.",
  params: pickFields(AREA_PARAM_IDS, {
    areaMedida: {
      defaultValue: 80,
      origem: "Área informada / medida da fila de emigração.",
    },
    espacoMinimoPorPassageiro: {
      defaultValue: 1.0,
      unit: "m²/pax",
      label: "Espaço mínimo por passageiro (Emp)",
      origem: roundOrigem("internacional"),
    },
    tempoDeOcupacao: {
      defaultValue: 10,
      origem: roundOrigem("internacional"),
    },
  }),
  formulas: capacityFormulas({
    includeArea: true,
  }),
};

import type { ComponentContract } from "../types";
import {
  AREA_AND_EQUIPMENT_PARAM_IDS,
  pickFields,
} from "./fields";
import { capacityFormulas } from "./formulas";
import { roundOrigem } from "../pmd";

export const customsContract: ComponentContract = {
  id: "customs",
  title: "Aduana",
  sheetName: "Aduana",
  requirements: {
    area: { companions: false },
    equipment: {},
  },
  subtitle:
    "Controle aduaneiro. Área e postos de atendimento pelo guia mínimo de dimensionamento.",
  params: pickFields(AREA_AND_EQUIPMENT_PARAM_IDS, {
    areaMedida: {
      defaultValue: 140,
      origem: "Área informada / medida do componente aduaneiro.",
    },
    espacoMinimoPorPassageiro: {
      defaultValue: 1.7,
      unit: "m²/pax",
      label: "Espaço mínimo por passageiro (Emp)",
      origem: roundOrigem("internacional"),
    },
    tempoDeOcupacao: {
      defaultValue: 10,
      origem: roundOrigem("internacional"),
    },
    tsec: {
      defaultValue: 45,
      origem: "Tempo em segundos de atendimento no posto aduaneiro.",
    },
  }),
  formulas: capacityFormulas({
    usoRealLabel: "Uso real da aduana",
    usoRealOrigem:
      "O uso real da aduana é dado pela taxa de uso × demanda pico.",
    includeArea: true,
    includeEquipment: true,
  }),
};

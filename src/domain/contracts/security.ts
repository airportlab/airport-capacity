import type { ComponentContract } from "../types";
import {
  AREA_AND_EQUIPMENT_PARAM_IDS,
  pickFields,
} from "./fields";
import { capacityFormulas } from "./formulas";
import { DEFAULT_PEAK_NATURE, roundOrigem } from "../pmd";

export const securityContract: ComponentContract = {
  id: "security",
  title: "Inspeção de segurança",
  sheetName: "Seguranca",
  requirements: {
    area: { companions: false },
    equipment: {},
  },
  subtitle:
    "Área e faixas de inspeção pelo guia mínimo de dimensionamento.",
  params: pickFields(AREA_AND_EQUIPMENT_PARAM_IDS, {
    areaMedida: {
      defaultValue: 90,
      origem: "Área informada / medida do componente de inspeção.",
    },
    espacoMinimoPorPassageiro: {
      defaultValue: 1.0,
      unit: "m²/pax",
      label: "Espaço mínimo por passageiro (Emp)",
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
    tempoDeOcupacao: {
      defaultValue: 10,
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
    tsec: {
      defaultValue: 22,
      origem: "Tempo em segundos de uso do pórtico / raios-X por passageiro.",
    },
  }),
  formulas: capacityFormulas({
    usoRealLabel: "Uso real da inspeção",
    usoRealOrigem:
      "O uso real da inspeção é dado pela taxa de uso × demanda pico.",
    includeArea: true,
    includeEquipment: true,
  }),
};

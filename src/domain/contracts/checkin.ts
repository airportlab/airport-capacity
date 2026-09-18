import type { ComponentContract } from "../types";
import {
  AREA_AND_EQUIPMENT_PARAM_IDS,
  pickFields,
} from "./fields";
import { capacityFormulas } from "./formulas";
import { DEFAULT_PEAK_NATURE, roundOrigem } from "../pmd";

export const checkinContract: ComponentContract = {
  id: "checkin",
  title: "Check-in e despacho de bagagens",
  sheetName: "Check-in",
  requirements: {
    area: { companions: false },
    equipment: {},
  },
  subtitle:
    "Área e posições de atendimento pelo guia mínimo de dimensionamento.",
  params: pickFields(AREA_AND_EQUIPMENT_PARAM_IDS, {
    areaMedida: {
      defaultValue: 120,
      origem: "Área informada / medida do componente de check-in.",
    },
    espacoMinimoPorPassageiro: {
      defaultValue: 1.3,
      unit: "m²/pax",
      label: "Espaço mínimo por passageiro (Emp)",
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
    tempoDeOcupacao: {
      defaultValue: 20,
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
    tsec: {
      defaultValue: 90,
      origem: "Tempo em segundos de uso do balcão / posição de check-in.",
    },
  }),
  formulas: capacityFormulas({
    usoRealLabel: "Uso real do check-in",
    usoRealOrigem:
      "O uso real do check-in é dado pela taxa de uso × demanda pico.",
    includeArea: true,
    includeEquipment: true,
  }),
};

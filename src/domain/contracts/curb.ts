import type { ComponentContract } from "../types";
import {
  AREA_AND_EQUIPMENT_PARAM_IDS,
  pickFields,
} from "./fields";
import { capacityFormulas } from "./formulas";

export const curbContract: ComponentContract = {
  id: "curb",
  title: "Meio-fio",
  sheetName: "Meio-fio",
  requirements: {
    area: { companions: false },
    equipment: {},
  },
  subtitle:
    "Frente de acesso veicular. Área (equivalente) e posições de parada pelo guia mínimo.",
  params: pickFields(AREA_AND_EQUIPMENT_PARAM_IDS, {
    areaMedida: {
      defaultValue: 200,
      origem: "Área / frente equivalente medida do meio-fio.",
    },
    tempoDeOcupacao: {
      defaultValue: 3,
      origem: "Tempo de permanência no meio-fio, em minutos.",
    },
    tsec: {
      defaultValue: 120,
      origem: "Tempo em segundos de ocupação da posição de parada por passageiro.",
    },
  }),
  formulas: capacityFormulas({
    usoRealLabel: "Uso real do meio-fio",
    usoRealOrigem:
      "O uso real do meio-fio é dado pela taxa de uso × demanda pico.",
    includeArea: true,
    includeEquipment: true,
  }),
};

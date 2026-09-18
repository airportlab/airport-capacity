import type { ComponentContract } from "../types";
import { AREA_PARAM_IDS, pickFields } from "./fields";
import { capacityFormulas } from "./formulas";
import { DEFAULT_PEAK_NATURE, roundOrigem } from "../pmd";

export const arrivalsContract: ComponentContract = {
  id: "arrivals",
  title: "Sala de desembarque",
  sheetName: "Sala desembarque",
  requirements: {
    area: { companions: false },
  },
  subtitle:
    "Componente de chegadas. Só área pelo guia mínimo — sem equipamentos de processamento.",
  params: pickFields(AREA_PARAM_IDS, {
    areaMedida: {
      defaultValue: 260,
      origem: "Área informada / medida da sala de desembarque.",
    },
    espacoMinimoPorPassageiro: {
      defaultValue: 1.7,
      unit: "m²/pax",
      label: "Espaço mínimo por passageiro (Emp)",
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
    tempoDeOcupacao: {
      defaultValue: 20,
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
  }),
  formulas: capacityFormulas({
    usoRealLabel: "Uso real da sala de desembarque",
    usoRealOrigem:
      "O uso real da sala de desembarque é dado pela taxa de uso × demanda pico.",
    includeArea: true,
    includeEquipment: false,
  }),
};

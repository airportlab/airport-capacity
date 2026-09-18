import type { ComponentContract } from "../types";
import { AREA_WITH_SEATS_PARAM_IDS, pickFields } from "./fields";
import { capacityFormulas } from "./formulas";
import { DEFAULT_PEAK_NATURE, roundOrigem } from "../pmd";

export const boardingRemoteContract: ComponentContract = {
  id: "boardingRemote",
  title: "Sala de embarque (remotas)",
  sheetName: "Emb. remotas",
  requirements: {
    area: { companions: false },
  },
  subtitle:
    "Atendimento em posições remotas. Área e percentual mínimo de assentos do PMD.",
  params: pickFields(AREA_WITH_SEATS_PARAM_IDS, {
    areaMedida: {
      defaultValue: 280,
      origem: "Área informada / medida da sala de embarque remota.",
    },
    espacoMinimoPorPassageiro: {
      defaultValue: 2.3,
      unit: "m²/pax",
      label: "Espaço mínimo por passageiro (Emp)",
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
    tempoDeOcupacao: {
      defaultValue: 40,
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
    percentualMinimoAssentos: {
      defaultValue: 70,
      origem: roundOrigem(DEFAULT_PEAK_NATURE),
    },
  }),
  formulas: capacityFormulas({
    includeArea: true,
    includeSeats: true,
  }),
};

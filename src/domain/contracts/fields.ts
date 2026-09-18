import type { ComponentParamId, ParamField, SizingParamId } from "../types";
import { SIZING_PARAM_IDS } from "../types";

const TEMPLATES: Record<ComponentParamId, ParamField<ComponentParamId>> = {
  demandaPico: {
    id: "demandaPico",
    kind: "attribute",
    label: "Demanda hora pico (DHp)",
    unit: "pax/h",
    defaultValue: 400,
    origem:
      "Atributo do componente. Demanda na hora-pico deste fluxo, em passageiros por hora.",
  },
  demandaPicoEmbarque: {
    id: "demandaPicoEmbarque",
    kind: "attribute",
    label: "Demanda hora pico de embarque (DHp)",
    unit: "pax/h",
    defaultValue: 400,
    origem:
      "Atributo do fluxo de embarque. Demanda na hora-pico deste fluxo, em passageiros por hora.",
  },
  demandaPicoDesembarque: {
    id: "demandaPicoDesembarque",
    kind: "attribute",
    label: "Demanda hora pico de desembarque (DHp)",
    unit: "pax/h",
    defaultValue: 400,
    origem:
      "Atributo do fluxo de desembarque. Demanda na hora-pico deste fluxo, em passageiros por hora.",
  },
  taxaDeUsoArea: {
    id: "taxaDeUsoArea",
    kind: "attribute",
    label: "Taxa de utilização (Tu)",
    unit: "%",
    defaultValue: 100,
    origem: "",
  },
  taxaDeUsoEquipamento: {
    id: "taxaDeUsoEquipamento",
    kind: "attribute",
    label: "Taxa de utilização (Tu)",
    unit: "%",
    defaultValue: 100,
    origem: "",
  },
  areaMedida: {
    id: "areaMedida",
    kind: "attribute",
    label: "Área medida",
    unit: "m²",
    defaultValue: 100,
    origem: "Área informada / medida do componente.",
  },
  espacoMinimoPorPassageiro: {
    id: "espacoMinimoPorPassageiro",
    kind: "sizing",
    label: "Espaço mínimo por ocupante (Emp)",
    unit: "m²/ocup",
    defaultValue: 1.8,
    origem: "Parâmetro mínimo de dimensionamento. Valor de contrato da rodada.",
  },
  tempoDeOcupacao: {
    id: "tempoDeOcupacao",
    kind: "sizing",
    label: "Tempo de ocupação (Toi)",
    unit: "min",
    defaultValue: 10,
    origem:
      "Parâmetro mínimo de dimensionamento. Toi na fórmula de Ad; o divisor 60 assume minutos.",
  },
  espacoMinimoPorPassageiroEmbarque: {
    id: "espacoMinimoPorPassageiroEmbarque",
    kind: "sizing",
    label: "Espaço mínimo por passageiro (Emp) · embarque",
    unit: "m²/pax",
    defaultValue: 2.3,
    origem:
      "Parâmetro mínimo de dimensionamento do fluxo de embarque. Valor de contrato da rodada.",
  },
  espacoMinimoPorPassageiroDesembarque: {
    id: "espacoMinimoPorPassageiroDesembarque",
    kind: "sizing",
    label: "Espaço mínimo por passageiro (Emp) · desembarque",
    unit: "m²/pax",
    defaultValue: 1.7,
    origem:
      "Parâmetro mínimo de dimensionamento do fluxo de desembarque. Valor de contrato da rodada.",
  },
  tempoDeOcupacaoEmbarque: {
    id: "tempoDeOcupacaoEmbarque",
    kind: "sizing",
    label: "Tempo de ocupação (Toi) · embarque",
    unit: "min",
    defaultValue: 40,
    origem:
      "Parâmetro mínimo de dimensionamento do fluxo de embarque. Toi na fórmula de Ad_e; o divisor 60 assume minutos.",
  },
  tempoDeOcupacaoDesembarque: {
    id: "tempoDeOcupacaoDesembarque",
    kind: "sizing",
    label: "Tempo de ocupação (Toi) · desembarque",
    unit: "min",
    defaultValue: 20,
    origem:
      "Parâmetro mínimo de dimensionamento do fluxo de desembarque. Toi na fórmula de Ad_d; o divisor 60 assume minutos.",
  },
  demandaPicoEmbarqueDomestico: {
    id: "demandaPicoEmbarqueDomestico",
    kind: "attribute",
    label: "DHp embarque doméstico",
    unit: "pax/h",
    defaultValue: 400,
    origem: "Atributo do fluxo de embarque doméstico.",
  },
  demandaPicoEmbarqueInternacional: {
    id: "demandaPicoEmbarqueInternacional",
    kind: "attribute",
    label: "DHp embarque internacional",
    unit: "pax/h",
    defaultValue: 400,
    origem: "Atributo do fluxo de embarque internacional.",
  },
  demandaPicoDesembarqueDomestico: {
    id: "demandaPicoDesembarqueDomestico",
    kind: "attribute",
    label: "DHp desembarque doméstico",
    unit: "pax/h",
    defaultValue: 400,
    origem: "Atributo do fluxo de desembarque doméstico.",
  },
  demandaPicoDesembarqueInternacional: {
    id: "demandaPicoDesembarqueInternacional",
    kind: "attribute",
    label: "DHp desembarque internacional",
    unit: "pax/h",
    defaultValue: 400,
    origem: "Atributo do fluxo de desembarque internacional.",
  },
  espacoMinimoPorPassageiroEmbarqueDomestico: {
    id: "espacoMinimoPorPassageiroEmbarqueDomestico",
    kind: "sizing",
    label: "Emp · embarque doméstico",
    unit: "m²/ocup",
    defaultValue: 2.3,
    origem: "PMD do saguão de embarque, coluna doméstico.",
  },
  espacoMinimoPorPassageiroEmbarqueInternacional: {
    id: "espacoMinimoPorPassageiroEmbarqueInternacional",
    kind: "sizing",
    label: "Emp · embarque internacional",
    unit: "m²/ocup",
    defaultValue: 2.3,
    origem: "PMD do saguão de embarque, coluna internacional.",
  },
  espacoMinimoPorPassageiroDesembarqueDomestico: {
    id: "espacoMinimoPorPassageiroDesembarqueDomestico",
    kind: "sizing",
    label: "Emp · desembarque doméstico",
    unit: "m²/ocup",
    defaultValue: 1.7,
    origem: "PMD do saguão de desembarque, coluna doméstico.",
  },
  espacoMinimoPorPassageiroDesembarqueInternacional: {
    id: "espacoMinimoPorPassageiroDesembarqueInternacional",
    kind: "sizing",
    label: "Emp · desembarque internacional",
    unit: "m²/ocup",
    defaultValue: 1.7,
    origem: "PMD do saguão de desembarque, coluna internacional.",
  },
  tempoDeOcupacaoEmbarqueDomestico: {
    id: "tempoDeOcupacaoEmbarqueDomestico",
    kind: "sizing",
    label: "Toi · embarque doméstico",
    unit: "min",
    defaultValue: 20,
    origem: "PMD do saguão de embarque, coluna doméstico.",
  },
  tempoDeOcupacaoEmbarqueInternacional: {
    id: "tempoDeOcupacaoEmbarqueInternacional",
    kind: "sizing",
    label: "Toi · embarque internacional",
    unit: "min",
    defaultValue: 20,
    origem: "PMD do saguão de embarque, coluna internacional.",
  },
  tempoDeOcupacaoDesembarqueDomestico: {
    id: "tempoDeOcupacaoDesembarqueDomestico",
    kind: "sizing",
    label: "Toi · desembarque doméstico",
    unit: "min",
    defaultValue: 15,
    origem: "PMD do saguão de desembarque, coluna doméstico.",
  },
  tempoDeOcupacaoDesembarqueInternacional: {
    id: "tempoDeOcupacaoDesembarqueInternacional",
    kind: "sizing",
    label: "Toi · desembarque internacional",
    unit: "min",
    defaultValue: 25,
    origem: "PMD do saguão de desembarque, coluna internacional.",
  },
  vaEmbarque: {
    id: "vaEmbarque",
    kind: "sizing",
    label: "Acompanhantes (v.a) · embarque",
    unit: "v.a./pax",
    defaultValue: 1,
    origem: "Entra no numerador de Ad_e como (1 + v.a).",
  },
  vaDesembarque: {
    id: "vaDesembarque",
    kind: "sizing",
    label: "Acompanhantes (v.a) · desembarque",
    unit: "v.a./pax",
    defaultValue: 1,
    origem: "Entra no numerador de Ad_d como (1 + v.a).",
  },
  vaEmbarqueDomestico: {
    id: "vaEmbarqueDomestico",
    kind: "sizing",
    label: "v.a. · embarque doméstico",
    unit: "v.a./pax",
    defaultValue: 1,
    origem: "PMD do saguão de embarque, coluna doméstico.",
  },
  vaEmbarqueInternacional: {
    id: "vaEmbarqueInternacional",
    kind: "sizing",
    label: "v.a. · embarque internacional",
    unit: "v.a./pax",
    defaultValue: 1,
    origem: "PMD do saguão de embarque, coluna internacional.",
  },
  vaDesembarqueDomestico: {
    id: "vaDesembarqueDomestico",
    kind: "sizing",
    label: "v.a. · desembarque doméstico",
    unit: "v.a./pax",
    defaultValue: 1,
    origem: "PMD do saguão de desembarque, coluna doméstico.",
  },
  vaDesembarqueInternacional: {
    id: "vaDesembarqueInternacional",
    kind: "sizing",
    label: "v.a. · desembarque internacional",
    unit: "v.a./pax",
    defaultValue: 1,
    origem: "PMD do saguão de desembarque, coluna internacional.",
  },
  va: {
    id: "va",
    kind: "sizing",
    label: "Acompanhantes (v.a)",
    unit: "v.a./pax",
    defaultValue: 0.3,
    origem:
      "Parâmetro mínimo de dimensionamento. Entra no numerador de Ad como (1 + v.a).",
  },
  percentualMinimoAssentos: {
    id: "percentualMinimoAssentos",
    kind: "sizing",
    label: "Percentual mínimo de assentos",
    unit: "%",
    defaultValue: 70,
    origem:
      "Parâmetro mínimo de dimensionamento das salas de embarque. Fração da ocupação simultânea que deve ter assento.",
  },
  quantidadeEquipamentos: {
    id: "quantidadeEquipamentos",
    kind: "attribute",
    label: "Quantidade de equipamentos",
    unit: "un",
    defaultValue: 0,
    origem: "Quantidade existente / instalada neste componente operacional.",
  },
  tsec: {
    id: "tsec",
    kind: "attribute",
    label: "Tempo de uso do equipamento (tsec)",
    unit: "s",
    defaultValue: 60,
    origem: "Tempo em segundos de uso do equipamento.",
  },
  tempoOcupacaoEquipamento: {
    id: "tempoOcupacaoEquipamento",
    kind: "attribute",
    label: "Tempo de ocupação do equipamento (Toi)",
    unit: "min",
    defaultValue: 0,
    origem:
      "Entra no denominador como 60 × (60 + Toi). N é o inteiro imediatamente acima do quociente.",
  },
};

export const AREA_BODY_IDS: ComponentParamId[] = [
  "areaMedida",
  "espacoMinimoPorPassageiro",
  "tempoDeOcupacao",
];

export const AREA_PARAM_IDS: ComponentParamId[] = [
  "demandaPico",
  ...AREA_BODY_IDS,
];

export const AREA_WITH_COMPANIONS_PARAM_IDS: ComponentParamId[] = [
  ...AREA_PARAM_IDS,
  "va",
];

export const AREA_BODY_WITH_COMPANIONS_IDS: ComponentParamId[] = [
  ...AREA_BODY_IDS,
  "va",
];

export const EQUIPMENT_PARAM_IDS: ComponentParamId[] = [
  "quantidadeEquipamentos",
  "tsec",
  "tempoOcupacaoEquipamento",
];

export const AREA_AND_EQUIPMENT_PARAM_IDS: ComponentParamId[] = [
  ...AREA_PARAM_IDS,
  ...EQUIPMENT_PARAM_IDS,
];

export const AREA_WITH_SEATS_PARAM_IDS: ComponentParamId[] = [
  ...AREA_PARAM_IDS,
  "percentualMinimoAssentos",
];

export function isSizingParam(id: ComponentParamId): id is SizingParamId {
  return (SIZING_PARAM_IDS as readonly string[]).includes(id);
}

export function isTaxaParam(id: ComponentParamId): boolean {
  return id === "taxaDeUsoArea" || id === "taxaDeUsoEquipamento";
}

export function pickFields(
  ids: readonly ComponentParamId[],
  patch: Partial<
    Record<ComponentParamId, Partial<ParamField<ComponentParamId>>>
  > = {},
): ParamField<ComponentParamId>[] {
  return ids.map((id) => ({
    ...TEMPLATES[id],
    ...patch[id],
    id,
    kind: TEMPLATES[id].kind,
  }));
}

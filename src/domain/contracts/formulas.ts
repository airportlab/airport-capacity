import type {
  ComponentParamId,
  ContractFormula,
  EquipmentTerm,
  ExcelCellMap,
  ResolvedInputs,
} from "../types";
import type { FlowParamIds } from "./flowParams";
import { demandSum, isArrivalsOnlyMixed, tsecIdForToi } from "./flowParams";
import {
  areaFormulaDisplay,
  arrivalsConnectionAreaDisplay,
  beltSuffix,
  beltSumDisplay,
  beltTermDisplay,
  beltTermRhs,
  connectionAreaDisplay,
  dualAreaSumDisplay,
  equipmentFormulaDisplay,
  splitLoungeFormulaDisplay,
  mixedAreaSumDisplay,
  simpleConnectionSumDisplay,
  singleFunctionMixedSumDisplay,
} from "./notations";

function requiredCell(
  cells: ExcelCellMap["inputs"],
  id: keyof ExcelCellMap["inputs"],
): string {
  const cell = cells[id];
  if (!cell) {
    throw new Error(`Célula Excel ausente para ${String(id)}`);
  }
  return cell;
}

export const BELT_TR_MIN = 30;
export const BELT_LMP_MIN = 0.9;

export function isBeltManualParam(
  id: string,
): id is "taxaRetiradaBagagem" | "comprimentoLinearPassageiro" {
  return id === "taxaRetiradaBagagem" || id === "comprimentoLinearPassageiro";
}

export function beltManualStandard(
  id: "taxaRetiradaBagagem" | "comprimentoLinearPassageiro",
): number {
  return id === "taxaRetiradaBagagem" ? BELT_TR_MIN : BELT_LMP_MIN;
}

export function beltTr(inputs: ResolvedInputs): number {
  const value = inputs.taxaRetiradaBagagem;
  if (!Number.isFinite(value)) return BELT_TR_MIN;
  return Math.max(value, BELT_TR_MIN);
}

export function beltLmp(inputs: ResolvedInputs): number {
  const value = inputs.comprimentoLinearPassageiro;
  if (!Number.isFinite(value)) return BELT_LMP_MIN;
  return Math.max(value, BELT_LMP_MIN);
}

export function beltTermValue(
  inputs: ResolvedInputs,
  demanda: ComponentParamId,
  toi: ComponentParamId,
): number {
  return (
    (inputs[demanda] * (beltTr(inputs) / 100) * beltLmp(inputs) * inputs[toi]) /
    60
  );
}

function beltTermExcel(
  cells: ExcelCellMap["inputs"],
  demanda: ComponentParamId,
  toi: ComponentParamId,
): string {
  const tr = `MAX(${requiredCell(cells, "taxaRetiradaBagagem")},${BELT_TR_MIN})/100`;
  const lmp = `MAX(${requiredCell(cells, "comprimentoLinearPassageiro")},${BELT_LMP_MIN})`;
  return `(${requiredCell(cells, demanda)}*(${tr})*${lmp}*${requiredCell(cells, toi)})/60`;
}

function beltPartialResult(
  area: FlowParamIds["area"],
): "comprimentoMinimoDesembarqueDomestico" | "comprimentoMinimoDesembarqueInternacional" | null {
  if (area === "areaMinimaDesembarqueDomestico") {
    return "comprimentoMinimoDesembarqueDomestico";
  }
  if (area === "areaMinimaDesembarqueInternacional") {
    return "comprimentoMinimoDesembarqueInternacional";
  }
  return null;
}

function ceilCount(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (value <= 0) return 0;
  return Math.ceil(value - 1e-12);
}

function utilizationFactor(
  inputs: ResolvedInputs,
  taxaId: ComponentParamId | null,
): number {
  if (!taxaId) return 1;
  const value = inputs[taxaId];
  if (!Number.isFinite(value)) return 1;
  return value / 100;
}

function usedDemand(
  inputs: ResolvedInputs,
  demanda: ComponentParamId,
  taxaId: ComponentParamId | null,
): number {
  return inputs[demanda] * utilizationFactor(inputs, taxaId);
}

function usedDemandExcel(
  cells: ExcelCellMap["inputs"],
  demanda: ComponentParamId,
  taxaId: ComponentParamId | null,
): string {
  const dhp = requiredCell(cells, demanda);
  if (!taxaId || !cells[taxaId]) return dhp;
  return `${dhp}*(${requiredCell(cells, taxaId)}/100)`;
}

function splitLoungeArea(
  inputs: ResolvedInputs,
  taxaId: ComponentParamId | null,
): number {
  const share = inputs.percentualMinimoAssentos / 100;
  const occupancy = inputs.percentualOcupacaoMaxima / 100;
  if (!Number.isFinite(occupancy) || occupancy === 0) return Number.NaN;
  const seated =
    share * inputs.espacoMinimoPorPassageiro * (inputs.tempoDeOcupacao / 60);
  const standing =
    (1 - share) * inputs.espacoMinimoEmPe * (inputs.tempoDeOcupacaoEmPe / 60);
  return (usedDemand(inputs, "demandaPico", taxaId) * (seated + standing)) / occupancy;
}

function splitLoungeExcel(
  cells: ExcelCellMap["inputs"],
  taxaId: ComponentParamId | null,
): string {
  const share = `(${requiredCell(cells, "percentualMinimoAssentos")}/100)`;
  const occupancy = `(${requiredCell(cells, "percentualOcupacaoMaxima")}/100)`;
  const seated = `${share}*${requiredCell(cells, "espacoMinimoPorPassageiro")}*(${requiredCell(cells, "tempoDeOcupacao")}/60)`;
  const standing = `(1-${share})*${requiredCell(cells, "espacoMinimoEmPe")}*(${requiredCell(cells, "tempoDeOcupacaoEmPe")}/60)`;
  return `(${usedDemandExcel(cells, "demandaPico", taxaId)}*(${seated}+${standing}))/${occupancy}`;
}

function areaValue(
  inputs: ResolvedInputs,
  demanda: ComponentParamId,
  emp: ComponentParamId,
  toi: ComponentParamId,
  va?: ComponentParamId,
  taxaId: ComponentParamId | null = null,
): number {
  const numerator =
    usedDemand(inputs, demanda, taxaId) *
    inputs[emp] *
    inputs[toi] *
    (va ? 1 + inputs[va] : 1);
  return numerator / 60;
}

function areaExcel(
  cells: ExcelCellMap["inputs"],
  demanda: ComponentParamId,
  emp: ComponentParamId,
  toi: ComponentParamId,
  va?: ComponentParamId,
  taxaId: ComponentParamId | null = null,
): string {
  const factors = [
    usedDemandExcel(cells, demanda, taxaId),
    requiredCell(cells, emp),
    requiredCell(cells, toi),
  ];
  if (va) {
    factors.push(`(1+${requiredCell(cells, va)})`);
  }
  return `(${factors.join("*")})/60`;
}

function flowAreaLabel(flow: FlowParamIds, mixedNature: boolean): string {
  if (!mixedNature) {
    return flow.area === "areaMinimaEmbarque"
      ? "Área mínima de embarque (Ad_e)"
      : "Área mínima de desembarque (Ad_d)";
  }
  const labels: Partial<Record<FlowParamIds["area"], string>> = {
    areaMinimaEmbarqueDomestico: "Área mínima de embarque doméstico (Ad_e,dom)",
    areaMinimaEmbarqueInternacional:
      "Área mínima de embarque internacional (Ad_e,int)",
    areaMinimaDesembarqueDomestico:
      "Área mínima de desembarque doméstico (Ad_d,dom)",
    areaMinimaDesembarqueInternacional:
      "Área mínima de desembarque internacional (Ad_d,int)",
    areaMinimaDomestico: "Área mínima doméstica (Ad_dom)",
    areaMinimaInternacional: "Área mínima internacional (Ad_int)",
  };
  return labels[flow.area] ?? "Área mínima";
}

function flowNotationSuffix(area: FlowParamIds["area"]): string {
  switch (area) {
    case "areaMinimaEmbarque":
      return "_e";
    case "areaMinimaDesembarque":
      return "_d";
    case "areaMinimaEmbarqueDomestico":
      return "_e,dom";
    case "areaMinimaEmbarqueInternacional":
      return "_e,int";
    case "areaMinimaDesembarqueDomestico":
      return "_d,dom";
    case "areaMinimaDesembarqueInternacional":
      return "_d,int";
    case "areaMinimaDomestico":
      return "_dom";
    case "areaMinimaInternacional":
      return "_int";
    default:
      return "";
  }
}

function flowAreaExpression(
  flow: FlowParamIds,
  companions: boolean,
  includeTaxa: boolean,
): string {
  const suffix = flowNotationSuffix(flow.area);
  const dhp = withDemandTu(`DHp${suffix}`, includeTaxa);
  const emp = `Emp${suffix}`;
  const toi = `Toi${suffix}`;
  return companions
    ? `Ad${suffix} = (${dhp} × ${emp} × ${toi} × (1 + v.a${suffix})) / 60`
    : `Ad${suffix} = (${dhp} × ${emp} × ${toi}) / 60`;
}

function withDemandTu(demand: string, includeTaxa: boolean): string {
  return includeTaxa ? `${demand} × Tu` : demand;
}

function connectionExpression(
  item: FlowParamIds,
  mixedNature: boolean,
  includeTaxa: boolean,
): string {
  if (item.area === "areaMinimaConexaoDomestico") {
    return arrivalsConnectionAreaDisplay("dom", includeTaxa);
  }
  if (item.area === "areaMinimaConexaoInternacional") {
    return arrivalsConnectionAreaDisplay("int", includeTaxa);
  }
  return connectionAreaDisplay(includeTaxa, mixedNature ? "_e,dom" : "_e");
}

function connectionLabel(item: FlowParamIds): string {
  if (item.area === "areaMinimaConexaoDomestico") {
    return "Área mínima de conexão de desembarque doméstico (Ad_c,dom)";
  }
  if (item.area === "areaMinimaConexaoInternacional") {
    return "Área mínima de conexão de desembarque internacional (Ad_c,int)";
  }
  return "Área mínima de conexões (Ad_c)";
}

function equipmentDemandExcel(
  cells: ExcelCellMap["inputs"],
  demandIds: readonly ComponentParamId[],
  taxaId: ComponentParamId | null,
): string {
  if (demandIds.length === 1) {
    return usedDemandExcel(cells, demandIds[0], taxaId);
  }
  const sum = `(${demandIds.map((id) => requiredCell(cells, id)).join("+")})`;
  if (!taxaId || !cells[taxaId]) return sum;
  return `${sum}*(${requiredCell(cells, taxaId)}/100)`;
}

export function equipmentProcessingLoad(
  inputs: ResolvedInputs,
  terms: readonly EquipmentTerm[],
  taxaId: ComponentParamId | null,
): number {
  const factor = utilizationFactor(inputs, taxaId);
  let sum = 0;
  for (const term of terms) {
    const denom = 60 * (60 + inputs[term.toi]);
    if (!Number.isFinite(denom) || denom === 0) return Number.NaN;
    const piece =
      (demandSum(inputs, term.demandIds) * factor * inputs[term.tsec]) / denom;
    if (!Number.isFinite(piece)) return Number.NaN;
    sum += piece;
  }
  return sum;
}

export function capacityFormulas(copy: {
  usoRealLabel?: string;
  usoRealOrigem?: string;
  includeUsoReal?: boolean;
  includeArea?: boolean;
  includeEquipment?: boolean;
  includeSeats?: boolean;
  includeSplitLounge?: boolean;
  includeAreaTaxa?: boolean;
  includeEquipmentTaxa?: boolean;
  companions?: boolean;
  flows?: FlowParamIds[];
  demandIds?: ComponentParamId[];
  connection?: FlowParamIds | null;
  connections?: FlowParamIds[];
  equipmentTerms?: EquipmentTerm[];
  includeBelt?: boolean;
}): ContractFormula[] {
  const includeUsoReal = copy.includeUsoReal ?? false;
  const includeArea = copy.includeArea ?? false;
  const includeEquipment = copy.includeEquipment ?? false;
  const includeSeats = copy.includeSeats ?? false;
  const includeSplitLounge = copy.includeSplitLounge ?? false;
  const includeAreaTaxa = copy.includeAreaTaxa ?? false;
  const includeEquipmentTaxa = copy.includeEquipmentTaxa ?? false;
  const companions = copy.companions ?? false;
  const flows = copy.flows ?? [];
  const demandIds = copy.demandIds ?? ["demandaPico"];
  const connection = copy.connection ?? null;
  const connections =
    copy.connections ?? (connection ? [connection] : []);
  const equipmentTerms: EquipmentTerm[] =
    copy.equipmentTerms && copy.equipmentTerms.length > 0
      ? copy.equipmentTerms
      : flows.length > 0
        ? flows.map((flow) => {
            const ids: ComponentParamId[] = [flow.demanda];
            for (const item of connections) {
              if (item.toi === flow.toi) ids.push(item.demanda);
            }
            return {
              demandIds: ids,
              toi: flow.toi,
              tsec: tsecIdForToi(flow.toi, flows.length > 1),
            };
          })
        : [
            {
              demandIds: [
                ...demandIds,
                ...connections.map((item) => item.demanda),
              ],
              toi: "tempoDeOcupacao",
              tsec: "tsec",
            },
          ];
  const mixedNature = flows.some(
    (flow) =>
      flow.area.includes("Domestico") || flow.area.includes("Internacional"),
  );
  const singleFunctionMixed = flows.some(
    (flow) => flow.area === "areaMinimaDomestico",
  );
  const areaTaxaId: ComponentParamId | null = includeAreaTaxa
    ? "taxaDeUsoArea"
    : null;
  const equipmentTaxaId: ComponentParamId | null = includeEquipmentTaxa
    ? "taxaDeUsoEquipamento"
    : null;
  const includeBelt = copy.includeBelt ?? false;
  const formulas: ContractFormula[] = [];

  if (includeUsoReal) {
    formulas.push({
      id: "usoReal",
      label: copy.usoRealLabel ?? "Uso real",
      unit: "pax/h",
      origem: copy.usoRealOrigem ?? "O uso real é dado pela taxa de uso × DHp.",
      expression: includeAreaTaxa ? "Tu × DHp" : "DHp",
      evaluate: (inputs) => usedDemand(inputs, "demandaPico", areaTaxaId),
      toExcel: (cells) => usedDemandExcel(cells, "demandaPico", areaTaxaId),
    });
  }

  if (includeArea && flows.length > 0) {
    for (const flow of flows) {
      const va = companions ? flow.va : undefined;
      const expression = flowAreaExpression(flow, companions, includeAreaTaxa);
      formulas.push({
        id: flow.area,
        label: flowAreaLabel(flow, mixedNature),
        unit: "m²",
        origem: expression,
        expression,
        evaluate: (inputs) =>
          areaValue(inputs, flow.demanda, flow.emp, flow.toi, va, areaTaxaId),
        toExcel: (cells) =>
          areaExcel(cells, flow.demanda, flow.emp, flow.toi, va, areaTaxaId),
      });
    }
    for (const item of connections) {
      const expression = connectionExpression(item, mixedNature, includeAreaTaxa);
      formulas.push({
        id: item.area,
        label: connectionLabel(item),
        unit: "m²",
        origem: `${expression}. Conexões sem acompanhante.`,
        expression,
        evaluate: (inputs) =>
          areaValue(
            inputs,
            item.demanda,
            item.emp,
            item.toi,
            undefined,
            areaTaxaId,
          ),
        toExcel: (cells) =>
          areaExcel(
            cells,
            item.demanda,
            item.emp,
            item.toi,
            undefined,
            areaTaxaId,
          ),
      });
    }
    const arrivalsOnly = isArrivalsOnlyMixed(flows);
    const sumDisplay = singleFunctionMixed
      ? singleFunctionMixedSumDisplay()
      : mixedNature
        ? mixedAreaSumDisplay(flows.length, connections.length > 0, arrivalsOnly)
        : dualAreaSumDisplay(connections.length > 0);
    formulas.push({
      id: "areaMinima",
      label: "Área mínima necessária (Ad)",
      unit: "m²",
      origem: `${sumDisplay}. Uma área medida do recinto contra a soma das contas.`,
      expression: sumDisplay,
      evaluate: (inputs) =>
        flows.reduce(
          (sum, flow) =>
            sum +
            areaValue(
              inputs,
              flow.demanda,
              flow.emp,
              flow.toi,
              companions ? flow.va : undefined,
              areaTaxaId,
            ),
          0,
        ) +
        connections.reduce(
          (sum, item) =>
            sum +
            areaValue(
              inputs,
              item.demanda,
              item.emp,
              item.toi,
              undefined,
              areaTaxaId,
            ),
          0,
        ),
      toExcel: (cells) => {
        const parts = flows.map((flow) =>
          areaExcel(
            cells,
            flow.demanda,
            flow.emp,
            flow.toi,
            companions ? flow.va : undefined,
            areaTaxaId,
          ),
        );
        for (const item of connections) {
          parts.push(
            areaExcel(
              cells,
              item.demanda,
              item.emp,
              item.toi,
              undefined,
              areaTaxaId,
            ),
          );
        }
        return parts.join("+");
      },
    });
  } else if (includeArea) {
    if (connection) {
      const originExpression = `Ad_e = ${areaFormulaDisplay(companions, includeAreaTaxa).replace("Ad = ", "")}`;
      formulas.push({
        id: "areaMinimaEmbarque",
        label: "Área mínima de embarque (Ad_e)",
        unit: "m²",
        origem: originExpression,
        expression: originExpression,
        evaluate: (inputs) =>
          areaValue(
            inputs,
            "demandaPico",
            "espacoMinimoPorPassageiro",
            "tempoDeOcupacao",
            companions ? "va" : undefined,
            areaTaxaId,
          ),
        toExcel: (cells) =>
          areaExcel(
            cells,
            "demandaPico",
            "espacoMinimoPorPassageiro",
            "tempoDeOcupacao",
            companions ? "va" : undefined,
            areaTaxaId,
          ),
      });
      const connectionExpression = connectionAreaDisplay(includeAreaTaxa);
      formulas.push({
        id: connection.area,
        label: "Área mínima de conexões (Ad_c)",
        unit: "m²",
        origem: `${connectionExpression}. Conexões sem acompanhante.`,
        expression: connectionExpression,
        evaluate: (inputs) =>
          areaValue(
            inputs,
            connection.demanda,
            connection.emp,
            connection.toi,
            undefined,
            areaTaxaId,
          ),
        toExcel: (cells) =>
          areaExcel(
            cells,
            connection.demanda,
            connection.emp,
            connection.toi,
            undefined,
            areaTaxaId,
          ),
      });
      const sumDisplay = simpleConnectionSumDisplay();
      formulas.push({
        id: "areaMinima",
        label: "Área mínima necessária (Ad)",
        unit: "m²",
        origem: `${sumDisplay}. Uma área medida do recinto contra a soma das contas.`,
        expression: sumDisplay,
        evaluate: (inputs) =>
          areaValue(
            inputs,
            "demandaPico",
            "espacoMinimoPorPassageiro",
            "tempoDeOcupacao",
            companions ? "va" : undefined,
            areaTaxaId,
          ) +
          areaValue(
            inputs,
            connection.demanda,
            connection.emp,
            connection.toi,
            undefined,
            areaTaxaId,
          ),
        toExcel: (cells) =>
          [
            areaExcel(
              cells,
              "demandaPico",
              "espacoMinimoPorPassageiro",
              "tempoDeOcupacao",
              companions ? "va" : undefined,
              areaTaxaId,
            ),
            areaExcel(
              cells,
              connection.demanda,
              connection.emp,
              connection.toi,
              undefined,
              areaTaxaId,
            ),
          ].join("+"),
      });
    } else if (includeSplitLounge) {
      const expression = splitLoungeFormulaDisplay(includeAreaTaxa);
      formulas.push({
        id: "areaMinima",
        label: "Área mínima necessária (Ad)",
        unit: "m²",
        origem: `${expression}. Pa é o acesso a assentos, Ocup_max a máxima ocupação das salas. Emp_s e Toi_s do passageiro sentado; Emp_p e Toi_p do passageiro em pé.`,
        expression,
        evaluate: (inputs) => splitLoungeArea(inputs, areaTaxaId),
        toExcel: (cells) => splitLoungeExcel(cells, areaTaxaId),
      });
    } else {
      formulas.push({
        id: "areaMinima",
        label: "Área mínima necessária (Ad)",
        unit: "m²",
        origem: `${areaFormulaDisplay(companions, includeAreaTaxa)}. DHp em pax/h, Emp em m²/pax, Toi em minutos.`,
        expression: areaFormulaDisplay(companions, includeAreaTaxa),
        evaluate: (inputs) =>
          areaValue(
            inputs,
            "demandaPico",
            "espacoMinimoPorPassageiro",
            "tempoDeOcupacao",
            companions ? "va" : undefined,
            areaTaxaId,
          ),
        toExcel: (cells) =>
          areaExcel(
            cells,
            "demandaPico",
            "espacoMinimoPorPassageiro",
            "tempoDeOcupacao",
            companions ? "va" : undefined,
            areaTaxaId,
          ),
      });
    }
  }

  const seatsDemand = withDemandTu("DHp", includeAreaTaxa);
  const seatsDemandE = withDemandTu("DHp_e", includeAreaTaxa);

  if (includeSeats && flows.length === 2) {
    const boarding = flows.find((flow) => flow.area === "areaMinimaEmbarque");
    if (boarding) {
      formulas.push({
        id: "assentosMinimos",
        label: "Assentos mínimos oferecidos",
        unit: "un",
        origem:
          `Só no fluxo de embarque: ocupação simultânea (${seatsDemandE} × Toi_e / 60) vezes o percentual mínimo de assentos do contrato.`,
        expression: `(${seatsDemandE} × Toi_e / 60) × (percentual mínimo / 100)`,
        evaluate: (inputs) =>
          ((usedDemand(inputs, boarding.demanda, areaTaxaId) *
            inputs[boarding.toi]) /
            60) *
          (inputs.percentualMinimoAssentos / 100),
        toExcel: (cells) =>
          `(${usedDemandExcel(cells, boarding.demanda, areaTaxaId)}*${requiredCell(cells, boarding.toi)}/60)*(${requiredCell(cells, "percentualMinimoAssentos")}/100)`,
      });
    }
  } else if (includeSeats) {
    formulas.push({
      id: "assentosMinimos",
      label: "Assentos mínimos oferecidos",
      unit: "un",
      origem:
        `Ocupação simultânea (${seatsDemand} × Toi / 60) vezes o percentual mínimo de assentos do contrato.`,
      expression: `(${seatsDemand} × Toi / 60) × (percentual mínimo / 100)`,
      evaluate: (inputs) =>
        ((usedDemand(inputs, "demandaPico", areaTaxaId) *
          inputs.tempoDeOcupacao) /
          60) *
        (inputs.percentualMinimoAssentos / 100),
      toExcel: (cells) =>
        `(${usedDemandExcel(cells, "demandaPico", areaTaxaId)}*${requiredCell(cells, "tempoDeOcupacao")}/60)*(${requiredCell(cells, "percentualMinimoAssentos")}/100)`,
    });
  }

  if (includeEquipment) {
    const multi = equipmentTerms.length > 1;
    formulas.push({
      id: "numeroMinimoEquipamentos",
      label: "Número mínimo de equipamentos",
      unit: "un",
      origem: multi
        ? "Número mínimo inteiro de equipamentos, arredondado para cima. Cada fluxo usa o seu Toi e o seu Tsec; N é o teto da soma. Tsec em segundos."
        : `Número mínimo inteiro de equipamentos, arredondado para cima: ${equipmentFormulaDisplay(equipmentTerms, includeEquipmentTaxa)}. O Toi é o tempo de ocupação do requisito de área, em minutos; Tsec em segundos.`,
      expression: equipmentFormulaDisplay(equipmentTerms, includeEquipmentTaxa),
      evaluate: (inputs) =>
        ceilCount(
          equipmentProcessingLoad(inputs, equipmentTerms, equipmentTaxaId),
        ),
      toExcel: (cells) => {
        const parts = equipmentTerms.map((term) => {
          const demanda = equipmentDemandExcel(
            cells,
            term.demandIds,
            equipmentTaxaId,
          );
          return `(${demanda}*${requiredCell(cells, term.tsec)})/(60*(60+${requiredCell(cells, term.toi)}))`;
        });
        return `ROUNDUP(${parts.join("+")},0)`;
      },
    });
  }

  if (includeBelt) {
    const beltFlows =
      flows.length > 0
        ? flows.map((flow) => ({
            demanda: flow.demanda,
            toi: flow.toi,
            area: flow.area,
          }))
        : [
            {
              demanda: demandIds[0] ?? "demandaPico",
              toi: "tempoDeOcupacao" as ComponentParamId,
              area: "areaMinima" as FlowParamIds["area"],
            },
          ];
    const partials = beltFlows.flatMap((flow) => {
      const id = beltPartialResult(flow.area);
      return id ? [{ ...flow, id, suffix: beltSuffix(flow.area) }] : [];
    });
    if (beltFlows.length > 1 && partials.length === beltFlows.length) {
      for (const flow of partials) {
        const expression = beltTermDisplay(flow.suffix);
        formulas.push({
          id: flow.id,
          label:
            flow.suffix === "_d,int"
              ? "Comprimento mínimo da esteira · desembarque internacional (C_d,int)"
              : "Comprimento mínimo da esteira · desembarque doméstico (C_d,dom)",
          unit: "m",
          origem: expression,
          expression,
          evaluate: (inputs) => beltTermValue(inputs, flow.demanda, flow.toi),
          toExcel: (cells) => beltTermExcel(cells, flow.demanda, flow.toi),
        });
      }
    }
    const singleSuffix = beltSuffix(beltFlows[0]?.area ?? "areaMinima");
    const expression =
      beltFlows.length > 1 ? beltSumDisplay() : `C = ${beltTermRhs(singleSuffix)}`;
    formulas.push({
      id: "comprimentoMinimoEsteira",
      label: "Comprimento mínimo da esteira (C)",
      unit: "m",
      origem:
        "Manual de Anteprojeto. Comprimento mínimo da esteira de restituição de bagagens. Tr mínimo 30%; Lmp mínimo 0,9 m. Atende se o comprimento somado das esteiras for maior ou igual a C.",
      expression,
      evaluate: (inputs) =>
        beltFlows.reduce(
          (sum, flow) => sum + beltTermValue(inputs, flow.demanda, flow.toi),
          0,
        ),
      toExcel: (cells) =>
        beltFlows
          .map((flow) => beltTermExcel(cells, flow.demanda, flow.toi))
          .join("+"),
    });
  }

  return formulas;
}

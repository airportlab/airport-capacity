import type {
  ComponentParamId,
  ContractFormula,
  ExcelCellMap,
  ResolvedInputs,
} from "../types";
import type { FlowParamIds } from "./flowParams";
import { demandSum } from "./flowParams";
import {
  areaFormulaDisplay,
  dualAreaSumDisplay,
  equipmentFormulaDisplay,
  mixedAreaSumDisplay,
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
  };
  return labels[flow.area] ?? "Área mínima";
}

function flowAreaExpression(
  flow: FlowParamIds,
  companions: boolean,
  includeTaxa: boolean,
): string {
  const suffix = flow.area
    .replace("areaMinima", "")
    .replace("Embarque", "_e")
    .replace("Desembarque", "_d")
    .replace("Domestico", ",dom")
    .replace("Internacional", ",int");
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

export function capacityFormulas(copy: {
  usoRealLabel?: string;
  usoRealOrigem?: string;
  includeUsoReal?: boolean;
  includeArea?: boolean;
  includeEquipment?: boolean;
  includeSeats?: boolean;
  includeAreaTaxa?: boolean;
  includeEquipmentTaxa?: boolean;
  companions?: boolean;
  flows?: FlowParamIds[];
  demandIds?: ComponentParamId[];
}): ContractFormula[] {
  const includeUsoReal = copy.includeUsoReal ?? false;
  const includeArea = copy.includeArea ?? false;
  const includeEquipment = copy.includeEquipment ?? false;
  const includeSeats = copy.includeSeats ?? false;
  const includeAreaTaxa = copy.includeAreaTaxa ?? false;
  const includeEquipmentTaxa = copy.includeEquipmentTaxa ?? false;
  const companions = copy.companions ?? false;
  const flows = copy.flows ?? [];
  const demandIds = copy.demandIds ?? ["demandaPico"];
  const mixedNature = flows.some(
    (flow) =>
      flow.area.includes("Domestico") || flow.area.includes("Internacional"),
  );
  const areaTaxaId: ComponentParamId | null = includeAreaTaxa
    ? "taxaDeUsoArea"
    : null;
  const equipmentTaxaId: ComponentParamId | null = includeEquipmentTaxa
    ? "taxaDeUsoEquipamento"
    : null;
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
    const sumDisplay = mixedNature
      ? mixedAreaSumDisplay(flows.length)
      : dualAreaSumDisplay();
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
        ),
      toExcel: (cells) =>
        flows
          .map((flow) =>
            areaExcel(
              cells,
              flow.demanda,
              flow.emp,
              flow.toi,
              companions ? flow.va : undefined,
              areaTaxaId,
            ),
          )
          .join("+"),
    });
  } else if (includeArea) {
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
    const multi = demandIds.length > 1;
    formulas.push({
      id: "numeroMinimoEquipamentos",
      label: "Número mínimo de equipamentos",
      unit: "un",
      origem: multi
        ? "Número mínimo inteiro de equipamentos, arredondado para cima. A demanda no recinto é a soma dos DHp, sem fundi-los. Toi do equipamento em minutos; tsec em segundos."
        : `Número mínimo inteiro de equipamentos, arredondado para cima: ${equipmentFormulaDisplay(1, false, includeEquipmentTaxa)}. Toi do equipamento em minutos; tsec em segundos.`,
      expression: equipmentFormulaDisplay(
        demandIds.length,
        mixedNature,
        includeEquipmentTaxa,
      ),
      evaluate: (inputs) => {
        const denom = 60 * (60 + inputs.tempoOcupacaoEquipamento);
        if (denom === 0) return Number.NaN;
        return ceilCount(
          (demandSum(inputs, demandIds) *
            utilizationFactor(inputs, equipmentTaxaId) *
            inputs.tsec) /
            denom,
        );
      },
      toExcel: (cells) => {
        const demanda =
          demandIds.length === 1
            ? usedDemandExcel(cells, demandIds[0], equipmentTaxaId)
            : equipmentTaxaId && cells[equipmentTaxaId]
              ? `(${demandIds.map((id) => requiredCell(cells, id)).join("+")})*(${requiredCell(cells, equipmentTaxaId)}/100)`
              : `(${demandIds.map((id) => requiredCell(cells, id)).join("+")})`;
        return `ROUNDUP((${demanda}*${requiredCell(cells, "tsec")})/(60*(60+${requiredCell(cells, "tempoOcupacaoEquipamento")})),0)`;
      },
    });
  }

  return formulas;
}

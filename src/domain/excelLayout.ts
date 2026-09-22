import { defaultAirport, type AirportSource } from "./airports";
import { pmdMetrics, pmdRows } from "./pmd";
import { mixedSpecsForParams } from "./contracts/flowParams";
import {
  contractHasConnection,
  isMixedNatureContract,
} from "./contracts/factory";
import type {
  ComponentContract,
  ComponentId,
  ComponentParamId,
  ExcelCellMap,
  InputId,
  ResultId,
} from "./types";
import { hasEquipment, usesAreaTaxa, usesEquipmentTaxa } from "./types";

export const WORKBOOK_SHEET_NAME = "Dimensionamento";

export interface SizingExcelRow {
  pmdId: string;
  metricKey: string;
  row: number;
}

export interface SizingExcelLayout {
  headerRow: number;
  colHeaderRow: number;
  rows: SizingExcelRow[];
}

export interface ManualExcelLayout {
  headerRow: number;
  noteRow: number;
  colHeaderRow: number;
  rows: SizingExcelRow[];
}

export interface ComponentExcelLayout extends ExcelCellMap {
  titleRow: number;
  colHeaderRow: number;
  inputRows: Partial<Record<InputId, number>>;
  resultRows: Partial<Record<ResultId, number>>;
  notesRow: number;
  checkRow: number | null;
  localIds: ComponentParamId[];
  band: "even" | "odd";
}

export interface SummaryExcelLayout {
  titleRow: number;
  colHeaderRow: number;
  rows: Record<ComponentId, number>;
}

export interface ExcelHeaderLayout {
  nameRow: number;
  icaoRow: number;
  sourceRow: number;
  dateRow: number;
  noticeRow: number;
  summary: SummaryExcelLayout;
  sizing: SizingExcelLayout;
  manual: ManualExcelLayout;
}

export interface SingleSheetLayout extends ExcelHeaderLayout {
  sheetName: string;
  components: Record<ComponentId, ComponentExcelLayout>;
}

export interface NatureAreaRowLayout {
  row: number;
  inputs: ExcelCellMap["inputs"];
  results: ExcelCellMap["results"];
  statusCell: string;
}

export interface NatureEquipmentRowLayout {
  row: number;
  inputs: ExcelCellMap["inputs"];
  results: ExcelCellMap["results"];
  label?: string;
}

export interface NatureAreaBlockLayout {
  titleRow: number;
  noteRow: number;
  colHeaderRow: number;
  rows: Record<ComponentId, NatureAreaRowLayout>;
  flowRows: Record<ComponentId, NatureAreaRowLayout[]>;
}

export interface NatureEquipmentBlockLayout {
  titleRow: number;
  noteRow: number;
  colHeaderRow: number;
  rows: Record<ComponentId, NatureEquipmentRowLayout>;
  flowRows: Record<ComponentId, NatureEquipmentRowLayout[]>;
}

export interface NatureSheetLayout extends ExcelHeaderLayout {
  sheetName: string;
  area: NatureAreaBlockLayout | null;
  equipment: NatureEquipmentBlockLayout | null;
}

export const NATURE_SHEET_NAME = "Natureza";
export const NATURE_AREA_COLUMNS = 18;
export const NATURE_EQUIPMENT_COLUMNS = 9;

export const areaCheckContract = {
  id: "statusArea" as const,
  label: "Status da área",
  origem: "Compara a demanda em pax/h com a capacidade do requisito de área.",
  toExcel: (cells: ExcelCellMap) =>
    `IF(${cells.inputs.areaMedida}>=${cells.results.areaMinima},"Atende","Não atende")`,
};

function layoutPreamble(
  contracts: ComponentContract[],
  source: AirportSource = defaultAirport(),
): ExcelHeaderLayout & {
  row: number;
} {
  let row = 1;
  const nameRow = row;
  row += 1;
  const icaoRow = row;
  row += 1;
  const sourceRow = row;
  row += 1;
  const dateRow = row;
  row += 1;
  const noticeRow = row;
  row += 2;

  const summaryTitleRow = row;
  row += 1;
  const summaryColHeaderRow = row;
  row += 1;
  const summaryRows = {} as Record<ComponentId, number>;
  for (const contract of contracts) {
    summaryRows[contract.id] = row;
    row += 1;
  }
  row += 1;

  const sizingHeaderRow = row;
  row += 1;
  const sizingColHeaderRow = row;
  row += 1;
  const sizingRows: SizingExcelRow[] = [];
  for (const pmd of pmdRows(source)) {
    for (const metric of pmdMetrics(pmd)) {
      if (metric.key === "tsec") continue;
      sizingRows.push({
        pmdId: pmd.id,
        metricKey: metric.key,
        row,
      });
      row += 1;
    }
  }
  row += 1;

  const manualHeaderRow = row;
  row += 1;
  const manualNoteRow = row;
  row += 1;
  const manualColHeaderRow = row;
  row += 1;
  const manualRows: SizingExcelRow[] = [];
  for (const pmd of pmdRows(source)) {
    for (const metric of pmdMetrics(pmd)) {
      if (metric.key !== "tsec") continue;
      manualRows.push({
        pmdId: pmd.id,
        metricKey: metric.key,
        row,
      });
      row += 1;
    }
  }
  row += 1;

  return {
    row,
    nameRow,
    icaoRow,
    sourceRow,
    dateRow,
    noticeRow,
    summary: {
      titleRow: summaryTitleRow,
      colHeaderRow: summaryColHeaderRow,
      rows: summaryRows,
    },
    sizing: {
      headerRow: sizingHeaderRow,
      colHeaderRow: sizingColHeaderRow,
      rows: sizingRows,
    },
    manual: {
      headerRow: manualHeaderRow,
      noteRow: manualNoteRow,
      colHeaderRow: manualColHeaderRow,
      rows: manualRows,
    },
  };
}

export function getSingleSheetLayout(
  contracts: ComponentContract[],
  source: AirportSource = defaultAirport(),
): SingleSheetLayout {
  const preamble = layoutPreamble(contracts, source);
  let { row } = preamble;
  const components = {} as Record<ComponentId, ComponentExcelLayout>;
  contracts.forEach((contract, index) => {
    components[contract.id] = layoutComponent(contract, row, index);
    const last = components[contract.id];
    const resultRows = Object.values(last.resultRows);
    const end =
      last.checkRow ??
      (resultRows.length > 0 ? Math.max(...resultRows) : last.notesRow);
    row = end + 2;
  });

  return {
    sheetName: WORKBOOK_SHEET_NAME,
    nameRow: preamble.nameRow,
    icaoRow: preamble.icaoRow,
    sourceRow: preamble.sourceRow,
    dateRow: preamble.dateRow,
    noticeRow: preamble.noticeRow,
    summary: preamble.summary,
    sizing: preamble.sizing,
    manual: preamble.manual,
    components,
  };
}

function equipmentFlowLabel(toi: ComponentParamId): string {
  switch (toi) {
    case "tempoDeOcupacaoEmbarque":
      return "embarque";
    case "tempoDeOcupacaoDesembarque":
      return "desembarque";
    case "tempoDeOcupacaoEmbarqueDomestico":
      return "embarque doméstico";
    case "tempoDeOcupacaoEmbarqueInternacional":
      return "embarque internacional";
    case "tempoDeOcupacaoDesembarqueDomestico":
      return "desembarque doméstico";
    case "tempoDeOcupacaoDesembarqueInternacional":
      return "desembarque internacional";
    case "tempoDeOcupacaoDomestico":
      return "doméstico";
    case "tempoDeOcupacaoInternacional":
      return "internacional";
    default:
      return "fluxo";
  }
}

function connectionSizing(contract: ComponentContract): {
  emp: ComponentParamId;
  toi: ComponentParamId;
} {
  if (
    contract.params.some(
      (field) => field.id === "espacoMinimoPorPassageiroEmbarqueDomestico",
    )
  ) {
    return {
      emp: "espacoMinimoPorPassageiroEmbarqueDomestico",
      toi: "tempoDeOcupacaoEmbarqueDomestico",
    };
  }
  if (
    contract.params.some(
      (field) => field.id === "espacoMinimoPorPassageiroEmbarque",
    )
  ) {
    return {
      emp: "espacoMinimoPorPassageiroEmbarque",
      toi: "tempoDeOcupacaoEmbarque",
    };
  }
  return {
    emp: "espacoMinimoPorPassageiro",
    toi: "tempoDeOcupacao",
  };
}

function layoutConnectionAreaRow(
  contract: ComponentContract,
  r: number,
): NatureAreaRowLayout {
  const sizing = connectionSizing(contract);
  return {
    row: r,
    inputs: {
      demandaPicoConexao: `B${r}`,
      [sizing.emp]: `D${r}`,
      [sizing.toi]: `F${r}`,
      ...(usesAreaTaxa(contract.requirements)
        ? { taxaDeUsoArea: `R${r}` }
        : {}),
    },
    results: {
      areaMinimaConexao: `N${r}`,
    },
    statusCell: `P${r}`,
  };
}

export function getNatureSheetLayout(
  contracts: ComponentContract[],
  source: AirportSource = defaultAirport(),
): NatureSheetLayout {
  const preamble = layoutPreamble(contracts, source);
  let { row } = preamble;

  const areaContracts = contracts.filter((contract) => contract.requirements.area);
  let area: NatureAreaBlockLayout | null = null;
  if (areaContracts.length > 0) {
    const titleRow = row;
    row += 1;
    const noteRow = row;
    row += 1;
    const colHeaderRow = row;
    row += 1;
    const rows = {} as Record<ComponentId, NatureAreaRowLayout>;
    const flowRows = {} as Record<ComponentId, NatureAreaRowLayout[]>;
    for (const contract of areaContracts) {
      const mixed = isMixedNatureContract(contract);
      if (mixed) {
        const collected: NatureAreaRowLayout[] = [];
        const totalInputs: ExcelCellMap["inputs"] = {};
        const totalResults: ExcelCellMap["results"] = {};
        for (const spec of mixedSpecsForParams(contract.params)) {
          const r = row;
          totalInputs[spec.demanda] = `B${r}`;
          totalInputs[spec.emp] = `D${r}`;
          totalInputs[spec.toi] = `F${r}`;
          totalInputs[spec.va] = `G${r}`;
          totalResults[spec.area] = `N${r}`;
          collected.push({
            row: r,
            inputs: {
              [spec.demanda]: `B${r}`,
              [spec.emp]: `D${r}`,
              [spec.toi]: `F${r}`,
              [spec.va]: `G${r}`,
              ...(usesAreaTaxa(contract.requirements)
                ? { taxaDeUsoArea: `R${r}` }
                : {}),
            },
            results: {
              [spec.area]: `N${r}`,
            },
            statusCell: `P${r}`,
          });
          row += 1;
        }
        if (contractHasConnection(contract)) {
          const connectionRow = layoutConnectionAreaRow(contract, row);
          totalInputs.demandaPicoConexao = `B${row}`;
          totalResults.areaMinimaConexao = `N${row}`;
          collected.push(connectionRow);
          row += 1;
        }
        const totalRow = row;
        totalInputs.areaMedida = `K${totalRow}`;
        if (usesAreaTaxa(contract.requirements)) {
          totalInputs.taxaDeUsoArea = `R${totalRow}`;
        }
        totalResults.areaMinima = `N${totalRow}`;
        rows[contract.id] = {
          row: totalRow,
          inputs: totalInputs,
          results: totalResults,
          statusCell: `P${totalRow}`,
        };
        flowRows[contract.id] = collected;
        row += 1;
        continue;
      }
      const collected: NatureAreaRowLayout[] = [];
      if (contractHasConnection(contract)) {
        collected.push(layoutConnectionAreaRow(contract, row));
        row += 1;
      }
      const r = row;
      const connectionInputs = collected[0]?.inputs ?? {};
      rows[contract.id] = {
        row: r,
        inputs: {
          demandaPico: `B${r}`,
          demandaPicoEmbarque: `B${r}`,
          demandaPicoDesembarque: `C${r}`,
          demandaPicoConexao: connectionInputs.demandaPicoConexao,
          espacoMinimoPorPassageiro: `D${r}`,
          espacoMinimoPorPassageiroEmbarque: `D${r}`,
          tempoDeOcupacao: `F${r}`,
          tempoDeOcupacaoEmbarque: `F${r}`,
          va: `G${r}`,
          vaEmbarque: `G${r}`,
          percentualMinimoAssentos: `H${r}`,
          espacoMinimoPorPassageiroDesembarque: `I${r}`,
          tempoDeOcupacaoDesembarque: `J${r}`,
          vaDesembarque: `Q${r}`,
          ...(usesAreaTaxa(contract.requirements)
            ? { taxaDeUsoArea: `R${r}` }
            : {}),
          areaMedida: `K${r}`,
        },
        results: {
          areaMinimaEmbarque: `L${r}`,
          areaMinimaDesembarque: `M${r}`,
          areaMinimaConexao: collected[0]?.results.areaMinimaConexao,
          areaMinima: `N${r}`,
          assentosMinimos: `O${r}`,
        },
        statusCell: `P${r}`,
      };
      if (collected.length > 0) flowRows[contract.id] = collected;
      row += 1;
    }
    area = { titleRow, noteRow, colHeaderRow, rows, flowRows };
    row += 1;
  }

  const equipmentContracts = contracts.filter((contract) =>
    hasEquipment(contract.requirements),
  );
  let equipment: NatureEquipmentBlockLayout | null = null;
  if (equipmentContracts.length > 0) {
    const titleRow = row;
    row += 1;
    const noteRow = row;
    row += 1;
    const colHeaderRow = row;
    row += 1;
    const rows = {} as Record<ComponentId, NatureEquipmentRowLayout>;
    const equipmentFlowRows = {} as Record<
      ComponentId,
      NatureEquipmentRowLayout[]
    >;
    for (const contract of equipmentContracts) {
      const terms =
        contract.equipmentTerms && contract.equipmentTerms.length > 0
          ? contract.equipmentTerms
          : [
              {
                demandIds: ["demandaPico" as ComponentParamId],
                toi: "tempoDeOcupacao" as ComponentParamId,
                tsec: "tsec" as ComponentParamId,
              },
            ];
      const areaInputs = area?.rows[contract.id]?.inputs;
      const multi = terms.length > 1;
      const localFlows: NatureEquipmentRowLayout[] = [];
      const inputs: ExcelCellMap["inputs"] = {};
      if (multi) {
        for (const term of terms) {
          const fr = row;
          const primary = term.demandIds[0] ?? "demandaPico";
          const demandCell = areaInputs?.[primary] ?? `B${fr}`;
          const toiCell = areaInputs?.[term.toi] ?? `E${fr}`;
          const tsecCell = `D${fr}`;
          const flowInputs: ExcelCellMap["inputs"] = {
            [primary]: demandCell,
            [term.toi]: toiCell,
            [term.tsec]: tsecCell,
          };
          inputs[primary] = demandCell;
          inputs[term.toi] = toiCell;
          inputs[term.tsec] = tsecCell;
          const extra = term.demandIds[1];
          if (extra) {
            const extraCell = areaInputs?.[extra] ?? `C${fr}`;
            flowInputs[extra] = extraCell;
            inputs[extra] = extraCell;
          }
          localFlows.push({
            row: fr,
            inputs: flowInputs,
            results: {},
            label: equipmentFlowLabel(term.toi),
          });
          row += 1;
        }
      }
      const r = row;
      if (!multi) {
        inputs[terms[0]?.tsec ?? "tsec"] = `D${r}`;
      }
      if (usesEquipmentTaxa(contract.requirements)) {
        inputs.taxaDeUsoEquipamento = `I${r}`;
      }
      const mixedFlows = area?.flowRows[contract.id];
      const mixed = isMixedNatureContract(contract);
      const singleFunctionMixed = contract.params.some(
        (field) => field.id === "demandaPicoDomestico",
      );
      if (!multi) {
        if (mixed && mixedFlows && mixedFlows.length > 0) {
          mixedSpecsForParams(contract.params).forEach((spec, index) => {
            const cell = mixedFlows[index]?.inputs[spec.demanda];
            if (cell) inputs[spec.demanda] = cell;
          });
        } else if (mixed && singleFunctionMixed) {
          inputs.demandaPicoDomestico = `B${r}`;
          inputs.demandaPicoInternacional = `C${r}`;
        } else if (mixed) {
          inputs.demandaPicoEmbarqueDomestico = `B${r}`;
          inputs.demandaPicoEmbarqueInternacional = `C${r}`;
          if (
            contract.params.some(
              (field) => field.id === "demandaPicoDesembarqueDomestico",
            )
          ) {
            inputs.demandaPicoDesembarqueDomestico = `G${r}`;
            inputs.demandaPicoDesembarqueInternacional = `H${r}`;
          }
        } else {
          inputs.demandaPico = `B${r}`;
          inputs.demandaPicoEmbarque = `B${r}`;
          inputs.demandaPicoDesembarque = `C${r}`;
        }
        const connectionCell = mixedFlows?.find(
          (flow) => flow.inputs.demandaPicoConexao,
        )?.inputs.demandaPicoConexao;
        if (connectionCell) {
          inputs.demandaPicoConexao = connectionCell;
        } else if (contractHasConnection(contract)) {
          inputs.demandaPicoConexao = `G${r}`;
        }
        for (const term of terms) {
          inputs[term.toi] = areaInputs?.[term.toi] ?? `E${r}`;
        }
      }
      if (localFlows.length > 0) {
        equipmentFlowRows[contract.id] = localFlows;
      }
      rows[contract.id] = {
        row: r,
        inputs,
        results: {
          numeroMinimoEquipamentos: `F${r}`,
        },
      };
      row += 1;
    }
    equipment = {
      titleRow,
      noteRow,
      colHeaderRow,
      rows,
      flowRows: equipmentFlowRows,
    };
  }

  return {
    sheetName: NATURE_SHEET_NAME,
    nameRow: preamble.nameRow,
    icaoRow: preamble.icaoRow,
    sourceRow: preamble.sourceRow,
    dateRow: preamble.dateRow,
    noticeRow: preamble.noticeRow,
    summary: preamble.summary,
    sizing: preamble.sizing,
    manual: preamble.manual,
    area,
    equipment,
  };
}

function layoutComponent(
  contract: ComponentContract,
  startRow: number,
  index: number,
): ComponentExcelLayout {
  let row = startRow;
  const titleRow = row;
  row += 1;
  const colHeaderRow = row;
  row += 1;

  const inputRows: Partial<Record<InputId, number>> = {};
  const inputs: ExcelCellMap["inputs"] = {};

  const localIds = contract.params.map((field) => field.id);
  for (const id of localIds) {
    inputRows[id] = row;
    inputs[id] = `B${row}`;
    row += 1;
  }

  const notesRow = row;
  row += 2;

  const resultRows: Partial<Record<ResultId, number>> = {};
  const results: ExcelCellMap["results"] = {};
  for (const formula of contract.formulas) {
    resultRows[formula.id] = row;
    results[formula.id] = `B${row}`;
    row += 1;
  }

  const hasAreaCheck = Boolean(results.areaMinima) && Boolean(inputs.areaMedida);
  const checkRow = hasAreaCheck ? row : null;

  return {
    titleRow,
    colHeaderRow,
    inputs,
    results,
    inputRows,
    resultRows,
    notesRow,
    checkRow,
    localIds,
    band: index % 2 === 0 ? "even" : "odd",
  };
}

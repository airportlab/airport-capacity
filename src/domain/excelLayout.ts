import { defaultAirport, type AirportSource } from "./airports";
import { pmdMetrics, pmdRows } from "./pmd";
import { mixedSpecsForParams } from "./contracts/flowParams";
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

export interface ComponentExcelLayout extends ExcelCellMap {
  titleRow: number;
  colHeaderRow: number;
  inputRows: Partial<Record<InputId, number>>;
  resultRows: Partial<Record<ResultId, number>>;
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
      sizingRows.push({
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
      (resultRows.length > 0 ? Math.max(...resultRows) : last.colHeaderRow);
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
    components,
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
      const mixed = contract.params.some(
        (field) => field.id === "demandaPicoEmbarqueDomestico",
      );
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
      const r = row;
      rows[contract.id] = {
        row: r,
        inputs: {
          demandaPico: `B${r}`,
          demandaPicoEmbarque: `B${r}`,
          demandaPicoDesembarque: `C${r}`,
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
          areaMinima: `N${r}`,
          assentosMinimos: `O${r}`,
        },
        statusCell: `P${r}`,
      };
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
    for (const contract of equipmentContracts) {
      const r = row;
      const mixedFlows = area?.flowRows[contract.id];
      const inputs: ExcelCellMap["inputs"] = {
        tsec: `D${r}`,
        tempoOcupacaoEquipamento: `E${r}`,
        ...(usesEquipmentTaxa(contract.requirements)
          ? { taxaDeUsoEquipamento: `I${r}` }
          : {}),
      };
      if (mixedFlows && mixedFlows.length > 0) {
        mixedSpecsForParams(contract.params).forEach((spec, index) => {
          const cell = mixedFlows[index]?.inputs[spec.demanda];
          if (cell) inputs[spec.demanda] = cell;
        });
      } else if (
        contract.params.some((field) => field.id === "demandaPicoEmbarqueDomestico")
      ) {
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
      rows[contract.id] = {
        row: r,
        inputs,
        results: {
          numeroMinimoEquipamentos: `F${r}`,
        },
      };
      row += 1;
    }
    equipment = { titleRow, noteRow, colHeaderRow, rows };
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

  row += 1;

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
    checkRow,
    localIds,
    band: index % 2 === 0 ? "even" : "odd",
  };
}

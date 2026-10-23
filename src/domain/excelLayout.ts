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
import {
  ARRIVALS_CONNECTION_CATALOG,
  BOARDING_CONNECTION_CATALOG,
  salaBeltPartialId,
  hasEquipment,
  hasEsteira,
  usesEquipmentTaxa,
  usesEsteiraTaxa,
} from "./types";

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
  beltCheckRow: number | null;
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

export interface NatureBeltBlockLayout {
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
  belt: NatureBeltBlockLayout | null;
}

export const NATURE_SHEET_NAME = "Natureza";
export const NATURE_AREA_COLUMNS = 21;
export const NATURE_EQUIPMENT_COLUMNS = 9;
export const NATURE_BELT_COLUMNS = 9;

export const areaCheckContract = {
  id: "statusArea" as const,
  label: "Status da área",
  origem: "Compara a demanda em pax/h com a capacidade do requisito de área.",
  toExcel: (cells: ExcelCellMap) =>
    `IF(${cells.inputs.areaMedida}>=${cells.results.areaMinima},"Atende","Não atende")`,
};

export const beltCheckContract = {
  id: "statusEsteira" as const,
  label: "Status da esteira",
  origem:
    "Compara o comprimento somado das esteiras com o comprimento mínimo C.",
  toExcel: (cells: ExcelCellMap) =>
    `IF(${cells.inputs.comprimentoEsteiras}>=${cells.results.comprimentoMinimoEsteira},"Atende","Não atende")`,
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
      last.beltCheckRow ??
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

function boardingConnectionRows(contract: ComponentContract) {
  return BOARDING_CONNECTION_CATALOG.filter((spec) =>
    contract.params.some((field) => field.id === spec.demanda),
  );
}

function boardingOnlyMixed(contract: ComponentContract): boolean {
  const ids = new Set(contract.params.map((field) => field.id));
  return (
    ids.has("espacoMinimoPorPassageiroEmbarqueInternacional") &&
    !ids.has("espacoMinimoPorPassageiroDesembarqueDomestico")
  );
}

function boardingConnectionColumn(
  contract: ComponentContract,
  pair: (typeof BOARDING_CONNECTION_CATALOG)[number]["pair"],
): { emp: ComponentParamId; toi: ComponentParamId } {
  if (boardingOnlyMixed(contract) && (pair === "domInt" || pair === "intInt")) {
    return {
      emp: "espacoMinimoPorPassageiroEmbarqueInternacional",
      toi: "tempoDeOcupacaoEmbarqueInternacional",
    };
  }
  return connectionSizing(contract);
}

function layoutConnectionAreaRow(
  contract: ComponentContract,
  r: number,
  demanda: ComponentParamId,
  area: ResultId,
  empCell?: string,
  toiCell?: string,
  column?: { emp: ComponentParamId; toi: ComponentParamId },
): NatureAreaRowLayout {
  const sizing = column ?? connectionSizing(contract);
  return {
    row: r,
    inputs: {
      [demanda]: `B${r}`,
      [sizing.emp]: empCell ?? `D${r}`,
      [sizing.toi]: toiCell ?? `F${r}`,
    },
    results: {
      [area]: `N${r}`,
    },
    statusCell: `P${r}`,
  };
}

function beltTermsOf(contract: ComponentContract): {
  demanda: ComponentParamId;
  toi: ComponentParamId;
  partial: ResultId | null;
  label: string;
}[] {
  const demanda: ComponentParamId = contract.params.some(
    (field) => field.id === "demandaPicoDesembarque",
  )
    ? "demandaPicoDesembarque"
    : "demandaPico";
  const toi: ComponentParamId = contract.params.some(
    (field) => field.id === "tempoDeOcupacaoDesembarque",
  )
    ? "tempoDeOcupacaoDesembarque"
    : "tempoDeOcupacao";
  const arrivals = ARRIVALS_CONNECTION_CATALOG.filter((spec) =>
    contract.params.some((field) => field.id === spec.demanda),
  );
  if (arrivals.length === 0) {
    return [{ demanda, toi, partial: null, label: contract.title }];
  }
  return [
    {
      demanda,
      toi,
      partial: "comprimentoMinimoDesembarque" as ResultId,
      label: contract.title,
    },
    ...arrivals.map((spec) => ({
      demanda: spec.demanda,
      toi: contract.params.some((field) => field.id === spec.toi)
        ? spec.toi
        : toi,
      partial: salaBeltPartialId(spec.pair),
      label: `${contract.title} · conexão ${spec.label}`,
    })),
  ];
}

function layoutBeltBlock(
  contracts: ComponentContract[],
  area: NatureAreaBlockLayout | null,
  startRow: number,
): { belt: NatureBeltBlockLayout | null; row: number } {
  const beltContracts = contracts.filter((contract) =>
    hasEsteira(contract.requirements),
  );
  if (beltContracts.length === 0) return { belt: null, row: startRow };
  let row = startRow;
  const titleRow = row;
  row += 1;
  const noteRow = row;
  row += 1;
  const colHeaderRow = row;
  row += 1;
  const rows = {} as Record<ComponentId, NatureEquipmentRowLayout>;
  const flowRows = {} as Record<ComponentId, NatureEquipmentRowLayout[]>;
  for (const contract of beltContracts) {
    const terms = beltTermsOf(contract);
    const areaInputs = area?.rows[contract.id]?.inputs;
    const multi = terms.length > 1;
    const localFlows: NatureEquipmentRowLayout[] = [];
    const totalRow = row + (multi ? terms.length : 0);
    if (multi) {
      for (const term of terms) {
        const fr = row;
        const flowInputs: ExcelCellMap["inputs"] = {
          [term.demanda]: areaInputs?.[term.demanda] ?? `B${fr}`,
          [term.toi]: areaInputs?.[term.toi] ?? `F${fr}`,
          taxaRetiradaBagagem: `D${totalRow}`,
          comprimentoLinearPassageiro: `E${totalRow}`,
          ...(usesEsteiraTaxa(contract.requirements)
            ? { taxaDeUsoEsteira: `C${totalRow}` }
            : {}),
        };
        localFlows.push({
          row: fr,
          label: term.label,
          inputs: flowInputs,
          results: term.partial ? { [term.partial]: `G${fr}` } : {},
        });
        row += 1;
      }
    }
    const r = row;
    const inputs: ExcelCellMap["inputs"] = {
      ...(usesEsteiraTaxa(contract.requirements)
        ? { taxaDeUsoEsteira: `C${r}` }
        : {}),
      taxaRetiradaBagagem: `D${r}`,
      comprimentoLinearPassageiro: `E${r}`,
      comprimentoEsteiras: `H${r}`,
    };
    if (multi) {
      for (const flow of localFlows) Object.assign(inputs, flow.inputs);
    } else {
      const term = terms[0];
      if (term) {
        inputs[term.demanda] = areaInputs?.[term.demanda] ?? `B${r}`;
        inputs[term.toi] = areaInputs?.[term.toi] ?? `F${r}`;
      }
    }
    rows[contract.id] = {
      row: r,
      inputs,
      results: { comprimentoMinimoEsteira: `G${r}` },
    };
    if (localFlows.length > 0) flowRows[contract.id] = localFlows;
    row += 1;
  }
  return {
    belt: { titleRow, noteRow, colHeaderRow, rows, flowRows },
    row: row + 1,
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
            },
            results: {
              [spec.area]: `N${r}`,
            },
            statusCell: `P${r}`,
          });
          row += 1;
        }
        const arrivalsConnections = ARRIVALS_CONNECTION_CATALOG.filter((spec) =>
          contract.params.some((field) => field.id === spec.demanda),
        );
        if (arrivalsConnections.length > 0) {
          for (const spec of arrivalsConnections) {
            const r = row;
            totalInputs[spec.demanda] = `B${r}`;
            totalResults[spec.area] = `N${r}`;
            collected.push({
              row: r,
              inputs: {
                [spec.demanda]: `B${r}`,
                [spec.emp]: totalInputs[spec.emp] ?? `D${r}`,
                [spec.toi]: totalInputs[spec.toi] ?? `F${r}`,
              },
              results: {
                [spec.area]: `N${r}`,
              },
              statusCell: `P${r}`,
            });
            row += 1;
          }
        } else if (contractHasConnection(contract)) {
          for (const spec of boardingConnectionRows(contract)) {
            const column = boardingConnectionColumn(contract, spec.pair);
            const connectionRow = layoutConnectionAreaRow(
              contract,
              row,
              spec.demanda,
              spec.area,
              totalInputs[column.emp],
              totalInputs[column.toi],
              column,
            );
            totalInputs[spec.demanda] = `B${row}`;
            totalResults[spec.area] = `N${row}`;
            collected.push(connectionRow);
            row += 1;
          }
        }
        const totalRow = row;
        totalInputs.areaMedida = `K${totalRow}`;
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
      const connectionInputs: ExcelCellMap["inputs"] = {};
      const connectionResults: ExcelCellMap["results"] = {};
      if (contractHasConnection(contract)) {
        for (const spec of boardingConnectionRows(contract)) {
          collected.push(
            layoutConnectionAreaRow(contract, row, spec.demanda, spec.area),
          );
          connectionInputs[spec.demanda] = `B${row}`;
          connectionResults[spec.area] = `N${row}`;
          row += 1;
        }
      }
      const arrivalSpecs = ARRIVALS_CONNECTION_CATALOG.filter((spec) =>
        contract.params.some((field) => field.id === spec.demanda),
      );
      if (arrivalSpecs.length > 0) {
        const hallRow = row + arrivalSpecs.length;
        const sharedCells = new Map<string, { emp: string; toi: string }>();
        const hallEmpId = contract.params.some(
          (field) => field.id === "espacoMinimoPorPassageiroDesembarque",
        )
          ? "espacoMinimoPorPassageiroDesembarque"
          : "espacoMinimoPorPassageiro";
        const hallToiId = contract.params.some(
          (field) => field.id === "tempoDeOcupacaoDesembarque",
        )
          ? "tempoDeOcupacaoDesembarque"
          : "tempoDeOcupacao";
        const salaColumn = contract.params.some(
          (field) =>
            field.label === "Emp · coluna doméstica" ||
            field.label === "Emp · coluna internacional",
        );
        for (const spec of arrivalSpecs) {
          const columnEmp = spec.emp;
          const columnToi = spec.toi;
          const foreignEmp =
            salaColumn &&
            contract.params.some((field) => field.id === columnEmp);
          const foreignToi =
            salaColumn &&
            contract.params.some((field) => field.id === columnToi);
          const empId = foreignEmp ? columnEmp : hallEmpId;
          const toiId = foreignToi ? columnToi : hallToiId;
          const key = `${empId}|${toiId}`;
          let cells = sharedCells.get(key);
          if (!cells) {
            cells = {
              emp: foreignEmp
                ? `D${row}`
                : empId === "espacoMinimoPorPassageiroDesembarque"
                  ? `I${hallRow}`
                  : `D${hallRow}`,
              toi: foreignToi
                ? `F${row}`
                : toiId === "tempoDeOcupacaoDesembarque"
                  ? `J${hallRow}`
                  : `F${hallRow}`,
            };
            sharedCells.set(key, cells);
          }
          collected.push({
            row,
            inputs: {
              [spec.demanda]: `B${row}`,
              [empId]: cells.emp,
              [toiId]: cells.toi,
            },
            results: { [spec.area]: `N${row}` },
            statusCell: `P${row}`,
          });
          connectionInputs[spec.demanda] = `B${row}`;
          connectionInputs[empId] = cells.emp;
          connectionInputs[toiId] = cells.toi;
          connectionResults[spec.area] = `N${row}`;
          row += 1;
        }
      }
      const r = row;
      rows[contract.id] = {
        row: r,
        inputs: {
          demandaPico: `B${r}`,
          demandaPicoEmbarque: `B${r}`,
          demandaPicoDesembarque: `C${r}`,
          ...connectionInputs,
          espacoMinimoPorPassageiro: `D${r}`,
          espacoMinimoPorPassageiroEmbarque: `D${r}`,
          tempoDeOcupacao: `F${r}`,
          tempoDeOcupacaoEmbarque: `F${r}`,
          va: `G${r}`,
          vaEmbarque: `G${r}`,
          percentualMinimoAssentos: `H${r}`,
          espacoMinimoEmPe: `S${r}`,
          tempoDeOcupacaoEmPe: `T${r}`,
          percentualOcupacaoMaxima: `U${r}`,
          espacoMinimoPorPassageiroDesembarque: `I${r}`,
          tempoDeOcupacaoDesembarque: `J${r}`,
          vaDesembarque: `Q${r}`,
          areaMedida: `K${r}`,
        },
        results: {
          areaMinimaEmbarque: `L${r}`,
          areaMinimaDesembarque: `M${r}`,
          ...connectionResults,
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
          if (term.taxa) {
            flowInputs[term.taxa] = `I${fr}`;
            inputs[term.taxa] = `I${fr}`;
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
      const splitTaxa = terms.some((term) => term.taxa);
      if (usesEquipmentTaxa(contract.requirements) && !splitTaxa) {
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
        for (const spec of BOARDING_CONNECTION_CATALOG) {
          const connectionCell = mixedFlows?.find(
            (flow) => flow.inputs[spec.demanda],
          )?.inputs[spec.demanda];
          if (connectionCell) inputs[spec.demanda] = connectionCell;
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

  const laidBelt = layoutBeltBlock(contracts, area, row);
  const belt = laidBelt.belt;
  row = laidBelt.row;

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
    belt,
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
  let cursor = row;
  const checkRow = hasAreaCheck ? cursor : null;
  if (hasAreaCheck) cursor += 1;
  const hasBeltCheck =
    Boolean(results.comprimentoMinimoEsteira) &&
    Boolean(inputs.comprimentoEsteiras);
  const beltCheckRow = hasBeltCheck ? cursor : null;

  return {
    titleRow,
    colHeaderRow,
    inputs,
    results,
    inputRows,
    resultRows,
    notesRow,
    checkRow,
    beltCheckRow,
    localIds,
    band: index % 2 === 0 ? "even" : "odd",
  };
}

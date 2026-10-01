import ExcelJS from "exceljs";
import { defaultAirport, type AirportSource } from "../domain/airports";
import {
  WIDTH_FLOOR_M,
  circulationWidths,
  type CirculationWidths,
  type HorizontalCirculation,
} from "../domain/circulation";
import { isSizingParam, isTsecParam, pickFields } from "../domain/contracts/fields";
import { pmdValueFor, resolvedSources, standardTsecForParam } from "../domain/pmd";
import { tsecDeviationNote } from "./tsecNote";
import {
  identityParamIds,
  MIXED_FLOW_SPECS,
  mixedFlowLabel,
} from "../domain/contracts/flowParams";
import {
  COMPONENT_PARAM_IDS,
  type ComponentContract,
  type ComponentId,
  type ComponentJustificativas,
  type ComponentParamId,
  type Evaluation,
  type ExcelCellMap,
  type RegistryEntry,
} from "../domain/types";
import { journeyRank } from "../domain/templates/organs";
import { downloadBlob, stampFilename } from "./download";

const INK = "FF1C2430";
const SLATE = "FF2F4A63";
const SAND = "FFE4E6EA";
const SECTION = "FFC8CDD4";
const STRIPE = "FFEEF0F2";
const PAPER = "FFFFFFFF";
const MEETS_GREEN = "FFE5F3EA";
const MEETS_RED = "FFFDE8E4";

const THIN: ExcelJS.Border = {
  style: "thin",
  color: { argb: INK },
};

const BOX: Partial<ExcelJS.Borders> = {
  top: THIN,
  left: THIN,
  bottom: THIN,
  right: THIN,
};

const PAGE_START = 2;
const PAGE_END = 7;
const MODELO_SHEET_NAME = "Modelo";
const POR_COMPONENTE_SHEET_NAME = "Por componente";
const MARK_OK = "✓";
const MARK_FAIL = "X";
const MARK_NA = "—";
const PAINEL_NAME_WIDTH = 28;
const PAINEL_DHP_WIDTH = 32;
const MEMORY_END = 9;
const MEMORY_COLUMN_WIDTHS = [3, 42, 14, 28, 12, 16, 14, 14, 12];
const MODELO_COLUMN_WIDTHS = [3, 6, 38, 26, 14, 13, 8];
const MODELO_NAME_WIDTH = MODELO_COLUMN_WIDTHS[2];
const MODELO_PARAM_WIDTH = MODELO_COLUMN_WIDTHS[3];
const MODELO_BOX_WIDTH = MODELO_COLUMN_WIDTHS.slice(PAGE_START - 1, PAGE_END).reduce(
  (sum, width) => sum + width,
  0,
);
const LINE_HEIGHT = 16;
const MIN_ROW_HEIGHT = LINE_HEIGHT;

export interface ModeloExcelModel {
  airport?: AirportSource;
  generatedAt: Date;
  registry: RegistryEntry[];
  contracts: ComponentContract[];
  evaluations: Record<ComponentId, Evaluation>;
  circulations: HorizontalCirculation[];
  componentOrigens?: Record<ComponentId, Record<ComponentParamId, string>>;
  justificativas?: Record<ComponentId, ComponentJustificativas>;
  airportName?: string;
}

function paramsTouched(
  formula: { toExcel: (cells: ExcelCellMap["inputs"]) => string },
): ComponentParamId[] {
  const seen: ComponentParamId[] = [];
  const cells = new Proxy({} as ExcelCellMap["inputs"], {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      if (!(COMPONENT_PARAM_IDS as readonly string[]).includes(prop)) return undefined;
      const id = prop as ComponentParamId;
      if (!seen.includes(id)) seen.push(id);
      return "1";
    },
  });
  formula.toExcel(cells);
  return seen;
}

function writeFormula(
  cell: ExcelJS.Cell,
  formula: string,
  result: number | string,
  numFmt?: string,
): void {
  cell.value = { formula, result };
  if (numFmt) cell.numFmt = numFmt;
}

function equipmentLoad(excel: string): string | null {
  const loads: string[] = [];
  let index = 0;
  while (index < excel.length) {
    while (excel[index] === "+") index += 1;
    if (index >= excel.length) break;
    const head = "ROUNDUP(";
    if (!excel.startsWith(head, index)) return null;
    index += head.length;
    const start = index;
    let depth = 1;
    let exprEnd = -1;
    while (index < excel.length && depth > 0) {
      if (excel.startsWith(",0)", index) && depth === 1) {
        exprEnd = index;
        index += 3;
        depth = 0;
        break;
      }
      if (excel[index] === "(") depth += 1;
      else if (excel[index] === ")") depth -= 1;
      index += 1;
    }
    if (exprEnd < 0) return null;
    loads.push(excel.slice(start, exprEnd));
  }
  if (loads.length === 0) return null;
  return loads.join("+");
}

function isEquipmentCountFormula(id: string): boolean {
  return (
    id === "numeroMinimoEquipamentos" ||
    id === "numeroMinimoEquipamentosDomestico" ||
    id === "numeroMinimoEquipamentosInternacional"
  );
}

type ParamLine = {
  componentId: ComponentId;
  refId: number;
  title: string;
  paramId: ComponentParamId;
  value: number;
};

type PendingAccount = {
  componentId: ComponentId;
  row: number;
  formula: ComponentContract["formulas"][number];
  inputs: Evaluation["inputs"];
  result: number;
  saturacao: number | null;
  resultColumn?: number;
  saturationColumn?: number;
  verifiedAddress?: string;
};

function collectParamLines(
  indexed: {
    contract: ComponentContract;
    entry?: RegistryEntry;
    id: number;
  }[],
  evaluations: ModeloExcelModel["evaluations"],
): { pmd: ParamLine[]; other: ParamLine[] } {
  const lines: ParamLine[] = [];
  for (const item of indexed) {
    const evaluation = evaluations[item.contract.id];
    if (!evaluation || !item.entry) continue;
    const wanted = new Set<string>();
    if (item.entry.requirements.area) wanted.add("areaMinima");
    if (item.entry.requirements.equipment) wanted.add("numeroMinimoEquipamentos");
    const seen = new Set<ComponentParamId>();
    for (const formula of item.contract.formulas) {
      if (!wanted.has(formula.id)) continue;
      for (const id of paramsTouched(formula)) seen.add(id);
    }
    for (const paramId of COMPONENT_PARAM_IDS) {
      if (!seen.has(paramId) || paramId.startsWith("demanda")) continue;
      const raw = evaluation.inputs[paramId];
      lines.push({
        componentId: item.contract.id,
        refId: item.id,
        title: item.contract.title,
        paramId,
        value: Number.isFinite(raw) ? raw : 0,
      });
    }
  }
  return {
    pmd: lines.filter((line) => isSizingParam(line.paramId)),
    other: lines.filter((line) => !isSizingParam(line.paramId)),
  };
}

function writeParamBlock(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  title: string,
  lines: ParamLine[],
  addresses: Map<string, string>,
): number {
  rowNumber = sectionTitle(sheet, rowNumber, title);
  const head = sheet.getRow(rowNumber);
  head.getCell(2).value = "REF";
  head.getCell(3).value = "COMPONENTE OPERACIONAL";
  head.getCell(4).value = "PARÂMETRO";
  head.getCell(5).value = "VALOR";
  head.getCell(6).value = "UNIDADE";
  sheet.mergeCells(rowNumber, 6, rowNumber, 7);
  band(head, PAGE_START, PAGE_END, "header");
  head.height = fittedHeaderHeight([
    ["REF", MODELO_COLUMN_WIDTHS[1]],
    ["COMPONENTE OPERACIONAL", MODELO_NAME_WIDTH],
    ["PARÂMETRO", MODELO_PARAM_WIDTH],
    ["VALOR", MODELO_COLUMN_WIDTHS[4]],
    ["UNIDADE", MODELO_COLUMN_WIDTHS[5] + MODELO_COLUMN_WIDTHS[6]],
  ]);
  rowNumber += 1;
  for (const [index, line] of lines.entries()) {
    const row = sheet.getRow(rowNumber);
    const field = pickFields([line.paramId])[0];
    row.getCell(2).value = line.refId;
    row.getCell(3).value = line.title;
    row.getCell(4).value = field.label;
    const value = row.getCell(5);
    value.value = line.value;
    value.numFmt = line.paramId.startsWith("demanda") ? "#,##0" : "#,##0.00";
    row.getCell(6).value = field.unit;
    sheet.mergeCells(rowNumber, 6, rowNumber, 7);
    band(row, PAGE_START, PAGE_END, "data", index % 2 === 0);
    row.getCell(3).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    row.getCell(4).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    row.height = Math.max(
      fittedRowHeight(line.title, MODELO_NAME_WIDTH),
      fittedRowHeight(field.label, MODELO_PARAM_WIDTH),
    );
    addresses.set(`${line.componentId}|${line.paramId}`, `E${rowNumber}`);
    rowNumber += 1;
  }
  return rowNumber;
}

function applyAccounts(
  sheet: ExcelJS.Worksheet,
  pending: PendingAccount[],
  addresses: Map<string, string>,
): void {
  for (const item of pending) {
    const cells = new Proxy({} as ExcelCellMap["inputs"], {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        const address = addresses.get(`${item.componentId}|${prop}`);
        if (address) return address;
        if (!prop.startsWith("demanda")) return undefined;
        const value = item.inputs[prop as ComponentParamId];
        return Number.isFinite(value) ? String(value) : "0";
      },
    });
    const excel = item.formula.toExcel(cells);
    writeFormula(
      sheet.getRow(item.row).getCell(item.resultColumn ?? 5),
      excel,
      item.result,
      isEquipmentCountFormula(item.formula.id) ? "#,##0" : "#,##0.00",
    );
    if (item.formula.id !== "numeroMinimoEquipamentos" || item.saturacao === null) {
      continue;
    }
    const load = equipmentLoad(excel);
    if (!load) continue;
    writeFormula(
      sheet.getRow(item.row).getCell(item.saturationColumn ?? 6),
      `(${load})/${item.verifiedAddress ?? `D${item.row}`}`,
      item.saturacao / 100,
      "0%",
    );
  }
}

function paintMeets(
  sheet: ExcelJS.Worksheet,
  firstRow: number,
  lastRow: number,
  priority: number,
  column = "G",
): void {
  if (firstRow === 0) return;
  const first = `${column}${firstRow}`;
  sheet.addConditionalFormatting({
    ref: `${first}:${column}${lastRow}`,
    rules: [
      {
        type: "expression",
        priority,
        formulae: [`${first}="SIM"`],
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: { argb: MEETS_GREEN },
          },
        },
      },
      {
        type: "expression",
        priority: priority + 1,
        formulae: [`${first}="NÃO"`],
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: { argb: MEETS_RED },
          },
        },
      },
    ],
  });
}

function formatReportDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function flowLabel(id: ComponentParamId): string {
  const spec = MIXED_FLOW_SPECS.find((item) => item.demanda === id);
  if (spec) return mixedFlowLabel(spec);
  switch (id) {
    case "demandaPicoEmbarque":
      return "embarque";
    case "demandaPicoDesembarque":
      return "desembarque";
    case "demandaPicoConexao":
      return "embarque via conexão";
    case "demandaPicoConexaoDesembarqueDomestico":
      return "conexão DOM/INT";
    case "demandaPicoConexaoDesembarqueInternacional":
      return "conexão INT/DOM + INT/INT";
    default:
      return id;
  }
}

function band(
  row: ExcelJS.Row,
  from: number,
  to: number,
  kind: "blue" | "section" | "header" | "data",
  striped = false,
): void {
  for (let column = from; column <= to; column += 1) {
    const cell = row.getCell(column);
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = BOX;
    if (kind === "blue") {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: SLATE },
      };
      cell.font = { bold: true, color: { argb: PAPER } };
    } else if (kind === "header" || kind === "section") {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: kind === "section" ? SECTION : SAND },
      };
      cell.font = { bold: true, color: { argb: INK } };
    } else if (striped) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: STRIPE },
      };
      cell.font = { color: { argb: INK } };
    } else {
      cell.font = { color: { argb: INK } };
    }
  }
}

function label(cell: ExcelJS.Cell, text: string): void {
  cell.value = text;
  cell.font = { bold: true };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

const A4_MARGINS = {
  left: 0.47,
  right: 0.47,
  top: 0.47,
  bottom: 0.47,
  header: 0.24,
  footer: 0.24,
};

function fitReportPage(
  sheet: ExcelJS.Worksheet,
  lastColumn: string,
  lastRow: number,
  repeatRows?: string,
): void {
  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: A4_MARGINS,
    printArea: `A1:${lastColumn}${Math.max(lastRow, 1)}`,
  };
  if (repeatRows) sheet.pageSetup.printTitlesRow = repeatRows;
}

function sectionTitle(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  text: string,
  end = PAGE_END,
): number {
  const row = sheet.getRow(rowNumber);
  row.getCell(2).value = text;
  row.getCell(2).font = { bold: true };
  row.getCell(2).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  sheet.mergeCells(rowNumber, PAGE_START, rowNumber, end);
  band(row, PAGE_START, end, "section");
  row.getCell(PAGE_START).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  return rowNumber + 1;
}

function blankValue(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  text: string,
  striped: boolean,
): number {
  const row = sheet.getRow(rowNumber);
  row.getCell(PAGE_START).value = text;
  row.getCell(PAGE_END).value = null;
  sheet.mergeCells(rowNumber, PAGE_START, rowNumber, PAGE_END - 1);
  band(row, PAGE_START, PAGE_END, "data", striped);
  row.getCell(PAGE_START).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  return rowNumber + 1;
}

function blankNote(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  end = PAGE_END,
): number {
  const row = sheet.getRow(rowNumber);
  row.getCell(2).value = null;
  sheet.mergeCells(rowNumber, PAGE_START, rowNumber, end);
  row.height = 36;
  band(row, PAGE_START, end, "data", false);
  return rowNumber + 1;
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function identificationObservationsText(
  items: { entry?: RegistryEntry; id: number }[],
): string {
  return items
    .flatMap((item) => {
      const note = item.entry?.observacoes?.trim() ?? "";
      return note ? [`${item.id}. ${note}`] : [];
    })
    .join("\n");
}

function sectionDeviationSentence(
  refId: number,
  componentId: ComponentId,
  entry: RegistryEntry,
  paramId: ComponentParamId,
  value: number,
  airport: AirportSource,
  model: ModeloExcelModel,
  manual: boolean,
): string | null {
  const field = pickFields([paramId])[0];
  if (isSizingParam(paramId)) {
    const ref = resolvedSources(entry)[paramId];
    if (!ref) return null;
    const absorbed = pmdValueFor(ref, paramId, airport);
    if (absorbed == null || Math.abs(value - absorbed) < 1e-9) return null;
    const just = model.justificativas?.[componentId]?.[paramId]?.trim() ?? "";
    const sentence = `${refId}. ${field.label}: ${formatQuantity(value)} ${field.unit} (PMD ${formatQuantity(absorbed)}).`;
    return just ? `${sentence} ${just}` : sentence;
  }
  if (!manual || !isTsecParam(paramId)) return null;
  const standard = standardTsecForParam(entry, paramId);
  if (standard == null || Math.abs(value - standard) < 1e-9) return null;
  const just = model.justificativas?.[componentId]?.[paramId]?.trim() ?? "";
  return `${refId}. ${tsecDeviationNote(standard, value, just)}`;
}

function requirementObservationsText(
  items: {
    contract: ComponentContract;
    entry?: RegistryEntry;
    id: number;
  }[],
  formulaIds: readonly ("areaMinima" | "assentosMinimos" | "numeroMinimoEquipamentos")[],
  model: ModeloExcelModel,
  manual: boolean,
): string {
  const airport = model.airport ?? defaultAirport();
  const wanted = new Set<string>(formulaIds);
  const generated: string[] = [];
  for (const item of items) {
    const formulas = item.contract.formulas.filter((entry) => wanted.has(entry.id));
    const evaluation = model.evaluations[item.contract.id];
    if (formulas.length > 0 && evaluation && item.entry) {
      const touched = new Set(formulas.flatMap((formula) => paramsTouched(formula)));
      for (const paramId of COMPONENT_PARAM_IDS) {
        if (!touched.has(paramId) || paramId.startsWith("demanda")) continue;
        const value = evaluation.inputs[paramId];
        if (!Number.isFinite(value)) continue;
        const sentence = sectionDeviationSentence(
          item.id,
          item.contract.id,
          item.entry,
          paramId,
          value,
          airport,
          model,
          manual,
        );
        if (sentence) generated.push(sentence);
      }
    }
  }
  return generated.join("\n");
}

function pmdObservationNote(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  text: string,
  end = PAGE_END,
): number {
  if (!text) return blankNote(sheet, rowNumber, end);
  const row = sheet.getRow(rowNumber);
  row.getCell(PAGE_START).value = text;
  sheet.mergeCells(rowNumber, PAGE_START, rowNumber, end);
  band(row, PAGE_START, end, "data", false);
  row.getCell(PAGE_START).alignment = {
    horizontal: "left",
    vertical: "top",
    wrapText: true,
  };
  row.height = observationRowHeight(text);
  return rowNumber + 1;
}

function flowGrid(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  labels: [string, string, string, string] | null,
  striped = false,
): void {
  const row = sheet.getRow(rowNumber);
  sheet.mergeCells(rowNumber, 2, rowNumber, 3);
  sheet.mergeCells(rowNumber, 6, rowNumber, 7);
  if (labels) {
    row.getCell(2).value = labels[0];
    row.getCell(4).value = labels[1];
    row.getCell(5).value = labels[2];
    row.getCell(6).value = labels[3];
    band(row, PAGE_START, PAGE_END, "header");
    return;
  }
  band(row, PAGE_START, PAGE_END, "data", striped);
}

function liftGrid(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  header: boolean,
  striped = false,
): void {
  const row = sheet.getRow(rowNumber);
  sheet.mergeCells(rowNumber, 2, rowNumber, 3);
  sheet.mergeCells(rowNumber, 4, rowNumber, 7);
  if (header) {
    row.getCell(2).value = "QUANTIDADE";
    row.getCell(4).value = "ATENDE";
    band(row, PAGE_START, PAGE_END, "header");
    return;
  }
  band(row, PAGE_START, PAGE_END, "data", striped);
}

interface CirculationExportRow {
  id: string;
  ref: number;
  row: number;
  label: string;
  item: HorizontalCirculation;
  widths: CirculationWidths;
}

interface CirculationAtendeLink {
  cell: string;
  atende: boolean | null;
}

const CIRCULATION_PARAM_LINES = [
  { key: "largura", label: "Largura medida", unit: "m" },
  { key: "pmm", label: "PMM", unit: "pax/(m·min)" },
  { key: "eb", label: "Eb", unit: "m" },
  { key: "ec", label: "Ec", unit: "m" },
] as const;

type CirculationParamKey = (typeof CIRCULATION_PARAM_LINES)[number]["key"];

function componentTitle(registry: RegistryEntry[], id: string): string | null {
  if (!id) return null;
  return registry.find((entry) => entry.id === id)?.title ?? null;
}

function circulationLabel(
  item: HorizontalCirculation,
  registry: RegistryEntry[],
): string {
  if (item.kind === "interna") {
    return componentTitle(registry, item.componentId) ?? item.title;
  }
  const from = componentTitle(registry, item.fromId);
  const to = componentTitle(registry, item.toId);
  if (!from && !to) return item.title;
  return `${from ?? "—"} → ${to ?? "—"}`;
}

function fittedRowHeight(text: string, columnWidth: number): number {
  const width = Math.max(8, Math.floor(columnWidth * 0.75));
  const lines = text.split(/\r?\n/).reduce((sum, line) => {
    const length = Math.max(1, [...line].length);
    return sum + Math.ceil(length / width);
  }, 0);
  return Math.max(MIN_ROW_HEIGHT, lines * LINE_HEIGHT);
}

function fittedHeaderHeight(cells: [string, number][]): number {
  return cells.reduce(
    (height, [text, width]) => Math.max(height, fittedRowHeight(text, width)),
    MIN_ROW_HEIGHT,
  );
}

function circulationColumns(wideName: boolean): {
  refColumn: number;
  nameColumn: number;
  refWidth: number;
  nameWidth: number;
  paramWidth: number;
  valueWidth: number;
  unitWidth: number;
  later: number[];
} {
  const widths = wideName ? MEMORY_COLUMN_WIDTHS : MODELO_COLUMN_WIDTHS;
  return {
    refColumn: wideName ? 3 : 2,
    nameColumn: wideName ? 2 : 3,
    refWidth: widths[wideName ? 2 : 1],
    nameWidth: widths[wideName ? 1 : 2],
    paramWidth: widths[3],
    valueWidth: widths[4],
    unitWidth: widths[5] + widths[6],
    later: [widths[3], widths[4], widths[5], widths[6]],
  };
}

function observationRowHeight(text: string): number {
  const width = Math.max(8, Math.floor(MODELO_BOX_WIDTH * 0.95));
  const lines = text.split(/\r?\n/).reduce((sum, line) => {
    const length = Math.max(1, [...line].length);
    return sum + Math.ceil(length / width);
  }, 0);
  return Math.max(18, lines * 15);
}

function markedRefs(
  rows: CirculationExportRow[],
  marked: (item: HorizontalCirculation) => boolean,
): string {
  return rows
    .filter((line) => marked(line.item))
    .map((line) => String(line.ref))
    .join(", ");
}

function circulationObservationsText(rows: CirculationExportRow[]): string {
  const lines: string[] = [];
  const borda = markedRefs(rows, (item) => item.efeitoBorda);
  const contrafluxo = markedRefs(rows, (item) => item.efeitoContrafluxo);
  if (borda) lines.push(`Observou-se efeito borda nos itens: ${borda}`);
  if (contrafluxo) {
    lines.push(`Observou-se efeito contrafluxo nos itens: ${contrafluxo}`);
  }
  const notes = rows.flatMap((line) => {
    const note = line.item.observacoes.trim();
    return note ? [`${line.ref}. ${note}`] : [];
  });
  if (notes.length === 0) return lines.join("\n");
  if (lines.length === 0) return notes.join("\n");
  return `${lines.join("\n")}\n\n${notes.join("\n")}`;
}

function appliedEb(item: HorizontalCirculation): number {
  return item.efeitoBorda ? item.eb : 0;
}

function appliedEc(item: HorizontalCirculation): number {
  return item.efeitoContrafluxo ? item.ec : 0;
}

function circulationParamValue(
  item: HorizontalCirculation,
  key: CirculationParamKey,
): number | null {
  switch (key) {
    case "largura":
      return item.larguraMedida;
    case "pmm":
      return item.pmm;
    case "eb":
      return appliedEb(item);
    case "ec":
      return appliedEc(item);
  }
}

function linkedComponentIds(item: HorizontalCirculation): string[] {
  if (item.kind === "interna") {
    return item.componentId ? [item.componentId] : [];
  }
  return [...new Set([item.fromId, item.toId].filter((id) => id !== ""))];
}

function atendeByComponent(
  rows: CirculationExportRow[],
): Map<string, CirculationAtendeLink[]> {
  const map = new Map<string, CirculationAtendeLink[]>();
  for (const line of rows) {
    for (const componentId of linkedComponentIds(line.item)) {
      const list = map.get(componentId) ?? [];
      list.push({ cell: `G${line.row}`, atende: line.widths.atende });
      map.set(componentId, list);
    }
  }
  return map;
}

function circulationStatus(values: (boolean | null)[]): string {
  if (values.some((value) => value === false)) return MARK_FAIL;
  if (values.length > 0 && values.every((value) => value === true)) return MARK_OK;
  return "";
}

function circulationStatusFormula(cells: string[]): string {
  const nao = cells.map((cell) => `${cell}="NÃO"`).join(",");
  const sim = cells.map((cell) => `${cell}="SIM"`).join(",");
  return `IF(OR(${nao}),"${MARK_FAIL}",IF(AND(${sim}),"${MARK_OK}",""))`;
}

function writeObservationsBox(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  text: string,
  end = PAGE_END,
): number {
  if (!text) return rowNumber;
  rowNumber = sectionTitle(sheet, rowNumber, "OBSERVAÇÕES", end);
  const row = sheet.getRow(rowNumber);
  row.getCell(PAGE_START).value = text;
  sheet.mergeCells(rowNumber, PAGE_START, rowNumber, end);
  band(row, PAGE_START, end, "data", false);
  row.getCell(PAGE_START).alignment = {
    horizontal: "left",
    vertical: "top",
    wrapText: true,
  };
  row.height = observationRowHeight(text);
  return rowNumber + 1;
}

function writeCirculationSection(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  items: HorizontalCirculation[],
  registry: RegistryEntry[],
  meetsPriority = 5,
  wideName = false,
): { nextRow: number; rows: CirculationExportRow[] } {
  const columns = circulationColumns(wideName);
  rowNumber = sectionTitle(sheet, rowNumber, "5. CIRCULAÇÃO HORIZONTAL");
  const head = sheet.getRow(rowNumber);
  head.getCell(columns.refColumn).value = "REF";
  head.getCell(columns.nameColumn).value = "CIRCULAÇÃO";
  head.getCell(4).value = "LARGURA TOTAL (m)";
  head.getCell(5).value = "CHp (pax/h)";
  head.getCell(6).value = "DHp (pax/h)";
  head.getCell(7).value = "ATENDE";
  band(head, PAGE_START, PAGE_END, "header");
  head.height = fittedHeaderHeight([
    ["REF", columns.refWidth],
    ["CIRCULAÇÃO", columns.nameWidth],
    ["LARGURA TOTAL (m)", columns.later[0]],
    ["CHp (pax/h)", columns.later[1]],
    ["DHp (pax/h)", columns.later[2]],
    ["ATENDE", columns.later[3]],
  ]);
  rowNumber += 1;

  const rows: CirculationExportRow[] = [];
  items.forEach((item, index) => {
    const label = circulationLabel(item, registry);
    const row = sheet.getRow(rowNumber);
    row.getCell(columns.refColumn).value = index + 1;
    row.getCell(columns.nameColumn).value = label;
    const demand = row.getCell(6);
    demand.value = item.dhp;
    demand.numFmt = "#,##0";
    band(row, PAGE_START, PAGE_END, "data", index % 2 === 0);
    row.getCell(columns.nameColumn).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    row.height = fittedRowHeight(label, columns.nameWidth);
    rows.push({
      id: item.id,
      ref: index + 1,
      row: rowNumber,
      label,
      item,
      widths: circulationWidths(item),
    });
    rowNumber += 1;
  });
  const first = rows[0]?.row ?? 0;
  const last = rows.at(-1)?.row ?? 0;
  paintMeets(sheet, first, last, meetsPriority);
  rowNumber = writeObservationsBox(
    sheet,
    rowNumber,
    circulationObservationsText(rows),
  );
  return { nextRow: rowNumber, rows };
}

function writeCirculationParams(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  rows: CirculationExportRow[],
  addresses: Map<string, string>,
  wideName = false,
): number {
  const columns = circulationColumns(wideName);
  rowNumber = sectionTitle(sheet, rowNumber, "CIRCULAÇÃO HORIZONTAL");
  const head = sheet.getRow(rowNumber);
  head.getCell(columns.refColumn).value = "REF";
  head.getCell(columns.nameColumn).value = "CIRCULAÇÃO";
  head.getCell(4).value = "PARÂMETRO";
  head.getCell(5).value = "VALOR";
  head.getCell(6).value = "UNIDADE";
  sheet.mergeCells(rowNumber, 6, rowNumber, 7);
  band(head, PAGE_START, PAGE_END, "header");
  head.height = fittedHeaderHeight([
    ["REF", columns.refWidth],
    ["CIRCULAÇÃO", columns.nameWidth],
    ["PARÂMETRO", columns.paramWidth],
    ["VALOR", columns.valueWidth],
    ["UNIDADE", columns.unitWidth],
  ]);
  rowNumber += 1;
  let index = 0;
  for (const line of rows) {
    for (const param of CIRCULATION_PARAM_LINES) {
      const row = sheet.getRow(rowNumber);
      row.getCell(columns.refColumn).value = line.ref;
      row.getCell(columns.nameColumn).value = line.label;
      row.getCell(4).value = param.label;
      const value = row.getCell(5);
      const raw = circulationParamValue(line.item, param.key);
      if (raw == null || !Number.isFinite(raw)) {
        value.value = null;
      } else {
        value.value = raw;
        value.numFmt = "#,##0.00";
      }
      row.getCell(6).value = param.unit;
      sheet.mergeCells(rowNumber, 6, rowNumber, 7);
      band(row, PAGE_START, PAGE_END, "data", index % 2 === 0);
      row.getCell(columns.nameColumn).alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
      row.getCell(4).alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
      row.height = Math.max(
        fittedRowHeight(line.label, columns.nameWidth),
        fittedRowHeight(param.label, columns.paramWidth),
      );
      addresses.set(`${line.id}|${param.key}`, `E${rowNumber}`);
      rowNumber += 1;
      index += 1;
    }
  }
  return rowNumber;
}

function applyCirculationFormulas(
  sheet: ExcelJS.Worksheet,
  rows: CirculationExportRow[],
  addresses: Map<string, string>,
): void {
  for (const line of rows) {
    const measured = addresses.get(`${line.id}|largura`);
    const pmm = addresses.get(`${line.id}|pmm`);
    const eb = addresses.get(`${line.id}|eb`);
    const ec = addresses.get(`${line.id}|ec`);
    if (!measured || !pmm || !eb || !ec) continue;
    const demand = `F${line.row}`;
    const total = `D${line.row}`;
    const lt = Number.isFinite(line.widths.lt) ? line.widths.lt : "";
    writeFormula(
      sheet.getRow(line.row).getCell(4),
      `MAX(${WIDTH_FLOOR_M},${demand}/(${pmm}*60)+2*${eb}+${ec})`,
      lt,
      lt === "" ? undefined : "#,##0.00",
    );
    const chp = line.widths.chp;
    const chpResult = chp == null || !Number.isFinite(chp) ? "" : chp;
    writeFormula(
      sheet.getRow(line.row).getCell(5),
      `IF(${measured}="","",MAX(0,(${measured}-2*${eb}-${ec})*${pmm}*60))`,
      chpResult,
      chpResult === "" ? undefined : "#,##0.00",
    );
    const meets =
      line.widths.atende == null ? "" : line.widths.atende ? "SIM" : "NÃO";
    writeFormula(
      sheet.getRow(line.row).getCell(7),
      `IF(${measured}="","",IF(${measured}>=${total},"SIM","NÃO"))`,
      meets,
    );
  }
}

function appendUnmodeled(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  circulations: HorizontalCirculation[],
  registry: RegistryEntry[],
  meetsPriority = 5,
  wideName = false,
): { endRow: number; circulationRows: CirculationExportRow[] } {
  let hatched = true;
  const line = (text: string) => {
    rowNumber = blankValue(sheet, rowNumber, text, hatched);
    hatched = !hatched;
  };

  rowNumber += 2;
  rowNumber = sectionTitle(
    sheet,
    rowNumber,
    "3. PROCESSAMENTO EM POSIÇÕES PRÓXIMAS (PONTES DE EMBARQUE)",
  );
  rowNumber = sectionTitle(sheet, rowNumber, "DOMÉSTICO");
  hatched = true;
  line("TD - Passageiros domésticos processados no período");
  line("TED - Passageiros domésticos transportados em aeronaves que impedem pontes de embarque");
  line("PD - Passageiros domésticos processados em pontes de embarque no período");
  line("RAD% - Percentual de passageiros domésticos processados em pontes de embarque");
  rowNumber = sectionTitle(sheet, rowNumber, "INTERNACIONAL");
  hatched = true;
  line("TI - Passageiros internacionais processados no período");
  line("TEI - Passageiros internacionais transportados em aeronaves que impedem pontes de embarque");
  line("PI - Passageiros internacionais processados em pontes de embarque no período");
  line("RAI% - Percentual de passageiros internacionais processados em pontes de embarque");
  line("ATENDE PMD (70%)");

  rowNumber += 1;
  rowNumber = sectionTitle(
    sheet,
    rowNumber,
    "4. PERCURSOS LIVRES E SIMPLIFICADOS",
  );
  hatched = true;
  line("PERCURSOS ADEQUADOS");
  rowNumber = sectionTitle(sheet, rowNumber, "OBSERVAÇÕES E RECOMENDAÇÕES");
  blankNote(sheet, rowNumber);

  rowNumber += 2;
  const circulation = writeCirculationSection(
    sheet,
    rowNumber,
    circulations,
    registry,
    meetsPriority,
    wideName,
  );
  rowNumber = circulation.nextRow;

  rowNumber += 1;
  rowNumber = sectionTitle(sheet, rowNumber, "6. CIRCULAÇÃO VERTICAL");
  rowNumber = sectionTitle(sheet, rowNumber, "6.1. ESCADAS ROLANTES");
  flowGrid(sheet, rowNumber, [
    "LARGURA DO DEGRAU",
    "CAPACIDADE",
    "DEMANDA",
    "ATENDE",
  ]);
  rowNumber += 1;
  flowGrid(sheet, rowNumber, null, true);
  rowNumber += 1;
  rowNumber = sectionTitle(sheet, rowNumber, "6.2. ELEVADORES");
  liftGrid(sheet, rowNumber, true);
  rowNumber += 1;
  liftGrid(sheet, rowNumber, false, true);

  rowNumber += 2;
  rowNumber = sectionTitle(sheet, rowNumber, "7. FILAS PRÉ-EMBARQUE");
  rowNumber = blankValue(sheet, rowNumber, "FILAS PRÉ-EMBARQUE ADEQUADAS", true);

  rowNumber += 1;
  rowNumber = sectionTitle(sheet, rowNumber, "8. OUTRAS OBSERVAÇÕES");
  rowNumber = sectionTitle(sheet, rowNumber, "OBSERVAÇÕES E RECOMENDAÇÕES");
  blankNote(sheet, rowNumber);
  return { endRow: rowNumber, circulationRows: circulation.rows };
}

function quoteSheet(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) return name;
  return `'${name.replace(/'/g, "''")}'`;
}

function sheetRef(sheetName: string, cell: string): string {
  return `${quoteSheet(sheetName)}!${cell}`;
}

function excelQuoted(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

type PainelMeets = "SIM" | "NÃO" | "";

interface PainelDemandLine {
  label: string;
  cell: string | null;
  value: number | null;
}

interface PainelComponentSource {
  demandCell: string | null;
  demandResult: number | string | null;
  demandNumeric: boolean;
  demandLines: PainelDemandLine[] | null;
  areaCell: string | null;
  areaMeets: PainelMeets | null;
  equipmentCell: string | null;
  equipmentMeets: PainelMeets | null;
}

function emptyPainelSource(): PainelComponentSource {
  return {
    demandCell: null,
    demandResult: null,
    demandNumeric: false,
    demandLines: null,
    areaCell: null,
    areaMeets: null,
    equipmentCell: null,
    equipmentMeets: null,
  };
}

function painelSource(
  map: Map<string, PainelComponentSource>,
  id: string,
): PainelComponentSource {
  let source = map.get(id);
  if (!source) {
    source = emptyPainelSource();
    map.set(id, source);
  }
  return source;
}

function meetsText(
  check: { atende: boolean } | null | undefined,
): PainelMeets {
  if (!check) return "";
  return check.atende ? "SIM" : "NÃO";
}

function meetsSymbol(meets: PainelMeets): string {
  if (meets === "SIM") return MARK_OK;
  if (meets === "NÃO") return MARK_FAIL;
  return "";
}

function demandLineFormula(line: PainelDemandLine, sheetName: string): string {
  if (line.cell) {
    return `${excelQuoted(`${line.label}: `)}&TEXT(${sheetRef(sheetName, line.cell)},"#,##0")`;
  }
  const shown = line.value == null ? "" : formatCount(line.value);
  return excelQuoted(`${line.label}: ${shown}`);
}

function demandLineText(lines: PainelDemandLine[]): string {
  return lines
    .map((line) => `${line.label}: ${line.value == null ? "" : formatCount(line.value)}`)
    .join("\n");
}

function writePainelDemand(
  cell: ExcelJS.Cell,
  source: PainelComponentSource | undefined,
  sheetName: string,
): string {
  if (!source) return "";
  if (source.demandLines && source.demandLines.length > 1) {
    const result = demandLineText(source.demandLines);
    writeFormula(
      cell,
      source.demandLines
        .map((line) => demandLineFormula(line, sheetName))
        .join("&CHAR(10)&"),
      result,
    );
    return result;
  }
  if (source.demandCell) {
    writeFormula(
      cell,
      sheetRef(sheetName, source.demandCell),
      source.demandResult ?? "",
    );
    if (source.demandNumeric) cell.numFmt = "#,##0";
    return typeof source.demandResult === "string"
      ? source.demandResult
      : source.demandResult == null
        ? ""
        : formatCount(source.demandResult);
  }
  if (typeof source.demandResult === "number") {
    cell.value = source.demandResult;
    cell.numFmt = "#,##0";
    return formatCount(source.demandResult);
  }
  if (typeof source.demandResult === "string" && source.demandResult) {
    cell.value = source.demandResult;
    return source.demandResult;
  }
  return "";
}

function writePainelStatus(
  cell: ExcelJS.Cell,
  sourceCell: string | null,
  meets: PainelMeets | null,
  sheetName: string,
): void {
  if (!sourceCell || meets == null) {
    cell.value = MARK_NA;
    return;
  }
  const ref = sheetRef(sheetName, sourceCell);
  writeFormula(
    cell,
    `IF(${ref}="SIM","${MARK_OK}",IF(${ref}="NÃO","${MARK_FAIL}",""))`,
    meetsSymbol(meets),
  );
}

function paintSymbols(
  sheet: ExcelJS.Worksheet,
  firstRow: number,
  lastRow: number,
  column: string,
  priority: number,
): void {
  if (firstRow === 0 || lastRow < firstRow) return;
  const first = `${column}${firstRow}`;
  sheet.addConditionalFormatting({
    ref: `${first}:${column}${lastRow}`,
    rules: [
      {
        type: "expression",
        priority,
        formulae: [`${first}="${MARK_OK}"`],
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: { argb: MEETS_GREEN },
          },
        },
      },
      {
        type: "expression",
        priority: priority + 1,
        formulae: [`${first}="${MARK_FAIL}"`],
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: { argb: MEETS_RED },
          },
        },
      },
    ],
  });
}

function writePainel(
  workbook: ExcelJS.Workbook,
  model: ModeloExcelModel,
  atendeLinks: Map<string, CirculationAtendeLink[]>,
  sources: Map<string, PainelComponentSource>,
  sourceSheet = MODELO_SHEET_NAME,
): void {
  const airport = model.airport ?? defaultAirport();
  const sheet = workbook.addWorksheet("Painel", {
    views: [{ showGridLines: false, showRowColHeaders: true }],
  });
  sheet.columns = [
    { width: 2 },
    { width: 6 },
    { width: PAINEL_NAME_WIDTH },
    { width: PAINEL_DHP_WIDTH },
    { width: 11 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 13 },
    { width: 14 },
  ];

  const title = sheet.getRow(2);
  title.getCell(2).value =
    `PAINEL DE ACOMPANHAMENTO DO NÍVEL DE SERVIÇO  |  ${airport.icao}`;
  title.getCell(2).font = { bold: true };
  title.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
  sheet.mergeCells(2, 2, 2, 11);
  band(title, 2, 11, "blue");

  const head = sheet.getRow(4);
  head.getCell(2).value = "ID";
  head.getCell(3).value = "COMPONENTE OPERACIONAL";
  head.getCell(4).value = "DHp";
  head.getCell(5).value = "Parâmetros mínimos de dimensionamento";
  head.getCell(8).value = "Especificações mínimas da infraestrutura aeroportuária";
  sheet.mergeCells(4, 5, 4, 7);
  sheet.mergeCells(4, 8, 4, 11);
  const sub = sheet.getRow(5);
  sub.getCell(5).value = "Áreas";
  sub.getCell(6).value = "Equipamentos";
  sub.getCell(7).value = "% Proces. PBB";
  sub.getCell(8).value = "Percursos";
  sub.getCell(9).value = "Circulação horizontal";
  sub.getCell(10).value = "Circulação vertical";
  sub.getCell(11).value = "Filas pré-embarque";
  sheet.mergeCells(4, 2, 5, 2);
  sheet.mergeCells(4, 3, 5, 3);
  sheet.mergeCells(4, 4, 5, 4);
  band(head, 2, 11, "header");
  band(sub, 2, 11, "header");
  head.height = 30;
  sub.height = 32;

  let rowNumber = 6;
  model.contracts.forEach((contract, index) => {
    const row = sheet.getRow(rowNumber);
    row.getCell(2).value = index + 1;
    row.getCell(3).value = contract.title;
    band(row, 2, 11, "data", index % 2 === 0);
    row.getCell(3).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    const source = sources.get(contract.id);
    const demandText = writePainelDemand(row.getCell(4), source, sourceSheet);
    writePainelStatus(
      row.getCell(5),
      source?.areaCell ?? null,
      source?.areaMeets ?? null,
      sourceSheet,
    );
    writePainelStatus(
      row.getCell(6),
      source?.equipmentCell ?? null,
      source?.equipmentMeets ?? null,
      sourceSheet,
    );
    for (const column of [7, 8, 10, 11]) {
      row.getCell(column).value = MARK_NA;
    }
    const links = atendeLinks.get(contract.id) ?? [];
    if (links.length > 0) {
      writeFormula(
        row.getCell(9),
        circulationStatusFormula(
          links.map((link) => sheetRef(sourceSheet, link.cell)),
        ),
        circulationStatus(links.map((link) => link.atende)),
      );
    } else {
      row.getCell(9).value = MARK_NA;
    }
    row.height = Math.max(
      fittedRowHeight(contract.title, PAINEL_NAME_WIDTH),
      fittedRowHeight(demandText, PAINEL_DHP_WIDTH),
    );
    rowNumber += 1;
  });

  if (model.contracts.length > 0) {
    paintSymbols(sheet, 6, rowNumber - 1, "E", 1);
    paintSymbols(sheet, 6, rowNumber - 1, "F", 3);
    paintSymbols(sheet, 6, rowNumber - 1, "I", 5);
  }

  const legend = sheet.getRow(rowNumber);
  legend.getCell(2).value =
    `${MARK_OK} atende    ${MARK_FAIL} não atende    ${MARK_NA} não se aplica`;
  legend.getCell(2).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  sheet.mergeCells(rowNumber, 2, rowNumber, 11);
  band(legend, 2, 11, "header");
  legend.getCell(2).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  fitReportPage(sheet, "K", rowNumber, "4:5");
}

export async function exportModeloExcel(model: ModeloExcelModel): Promise<void> {
  const airport = model.airport ?? defaultAirport();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Airport Capacity";
  workbook.created = model.generatedAt;
  const sheet = workbook.addWorksheet(MODELO_SHEET_NAME, {
    views: [{ showGridLines: false, showRowColHeaders: true }],
  });
  sheet.columns = MODELO_COLUMN_WIDTHS.map((width) => ({ width }));

  label(sheet.getCell("B3"), "AEROPORTO");
  sheet.mergeCells("B3:C3");
  label(sheet.getCell("D3"), "PERÍODO DE AVALIAÇÃO");
  sheet.mergeCells("D3:G3");
  const airportCell = sheet.getCell("B4");
  airportCell.value = `${airport.place} - ${airport.icao}`;
  airportCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  airportCell.font = { bold: true };
  sheet.mergeCells("B4:C4");
  const periodCell = sheet.getCell("D4");
  periodCell.value = formatReportDate(model.generatedAt);
  periodCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  sheet.mergeCells("D4:G4");
  band(sheet.getRow(3), PAGE_START, PAGE_END, "blue");
  band(sheet.getRow(4), PAGE_START, PAGE_END, "blue");

  const demandTitle = sheet.getCell("B6");
  demandTitle.value = "IDENTIFICAÇÃO DAS DEMANDAS POR COMPONENTE OPERACIONAL";
  demandTitle.font = { bold: true };
  demandTitle.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  sheet.mergeCells("B6:G6");
  band(sheet.getRow(6), PAGE_START, PAGE_END, "section");
  demandTitle.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  const header = sheet.getRow(7);
  header.getCell(2).value = "ID";
  header.getCell(3).value = "COMPONENTE OPERACIONAL";
  header.getCell(4).value = "DEMANDAS";
  sheet.mergeCells("D7:G7");
  sheet.mergeCells("B7:B8");
  sheet.mergeCells("C7:C8");

  const sub = sheet.getRow(8);
  sub.getCell(4).value = "COMPOSIÇÃO";
  sub.getCell(7).value = "DHP";
  sheet.mergeCells("D8:F8");
  band(header, PAGE_START, PAGE_END, "header");
  band(sub, PAGE_START, PAGE_END, "header");

  const registryById = new Map(model.registry.map((entry) => [entry.id, entry]));
  let rowNumber = 9;
  const indexed = model.contracts.map((contract, index) => {
    const entry = registryById.get(contract.id);
    return { contract, entry, id: index + 1 };
  });
  const addresses = new Map<string, string>();
  const painelSources = new Map<string, PainelComponentSource>();

  for (const [index, item] of indexed.entries()) {
    const row = sheet.getRow(rowNumber);
    row.getCell(2).value = item.id;
    row.getCell(3).value = item.contract.title;
    sheet.mergeCells(rowNumber, 4, rowNumber, 6);
    const demand = row.getCell(7);
    const evaluation = model.evaluations[item.contract.id];
    const ids: ComponentParamId[] = item.entry
      ? identityParamIds(item.entry)
      : ["demandaPico"];
    if (ids.length <= 1) {
      const demandId = ids[0] ?? "demandaPico";
      const value = evaluation?.inputs[demandId];
      demand.value = Number.isFinite(value) ? value : null;
      demand.numFmt = "#,##0";
      addresses.set(`${item.contract.id}|${demandId}`, `G${rowNumber}`);
    } else if (evaluation) {
      demand.value = ids
        .map(
          (id) =>
            `${memoryFlowLabel(id, item.entry)}: ${formatCount(evaluation.inputs[id])}`,
        )
        .join("\n");
      row.height = Math.max(18, ids.length * 16);
    }
    band(row, PAGE_START, PAGE_END, "data", index % 2 === 0);
    row.getCell(3).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    const painel = painelSource(painelSources, item.contract.id);
    painel.demandCell = `G${rowNumber}`;
    if (ids.length <= 1) {
      const raw = evaluation?.inputs[ids[0] ?? "demandaPico"];
      painel.demandNumeric = Number.isFinite(raw);
      painel.demandResult = painel.demandNumeric ? raw : null;
    } else {
      painel.demandNumeric = false;
      painel.demandResult = evaluation
        ? ids
            .map(
              (id) =>
                `${memoryFlowLabel(id, item.entry)}: ${formatCount(evaluation.inputs[id])}`,
            )
            .join("\n")
        : null;
    }
    rowNumber += 1;
  }

  rowNumber = sectionTitle(sheet, rowNumber, "OBSERVAÇÕES");
  rowNumber = pmdObservationNote(
    sheet,
    rowNumber,
    identificationObservationsText(indexed),
  );
  rowNumber += 1;

  const pmdTitle = sheet.getRow(rowNumber);
  pmdTitle.getCell(2).value =
    "ATENDIMENTO AOS PARÂMETROS MÍNIMOS DE DIMENSIONAMENTO - PMD";
  pmdTitle.getCell(2).font = { bold: true };
  pmdTitle.getCell(2).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  sheet.mergeCells(rowNumber, 2, rowNumber, 7);
  band(pmdTitle, PAGE_START, PAGE_END, "section");
  pmdTitle.getCell(2).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  rowNumber += 1;

  const areaTitle = sheet.getRow(rowNumber);
  areaTitle.getCell(2).value = "1. ÁREA DISPONIBILIZADA";
  areaTitle.getCell(2).font = { bold: true };
  areaTitle.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  sheet.mergeCells(rowNumber, 2, rowNumber, 7);
  band(areaTitle, PAGE_START, PAGE_END, "section");
  areaTitle.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  rowNumber += 1;

  const areaHead = rowNumber;
  const areaTop = sheet.getRow(areaHead);
  areaTop.getCell(2).value = "REF";
  areaTop.getCell(3).value = "COMPONENTE OPERACIONAL";
  areaTop.getCell(4).value = "ÁREA";
  areaTop.getCell(6).value = "ADEQUAÇÃO";
  sheet.mergeCells(areaHead, 4, areaHead, 5);
  sheet.mergeCells(areaHead, 6, areaHead, 7);
  const areaSub = sheet.getRow(areaHead + 1);
  areaSub.getCell(4).value = "VERIFICADA";
  areaSub.getCell(5).value = "MÍNIMA PMD";
  areaSub.getCell(6).value = "SATURAÇÃO";
  areaSub.getCell(7).value = "ATENDE";
  sheet.mergeCells(areaHead, 2, areaHead + 1, 2);
  sheet.mergeCells(areaHead, 3, areaHead + 1, 3);
  band(areaTop, PAGE_START, PAGE_END, "header");
  band(areaSub, PAGE_START, PAGE_END, "header");
  areaSub.height = 32;
  rowNumber = areaHead + 2;

  const pending: PendingAccount[] = [];
  let areaRow = 0;
  let areaMeetsFirst = 0;
  let areaMeetsLast = 0;
  for (const item of indexed) {
    if (!item.entry?.requirements.area) continue;
    const evaluation = model.evaluations[item.contract.id];
    const row = sheet.getRow(rowNumber);
    row.getCell(2).value = item.id;
    row.getCell(3).value = item.contract.title;
    const measured = evaluation?.inputs.areaMedida;
    const minimum = evaluation?.results.areaMinima;
    const verified = row.getCell(4);
    verified.value = Number.isFinite(measured) ? measured : null;
    verified.numFmt = "#,##0.00";
    const minima = row.getCell(5);
    const areaFormula = item.contract.formulas.find(
      (formula) => formula.id === "areaMinima",
    );
    if (
      evaluation &&
      areaFormula &&
      minimum !== undefined &&
      Number.isFinite(minimum)
    ) {
      pending.push({
        componentId: item.contract.id,
        row: rowNumber,
        formula: areaFormula,
        inputs: evaluation.inputs,
        result: minimum,
        saturacao: null,
      });
    } else {
      minima.value = null;
    }
    const check = evaluation?.areaCheck;
    const occupancy = row.getCell(6);
    if (check && Number.isFinite(check.saturacao)) {
      writeFormula(
        occupancy,
        `E${rowNumber}/D${rowNumber}`,
        check.saturacao / 100,
        "0%",
      );
    }
    const meets = row.getCell(7);
    if (check && Number.isFinite(minimum)) {
      writeFormula(
        meets,
        `IF(D${rowNumber}>=E${rowNumber},"SIM","NÃO")`,
        check.atende ? "SIM" : "NÃO",
      );
    } else {
      meets.value = check ? (check.atende ? "SIM" : "NÃO") : "";
    }
    if (areaMeetsFirst === 0) areaMeetsFirst = rowNumber;
    areaMeetsLast = rowNumber;
    const areaPainel = painelSource(painelSources, item.contract.id);
    areaPainel.areaCell = `G${rowNumber}`;
    areaPainel.areaMeets = meetsText(check);
    band(row, PAGE_START, PAGE_END, "data", areaRow % 2 === 0);
    areaRow += 1;
    row.getCell(3).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    rowNumber += 1;
  }
  paintMeets(sheet, areaMeetsFirst, areaMeetsLast, 1);
  rowNumber = writeObservationsBox(
    sheet,
    rowNumber,
    requirementObservationsText(
      indexed.filter((item) => item.entry?.requirements.area),
      ["areaMinima", "assentosMinimos"],
      model,
      false,
    ),
  );

  rowNumber += 1;
  const equipment = sheet.getRow(rowNumber);
  equipment.getCell(2).value = "2. EQUIPAMENTOS DISPONIBILIZADOS";
  equipment.getCell(2).font = { bold: true };
  equipment.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  sheet.mergeCells(rowNumber, 2, rowNumber, 7);
  band(equipment, PAGE_START, PAGE_END, "section");
  equipment.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  rowNumber += 1;

  const equipmentHead = rowNumber;
  const equipmentTop = sheet.getRow(equipmentHead);
  equipmentTop.getCell(2).value = "REF";
  equipmentTop.getCell(3).value = "COMPONENTE OPERACIONAL";
  equipmentTop.getCell(4).value = "EQUIPAMENTOS";
  equipmentTop.getCell(6).value = "ADEQUAÇÃO";
  sheet.mergeCells(equipmentHead, 4, equipmentHead, 5);
  sheet.mergeCells(equipmentHead, 6, equipmentHead, 7);
  const equipmentSub = sheet.getRow(equipmentHead + 1);
  equipmentSub.getCell(4).value = "VERIFICADOS";
  equipmentSub.getCell(5).value = "MÍNIMO PMD";
  equipmentSub.getCell(6).value = "SATURAÇÃO";
  equipmentSub.getCell(7).value = "ATENDE";
  sheet.mergeCells(equipmentHead, 2, equipmentHead + 1, 2);
  sheet.mergeCells(equipmentHead, 3, equipmentHead + 1, 3);
  band(equipmentTop, PAGE_START, PAGE_END, "header");
  band(equipmentSub, PAGE_START, PAGE_END, "header");
  equipmentSub.height = 32;
  rowNumber = equipmentHead + 2;

  let equipmentRow = 0;
  let equipmentMeetsFirst = 0;
  let equipmentMeetsLast = 0;
  for (const item of indexed) {
    if (!item.entry?.requirements.equipment) continue;
    const evaluation = model.evaluations[item.contract.id];
    const row = sheet.getRow(rowNumber);
    row.getCell(2).value = item.id;
    row.getCell(3).value = item.contract.title;
    const counted = evaluation?.inputs.quantidadeEquipamentos;
    const minimum = evaluation?.results.numeroMinimoEquipamentos;
    const verified = row.getCell(4);
    verified.value = Number.isFinite(counted) ? counted : null;
    verified.numFmt = "#,##0";
    const minima = row.getCell(5);
    const countFormula = item.contract.formulas.find(
      (formula) => formula.id === "numeroMinimoEquipamentos",
    );
    const check = evaluation?.equipmentCheck;
    if (
      evaluation &&
      countFormula &&
      minimum !== undefined &&
      Number.isFinite(minimum)
    ) {
      pending.push({
        componentId: item.contract.id,
        row: rowNumber,
        formula: countFormula,
        inputs: evaluation.inputs,
        result: minimum,
        saturacao:
          check && Number.isFinite(check.saturacao) ? check.saturacao : null,
      });
    } else {
      minima.value = null;
    }
    const meets = row.getCell(7);
    if (check && Number.isFinite(minimum)) {
      writeFormula(
        meets,
        `IF(D${rowNumber}>=E${rowNumber},"SIM","NÃO")`,
        check.atende ? "SIM" : "NÃO",
      );
    } else {
      meets.value = check ? (check.atende ? "SIM" : "NÃO") : "";
    }
    if (equipmentMeetsFirst === 0) equipmentMeetsFirst = rowNumber;
    equipmentMeetsLast = rowNumber;
    const equipmentPainel = painelSource(painelSources, item.contract.id);
    equipmentPainel.equipmentCell = `G${rowNumber}`;
    equipmentPainel.equipmentMeets = meetsText(check);
    band(row, PAGE_START, PAGE_END, "data", equipmentRow % 2 === 0);
    equipmentRow += 1;
    row.getCell(3).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    rowNumber += 1;
  }
  paintMeets(sheet, equipmentMeetsFirst, equipmentMeetsLast, 3);
  rowNumber = writeObservationsBox(
    sheet,
    rowNumber,
    requirementObservationsText(
      indexed.filter((item) => item.entry?.requirements.equipment),
      ["numeroMinimoEquipamentos"],
      model,
      true,
    ),
  );

  const unmodeled = appendUnmodeled(
    sheet,
    rowNumber - 1,
    model.circulations,
    model.registry,
  );
  let paramRow = sectionTitle(
    sheet,
    unmodeled.endRow + 2,
    "9. PARÂMETROS UTILIZADOS",
  );
  const paramLines = collectParamLines(indexed, model.evaluations);
  paramRow = writeParamBlock(sheet, paramRow, "PMD", paramLines.pmd, addresses);
  paramRow += 1;
  paramRow = writeParamBlock(
    sheet,
    paramRow,
    "OUTROS (MANUAIS)",
    paramLines.other,
    addresses,
  );
  if (unmodeled.circulationRows.length > 0) {
    paramRow += 1;
    paramRow = writeCirculationParams(
      sheet,
      paramRow,
      unmodeled.circulationRows,
      addresses,
    );
  }
  applyAccounts(sheet, pending, addresses);
  applyCirculationFormulas(sheet, unmodeled.circulationRows, addresses);
  fitReportPage(sheet, "G", paramRow - 1);
  writePainel(
    workbook,
    model,
    atendeByComponent(unmodeled.circulationRows),
    painelSources,
  );
  await downloadModeloWorkbook(workbook, "aeroporto-modelo");
}

type ModeloIndexed = {
  contract: ComponentContract;
  entry?: RegistryEntry;
  id: number;
};

function columnName(column: number): string {
  return String.fromCharCode(64 + column);
}

function writeModeloHeader(
  sheet: ExcelJS.Worksheet,
  airport: AirportSource,
  generatedAt: Date,
  end = PAGE_END,
): void {
  const endName = columnName(end);
  label(sheet.getCell("B3"), "AEROPORTO");
  sheet.mergeCells("B3:C3");
  label(sheet.getCell("D3"), "PERÍODO DE AVALIAÇÃO");
  sheet.mergeCells(`D3:${endName}3`);
  const airportCell = sheet.getCell("B4");
  airportCell.value = `${airport.place} - ${airport.icao}`;
  airportCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  airportCell.font = { bold: true };
  sheet.mergeCells("B4:C4");
  const periodCell = sheet.getCell("D4");
  periodCell.value = formatReportDate(generatedAt);
  periodCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  sheet.mergeCells(`D4:${endName}4`);
  band(sheet.getRow(3), PAGE_START, end, "blue");
  band(sheet.getRow(4), PAGE_START, end, "blue");
}

const COL_PARAM = 2;
const COL_VALUE = 3;
const COL_FLOW = 4;
const COL_DHP = 5;
const COL_MINIMUM = 6;
const COL_VERIFIED = 7;
const COL_SATURATION = 8;
const COL_MEETS = 9;

type MemoryLine = {
  paramId: ComponentParamId | null;
  demandId: ComponentParamId | null;
  flowLabel: string;
  group: string | null;
};

function memoryParamIds(
  formula: ComponentContract["formulas"][number],
): ComponentParamId[] {
  return paramsTouched(formula).filter(
    (id) =>
      !id.startsWith("demanda") &&
      id !== "areaMedida" &&
      id !== "quantidadeEquipamentos",
  );
}

const FLOW_SUFFIXES: { suffix: string; demand: ComponentParamId }[] = [
  { suffix: "EmbarqueDomestico", demand: "demandaPicoEmbarqueDomestico" },
  { suffix: "EmbarqueInternacional", demand: "demandaPicoEmbarqueInternacional" },
  { suffix: "DesembarqueDomestico", demand: "demandaPicoDesembarqueDomestico" },
  { suffix: "DesembarqueInternacional", demand: "demandaPicoDesembarqueInternacional" },
  { suffix: "Embarque", demand: "demandaPicoEmbarque" },
  { suffix: "Desembarque", demand: "demandaPicoDesembarque" },
  { suffix: "Domestico", demand: "demandaPicoDomestico" },
  { suffix: "Internacional", demand: "demandaPicoInternacional" },
];

const CONNECTION_DEMANDS = new Set<ComponentParamId>([
  "demandaPicoConexao",
  "demandaPicoConexaoDesembarqueDomestico",
  "demandaPicoConexaoDesembarqueInternacional",
]);

function isFlowBody(id: ComponentParamId): boolean {
  return (
    id.startsWith("espacoMinimo") ||
    id.startsWith("tempoDeOcupacao") ||
    id.startsWith("va") ||
    id.startsWith("tsec") ||
    id === "taxaDeUsoEquipamentoDomestico" ||
    id === "taxaDeUsoEquipamentoInternacional" ||
    id === "taxaDeUsoAreaDomestico" ||
    id === "taxaDeUsoAreaInternacional"
  );
}

function demandForParam(
  id: ComponentParamId,
  touched: Set<string>,
): ComponentParamId | null {
  for (const item of FLOW_SUFFIXES) {
    if (id.endsWith(item.suffix) && touched.has(item.demand)) return item.demand;
  }
  return null;
}

function memoryFlowLabel(
  id: ComponentParamId,
  entry: RegistryEntry | undefined,
): string {
  if (id !== "demandaPico") return flowLabel(id);
  if (entry?.pmd?.nature === "internacional") return "internacional";
  if (entry?.pmd?.nature === "domestico") return "doméstico";
  return "demanda";
}

function buildMemoryLines(
  entry: RegistryEntry | undefined,
  formula: ComponentContract["formulas"][number],
): MemoryLine[] {
  const touched = new Set(paramsTouched(formula));
  const params = new Set(memoryParamIds(formula));
  const primary = COMPONENT_PARAM_IDS.filter(
    (id) => id.startsWith("demanda") && touched.has(id) && !CONNECTION_DEMANDS.has(id),
  );
  const lone = primary.length === 1 ? primary[0] : null;
  const grouped = new Map<ComponentParamId, ComponentParamId[]>();
  const loose: ComponentParamId[] = [];
  for (const id of COMPONENT_PARAM_IDS) {
    if (!params.has(id)) continue;
    const demand = isFlowBody(id) ? (demandForParam(id, touched) ?? lone) : null;
    if (!demand) {
      loose.push(id);
      continue;
    }
    const list = grouped.get(demand) ?? [];
    list.push(id);
    grouped.set(demand, list);
  }

  const lines: MemoryLine[] = [];
  for (const demand of primary) {
    const ids = grouped.get(demand) ?? [];
    if (ids.length === 0) {
      lines.push({
        paramId: null,
        demandId: demand,
        flowLabel: memoryFlowLabel(demand, entry),
        group: demand,
      });
      continue;
    }
    for (const id of ids) {
      lines.push({
        paramId: id,
        demandId: demand,
        flowLabel: memoryFlowLabel(demand, entry),
        group: demand,
      });
    }
  }
  for (const id of loose) {
    lines.push({ paramId: id, demandId: null, flowLabel: "", group: null });
  }
  for (const id of COMPONENT_PARAM_IDS) {
    if (!CONNECTION_DEMANDS.has(id) || !touched.has(id)) continue;
    lines.push({
      paramId: null,
      demandId: id,
      flowLabel: flowLabel(id),
      group: `demand:${id}`,
    });
  }
  return lines;
}

function writeMemoryAccount(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  item: ModeloIndexed,
  model: ModeloExcelModel,
  addresses: Map<string, string>,
  kind: "area" | "equipment",
): { nextRow: number; meetsRow: number } {
  const formulaId = kind === "area" ? "areaMinima" : "numeroMinimoEquipamentos";
  const formula = item.contract.formulas.find((entry) => entry.id === formulaId);
  const evaluation = model.evaluations[item.contract.id];
  if (!formula || !evaluation) return { nextRow: rowNumber, meetsRow: 0 };
  const lines = buildMemoryLines(item.entry, formula);
  if (lines.length === 0) return { nextRow: rowNumber, meetsRow: 0 };

  const title =
    kind === "area" ? "ÁREA DISPONIBILIZADA" : "EQUIPAMENTOS DISPONIBILIZADOS";
  rowNumber = sectionTitle(sheet, rowNumber, title, MEMORY_END);
  const header = sheet.getRow(rowNumber);
  header.getCell(COL_PARAM).value = "PARÂMETRO";
  header.getCell(COL_VALUE).value = "VALOR";
  header.getCell(COL_FLOW).value = "FLUXO";
  header.getCell(COL_DHP).value = "DHp";
  header.getCell(COL_MINIMUM).value = kind === "area" ? "MÍNIMA" : "N";
  header.getCell(COL_VERIFIED).value = kind === "area" ? "VERIFICADA" : "VERIFICADOS";
  header.getCell(COL_SATURATION).value = "SATURAÇÃO";
  header.getCell(COL_MEETS).value = "ATENDE";
  band(header, PAGE_START, MEMORY_END, "header");
  header.height = fittedHeaderHeight([
    ["PARÂMETRO", MEMORY_COLUMN_WIDTHS[COL_PARAM - 1]],
    ["VALOR", MEMORY_COLUMN_WIDTHS[COL_VALUE - 1]],
    ["FLUXO", MEMORY_COLUMN_WIDTHS[COL_FLOW - 1]],
    ["DHp", MEMORY_COLUMN_WIDTHS[COL_DHP - 1]],
    [
      kind === "area" ? "MÍNIMA" : "N",
      MEMORY_COLUMN_WIDTHS[COL_MINIMUM - 1],
    ],
    [
      kind === "area" ? "VERIFICADA" : "VERIFICADOS",
      MEMORY_COLUMN_WIDTHS[COL_VERIFIED - 1],
    ],
    ["SATURAÇÃO", MEMORY_COLUMN_WIDTHS[COL_SATURATION - 1]],
    ["ATENDE", MEMORY_COLUMN_WIDTHS[COL_MEETS - 1]],
  ]);
  rowNumber += 1;

  const first = rowNumber;
  for (const [index, line] of lines.entries()) {
    const row = sheet.getRow(rowNumber);
    const previous = lines[index - 1];
    const groupStart =
      line.group == null || previous == null || previous.group !== line.group;
    let label = line.flowLabel;
    if (line.paramId) {
      const field = pickFields([line.paramId])[0];
      label = field.label;
      row.getCell(COL_PARAM).value = field.label;
      const raw = evaluation.inputs[line.paramId];
      const value = row.getCell(COL_VALUE);
      value.value = Number.isFinite(raw) ? raw : null;
      value.numFmt = isTsecParam(line.paramId) ? "#,##0" : "#,##0.00";
      addresses.set(
        `${item.contract.id}|${line.paramId}`,
        `${columnName(COL_VALUE)}${rowNumber}`,
      );
    } else {
      row.getCell(COL_PARAM).value = line.flowLabel;
    }
    if (groupStart) {
      row.getCell(COL_FLOW).value = line.flowLabel || null;
      if (line.demandId) {
        const raw = evaluation.inputs[line.demandId];
        const demand = row.getCell(COL_DHP);
        demand.value = Number.isFinite(raw) ? raw : null;
        demand.numFmt = "#,##0";
        addresses.set(
          `${item.contract.id}|${line.demandId}`,
          `${columnName(COL_DHP)}${rowNumber}`,
        );
      }
    }
    band(row, PAGE_START, MEMORY_END, "data", index % 2 === 0);
    row.getCell(COL_PARAM).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    row.getCell(COL_FLOW).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    row.height = Math.max(
      fittedRowHeight(label, MEMORY_COLUMN_WIDTHS[COL_PARAM - 1]),
      fittedRowHeight(line.flowLabel, MEMORY_COLUMN_WIDTHS[COL_FLOW - 1]),
    );
    rowNumber += 1;
  }

  const domesticFormula = item.contract.formulas.find(
    (entry) => entry.id === "numeroMinimoEquipamentosDomestico",
  );
  const internationalFormula = item.contract.formulas.find(
    (entry) => entry.id === "numeroMinimoEquipamentosInternacional",
  );
  const splitEquipment = Boolean(
    kind === "equipment" && domesticFormula && internationalFormula,
  );
  const flowMinimums: { demandId: ComponentParamId; row: number }[] = [];

  const last = rowNumber - 1;
  let index = 0;
  while (index < lines.length) {
    const group = lines[index].group;
    let end = index;
    if (group) {
      while (end + 1 < lines.length && lines[end + 1].group === group) end += 1;
    }
    if (group && end > index) {
      sheet.mergeCells(first + index, COL_FLOW, first + end, COL_FLOW);
      sheet.mergeCells(first + index, COL_DHP, first + end, COL_DHP);
      if (splitEquipment) {
        sheet.mergeCells(first + index, COL_MINIMUM, first + end, COL_MINIMUM);
      }
    }
    if (
      splitEquipment &&
      (group === "demandaPicoDomestico" || group === "demandaPicoInternacional")
    ) {
      flowMinimums.push({ demandId: group, row: first + index });
    }
    index = end + 1;
  }
  if (last > first) {
    const columns = splitEquipment
      ? [COL_VERIFIED, COL_SATURATION, COL_MEETS]
      : [COL_MINIMUM, COL_VERIFIED, COL_SATURATION, COL_MEETS];
    for (const column of columns) {
      sheet.mergeCells(first, column, last, column);
    }
  }

  const result =
    kind === "area"
      ? evaluation.results.areaMinima
      : evaluation.results.numeroMinimoEquipamentos;
  const measured =
    kind === "area"
      ? evaluation.inputs.areaMedida
      : evaluation.inputs.quantidadeEquipamentos;
  const verified = sheet.getRow(first).getCell(COL_VERIFIED);
  verified.value = Number.isFinite(measured) ? measured : null;
  verified.numFmt = kind === "area" ? "#,##0.00" : "#,##0";
  const minimumCell = `${columnName(COL_MINIMUM)}${first}`;
  const verifiedCell = `${columnName(COL_VERIFIED)}${first}`;
  const check = kind === "area" ? evaluation.areaCheck : evaluation.equipmentCheck;
  if (
    splitEquipment &&
    domesticFormula &&
    internationalFormula &&
    result !== undefined &&
    Number.isFinite(result)
  ) {
    const nCells: string[] = [];
    for (const flow of flowMinimums) {
      const partial =
        flow.demandId === "demandaPicoDomestico"
          ? domesticFormula
          : internationalFormula;
      const partialResult =
        flow.demandId === "demandaPicoDomestico"
          ? evaluation.results.numeroMinimoEquipamentosDomestico
          : evaluation.results.numeroMinimoEquipamentosInternacional;
      if (partialResult === undefined || !Number.isFinite(partialResult)) continue;
      applyAccounts(
        sheet,
        [
          {
            componentId: item.contract.id,
            row: flow.row,
            formula: partial,
            inputs: evaluation.inputs,
            result: partialResult,
            saturacao: null,
            resultColumn: COL_MINIMUM,
          },
        ],
        addresses,
      );
      nCells.push(`${columnName(COL_MINIMUM)}${flow.row}`);
    }
    const cells = new Proxy({} as ExcelCellMap["inputs"], {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        const address = addresses.get(`${item.contract.id}|${prop}`);
        if (address) return address;
        if (!prop.startsWith("demanda")) return undefined;
        const value = evaluation.inputs[prop as ComponentParamId];
        return Number.isFinite(value) ? String(value) : "0";
      },
    });
    const loads = [domesticFormula, internationalFormula]
      .map((partial) => equipmentLoad(partial.toExcel(cells)))
      .filter((load): load is string => load != null);
    if (check && Number.isFinite(check.saturacao) && loads.length === 2) {
      writeFormula(
        sheet.getRow(first).getCell(COL_SATURATION),
        `(${loads.join("+")})/${verifiedCell}`,
        check.saturacao / 100,
        "0%",
      );
    }
    if (check && nCells.length > 0) {
      writeFormula(
        sheet.getRow(first).getCell(COL_MEETS),
        `IF(${verifiedCell}>=${nCells.join("+")},"SIM","NÃO")`,
        check.atende ? "SIM" : "NÃO",
      );
    }
  } else if (result !== undefined && Number.isFinite(result)) {
    applyAccounts(sheet, [
      {
        componentId: item.contract.id,
        row: first,
        formula,
        inputs: evaluation.inputs,
        result,
        saturacao:
          kind === "equipment" && check && Number.isFinite(check.saturacao)
            ? check.saturacao
            : null,
        resultColumn: COL_MINIMUM,
        saturationColumn: COL_SATURATION,
        verifiedAddress: verifiedCell,
      },
    ], addresses);
    if (kind === "area" && check && Number.isFinite(check.saturacao)) {
      writeFormula(
        sheet.getRow(first).getCell(COL_SATURATION),
        `${minimumCell}/${verifiedCell}`,
        check.saturacao / 100,
        "0%",
      );
    }
    if (check && Number.isFinite(result)) {
      writeFormula(
        sheet.getRow(first).getCell(COL_MEETS),
        `IF(${verifiedCell}>=${minimumCell},"SIM","NÃO")`,
        check.atende ? "SIM" : "NÃO",
      );
    }
  }

  return { nextRow: rowNumber, meetsRow: first };
}

function writeComponentModeloBlock(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  item: ModeloIndexed,
  model: ModeloExcelModel,
  addresses: Map<string, string>,
): { nextRow: number; areaRow: number; equipmentRow: number } {
  const titleRow = rowNumber;
  rowNumber = sectionTitle(sheet, rowNumber, item.contract.title, MEMORY_END);
  sheet.getRow(titleRow).height = fittedRowHeight(
    item.contract.title,
    MEMORY_COLUMN_WIDTHS.slice(PAGE_START - 1, MEMORY_END).reduce(
      (sum, width) => sum + width,
      0,
    ),
  );
  rowNumber = sectionTitle(sheet, rowNumber, "OBSERVAÇÕES", MEMORY_END);
  rowNumber = pmdObservationNote(
    sheet,
    rowNumber,
    identificationObservationsText([item]),
    MEMORY_END,
  );

  let areaRow = 0;
  if (item.entry?.requirements.area) {
    const area = writeMemoryAccount(
      sheet,
      rowNumber,
      item,
      model,
      addresses,
      "area",
    );
    rowNumber = area.nextRow;
    areaRow = area.meetsRow;
    if (area.meetsRow > 0) {
      rowNumber = writeObservationsBox(
        sheet,
        rowNumber,
        requirementObservationsText(
          [item],
          ["areaMinima", "assentosMinimos"],
          model,
          false,
        ),
        MEMORY_END,
      );
    }
  }

  let equipmentRow = 0;
  if (item.entry?.requirements.equipment) {
    const equipment = writeMemoryAccount(
      sheet,
      rowNumber,
      item,
      model,
      addresses,
      "equipment",
    );
    rowNumber = equipment.nextRow;
    equipmentRow = equipment.meetsRow;
    if (equipment.meetsRow > 0) {
      rowNumber = writeObservationsBox(
        sheet,
        rowNumber,
        requirementObservationsText(
          [item],
          ["numeroMinimoEquipamentos"],
          model,
          true,
        ),
        MEMORY_END,
      );
    }
  }

  return { nextRow: rowNumber, areaRow, equipmentRow };
}


async function downloadModeloWorkbook(
  workbook: ExcelJS.Workbook,
  stem: string,
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    stampFilename(stem, "xlsx"),
  );
}

function journeyOrderedContracts(model: ModeloExcelModel): ComponentContract[] {
  const kindById = new Map(model.registry.map((entry) => [entry.id, entry.kind]));
  return [...model.contracts].sort(
    (left, right) =>
      journeyRank(kindById.get(left.id)) - journeyRank(kindById.get(right.id)),
  );
}

function blockPainelSources(
  indexed: ModeloIndexed[],
  model: ModeloExcelModel,
  addresses: Map<string, string>,
  areaRows: Map<string, number>,
  equipmentRows: Map<string, number>,
): Map<string, PainelComponentSource> {
  const map = new Map<string, PainelComponentSource>();
  for (const item of indexed) {
    const source = emptyPainelSource();
    const evaluation = model.evaluations[item.contract.id];
    const ids: ComponentParamId[] = item.entry
      ? identityParamIds(item.entry)
      : ["demandaPico"];
    const lines: PainelDemandLine[] = ids.map((id) => {
      const raw = evaluation?.inputs[id];
      return {
        label: memoryFlowLabel(id, item.entry),
        cell: addresses.get(`${item.contract.id}|${id}`) ?? null,
        value: Number.isFinite(raw) ? raw : null,
      };
    });
    const linked = lines.some((line) => line.cell);
    if (lines.length <= 1) {
      const line = lines[0];
      if (line?.cell) {
        source.demandCell = line.cell;
        source.demandNumeric = line.value != null;
        source.demandResult = line.value;
      } else if (line?.value != null) {
        source.demandNumeric = true;
        source.demandResult = line.value;
      }
    } else if (linked) {
      source.demandLines = lines;
    } else {
      source.demandResult = demandLineText(lines);
    }
    const areaRow = areaRows.get(item.contract.id);
    if (areaRow) {
      source.areaCell = `${columnName(COL_MEETS)}${areaRow}`;
      source.areaMeets = meetsText(evaluation?.areaCheck);
    }
    const equipmentRow = equipmentRows.get(item.contract.id);
    if (equipmentRow) {
      source.equipmentCell = `${columnName(COL_MEETS)}${equipmentRow}`;
      source.equipmentMeets = meetsText(evaluation?.equipmentCheck);
    }
    map.set(item.contract.id, source);
  }
  return map;
}

export async function exportModeloPorComponente(
  model: ModeloExcelModel,
): Promise<void> {
  const airport = model.airport ?? defaultAirport();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Airport Capacity";
  workbook.created = model.generatedAt;
  const sheet = workbook.addWorksheet(POR_COMPONENTE_SHEET_NAME, {
    views: [{ showGridLines: false, showRowColHeaders: true }],
  });
  sheet.columns = MEMORY_COLUMN_WIDTHS.map((width) => ({ width }));
  writeModeloHeader(sheet, airport, model.generatedAt, MEMORY_END);

  const registryById = new Map(model.registry.map((entry) => [entry.id, entry]));
  const ordered = journeyOrderedContracts(model);
  const indexed: ModeloIndexed[] = ordered.map((contract, index) => ({
    contract,
    entry: registryById.get(contract.id),
    id: index + 1,
  }));
  const addresses = new Map<string, string>();
  const areaMeets: number[] = [];
  const equipmentMeets: number[] = [];
  const areaRows = new Map<string, number>();
  const equipmentRows = new Map<string, number>();
  let rowNumber = 6;
  for (const item of indexed) {
    const block = writeComponentModeloBlock(
      sheet,
      rowNumber,
      item,
      model,
      addresses,
    );
    if (block.areaRow > 0) {
      areaMeets.push(block.areaRow);
      areaRows.set(item.contract.id, block.areaRow);
    }
    if (block.equipmentRow > 0) {
      equipmentMeets.push(block.equipmentRow);
      equipmentRows.set(item.contract.id, block.equipmentRow);
    }
    rowNumber = block.nextRow + 1;
  }

  let priority = 1;
  for (const row of areaMeets) {
    paintMeets(sheet, row, row, priority, columnName(COL_MEETS));
    priority += 2;
  }
  for (const row of equipmentMeets) {
    paintMeets(sheet, row, row, priority, columnName(COL_MEETS));
    priority += 2;
  }

  const unmodeled = appendUnmodeled(
    sheet,
    rowNumber - 1,
    model.circulations,
    model.registry,
    priority,
    true,
  );
  let endRow = unmodeled.endRow;
  if (unmodeled.circulationRows.length > 0) {
    let paramRow = sectionTitle(
      sheet,
      unmodeled.endRow + 2,
      "9. PARÂMETROS UTILIZADOS",
    );
    paramRow = writeCirculationParams(
      sheet,
      paramRow,
      unmodeled.circulationRows,
      addresses,
      true,
    );
    endRow = paramRow;
  }
  applyCirculationFormulas(sheet, unmodeled.circulationRows, addresses);
  fitReportPage(sheet, columnName(MEMORY_END), Math.max(endRow - 1, 1));
  writePainel(
    workbook,
    { ...model, contracts: ordered },
    atendeByComponent(unmodeled.circulationRows),
    blockPainelSources(indexed, model, addresses, areaRows, equipmentRows),
    POR_COMPONENTE_SHEET_NAME,
  );
  await downloadModeloWorkbook(workbook, "aeroporto-modelo-por-componente");
}

import ExcelJS from "exceljs";
import { defaultAirport, type AirportSource } from "../domain/airports";
import {
  WIDTH_FLOOR_M,
  circulationWidths,
  type CirculationWidths,
  type HorizontalCirculation,
} from "../domain/circulation";
import { isSizingParam, pickFields } from "../domain/contracts/fields";
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
const MODELO_COLUMN_WIDTHS = [3, 6, 38, 26, 14, 13, 8];
const MODELO_NAME_WIDTH = MODELO_COLUMN_WIDTHS[2];
const MODELO_PARAM_WIDTH = MODELO_COLUMN_WIDTHS[3];
const MODELO_BOX_WIDTH = MODELO_COLUMN_WIDTHS.slice(PAGE_START - 1, PAGE_END).reduce(
  (sum, width) => sum + width,
  0,
);
const MIN_ROW_HEIGHT = 30;
const LINE_HEIGHT = 16;

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
  const match = /^ROUNDUP\((.*),0\)$/.exec(excel);
  return match?.[1] ?? null;
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
    row.height = 30;
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
      sheet.getRow(item.row).getCell(5),
      excel,
      item.result,
      item.formula.id === "numeroMinimoEquipamentos" ? "#,##0" : "#,##0.00",
    );
    if (item.formula.id !== "numeroMinimoEquipamentos" || item.saturacao === null) {
      continue;
    }
    const load = equipmentLoad(excel);
    if (!load) continue;
    writeFormula(
      sheet.getRow(item.row).getCell(6),
      `(${load})/D${item.row}`,
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
): void {
  if (firstRow === 0) return;
  const first = `G${firstRow}`;
  sheet.addConditionalFormatting({
    ref: `${first}:G${lastRow}`,
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
): number {
  const row = sheet.getRow(rowNumber);
  row.getCell(2).value = text;
  row.getCell(2).font = { bold: true };
  row.getCell(2).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  sheet.mergeCells(rowNumber, PAGE_START, rowNumber, PAGE_END);
  band(row, PAGE_START, PAGE_END, "section");
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

function blankNote(sheet: ExcelJS.Worksheet, rowNumber: number): number {
  const row = sheet.getRow(rowNumber);
  row.getCell(2).value = null;
  sheet.mergeCells(rowNumber, PAGE_START, rowNumber, PAGE_END);
  row.height = 36;
  band(row, PAGE_START, PAGE_END, "data", false);
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

function formatMeters(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function effectSentence(marked: boolean, name: string, meters: number): string {
  if (!marked) return `Não visualizou-se efeito ${name}.`;
  return `Considerou-se efeito ${name} de ${formatMeters(meters)} m.`;
}

function circulationObservationsText(rows: CirculationExportRow[]): string {
  return rows
    .map((line) => {
      const contrafluxo = effectSentence(
        line.item.efeitoContrafluxo,
        "contra fluxo",
        line.item.ec,
      );
      const borda = effectSentence(line.item.efeitoBorda, "borda", line.item.eb);
      const note = line.item.observacoes.trim();
      const sentence = `${line.ref}. ${contrafluxo} ${borda}`;
      return note ? `${sentence} ${note}` : sentence;
    })
    .join("\n");
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

function circulationStatus(values: (boolean | null)[]): "SIM" | "NÃO" | "" {
  if (values.some((value) => value === false)) return "NÃO";
  if (values.length > 0 && values.every((value) => value === true)) return "SIM";
  return "";
}

function circulationStatusFormula(cells: string[]): string {
  const nao = cells.map((cell) => `${cell}="NÃO"`).join(",");
  const sim = cells.map((cell) => `${cell}="SIM"`).join(",");
  return `IF(OR(${nao}),"NÃO",IF(AND(${sim}),"SIM",""))`;
}

function writeCirculationSection(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  items: HorizontalCirculation[],
  registry: RegistryEntry[],
): { nextRow: number; rows: CirculationExportRow[] } {
  rowNumber = sectionTitle(sheet, rowNumber, "5. CIRCULAÇÃO HORIZONTAL");
  const head = sheet.getRow(rowNumber);
  head.getCell(2).value = "REF";
  head.getCell(3).value = "CIRCULAÇÃO";
  head.getCell(4).value = "LARGURA TOTAL (m)";
  head.getCell(5).value = "CHp (pax/h)";
  head.getCell(6).value = "DHp (pax/h)";
  head.getCell(7).value = "ATENDE";
  band(head, PAGE_START, PAGE_END, "header");
  head.height = 32;
  rowNumber += 1;

  const rows: CirculationExportRow[] = [];
  items.forEach((item, index) => {
    const label = circulationLabel(item, registry);
    const row = sheet.getRow(rowNumber);
    row.getCell(2).value = index + 1;
    row.getCell(3).value = label;
    const demand = row.getCell(6);
    demand.value = item.dhp;
    demand.numFmt = "#,##0";
    band(row, PAGE_START, PAGE_END, "data", index % 2 === 0);
    row.getCell(3).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    row.height = fittedRowHeight(label, MODELO_NAME_WIDTH);
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
  paintMeets(sheet, first, last, 5);
  if (rows.length > 0) {
    rowNumber = sectionTitle(sheet, rowNumber, "OBSERVAÇÕES");
    const text = circulationObservationsText(rows);
    const row = sheet.getRow(rowNumber);
    row.getCell(PAGE_START).value = text;
    sheet.mergeCells(rowNumber, PAGE_START, rowNumber, PAGE_END);
    band(row, PAGE_START, PAGE_END, "data", false);
    row.getCell(PAGE_START).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    row.height = fittedRowHeight(text, MODELO_BOX_WIDTH);
    rowNumber += 1;
  }
  return { nextRow: rowNumber, rows };
}

function writeCirculationParams(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  rows: CirculationExportRow[],
  addresses: Map<string, string>,
): number {
  rowNumber = sectionTitle(sheet, rowNumber, "CIRCULAÇÃO HORIZONTAL");
  const head = sheet.getRow(rowNumber);
  head.getCell(2).value = "REF";
  head.getCell(3).value = "CIRCULAÇÃO";
  head.getCell(4).value = "PARÂMETRO";
  head.getCell(5).value = "VALOR";
  head.getCell(6).value = "UNIDADE";
  sheet.mergeCells(rowNumber, 6, rowNumber, 7);
  band(head, PAGE_START, PAGE_END, "header");
  rowNumber += 1;
  let index = 0;
  for (const line of rows) {
    for (const param of CIRCULATION_PARAM_LINES) {
      const row = sheet.getRow(rowNumber);
      row.getCell(2).value = line.ref;
      row.getCell(3).value = line.label;
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
        fittedRowHeight(line.label, MODELO_NAME_WIDTH),
        fittedRowHeight(param.label, MODELO_PARAM_WIDTH),
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

function writePainel(
  workbook: ExcelJS.Workbook,
  model: ModeloExcelModel,
  atendeLinks: Map<string, CirculationAtendeLink[]>,
): void {
  const airport = model.airport ?? defaultAirport();
  const sheet = workbook.addWorksheet("Painel", {
    views: [{ showGridLines: false, showRowColHeaders: true }],
  });
  sheet.columns = [
    { width: 2 },
    { width: 6 },
    { width: 28 },
    { width: 8 },
    { width: 11 },
    { width: 13 },
    { width: 12 },
    { width: 12 },
    { width: 13 },
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
    const links = atendeLinks.get(contract.id) ?? [];
    if (links.length > 0) {
      writeFormula(
        row.getCell(9),
        circulationStatusFormula(
          links.map((link) => `${MODELO_SHEET_NAME}!${link.cell}`),
        ),
        circulationStatus(links.map((link) => link.atende)),
      );
    }
    rowNumber += 1;
  });

  const legend = sheet.getRow(rowNumber);
  legend.getCell(2).value =
    "Adequado ✓    Alerta !    Gatilho de investimento ↑    Saturado ø    N/A ─";
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
        .map((id) => `${flowLabel(id)}: ${formatCount(evaluation.inputs[id])}`)
        .join("\n");
      row.height = Math.max(18, ids.length * 16);
    }
    band(row, PAGE_START, PAGE_END, "data", index % 2 === 0);
    row.getCell(3).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    rowNumber += 1;
  }

  rowNumber = sectionTitle(sheet, rowNumber, "OBSERVAÇÕES");
  rowNumber = blankNote(sheet, rowNumber);
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

  const unmodeled = appendUnmodeled(
    sheet,
    rowNumber - 1,
    model.circulations,
    model.registry,
  );
  const { pmd, other } = collectParamLines(indexed, model.evaluations);
  let paramRow = sectionTitle(
    sheet,
    unmodeled.endRow + 2,
    "9. PARÂMETROS UTILIZADOS",
  );
  paramRow = writeParamBlock(sheet, paramRow, "PMD", pmd, addresses);
  paramRow += 1;
  paramRow = writeParamBlock(sheet, paramRow, "OUTROS (MANUAIS)", other, addresses);
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
  writePainel(workbook, model, atendeByComponent(unmodeled.circulationRows));

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    stampFilename("aeroporto-modelo", "xlsx"),
  );
}

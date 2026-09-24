import ExcelJS from "exceljs";
import { defaultAirport, type AirportSource } from "../domain/airports";
import { hasResult } from "../domain/contracts/catalog";
import { isDualContract, isMixedNatureContract } from "../domain/contracts/factory";
import {
  mixedFlowLabel,
  mixedSpecsForParams,
} from "../domain/contracts/flowParams";
import { isSizingParam, isTaxaParam, isTsecParam } from "../domain/contracts/fields";
import { beltManualStandard, isBeltManualParam } from "../domain/contracts/formulas";
import { areaFormulaDisplay, dualAreaFormulaDisplay, mixedAreaFormulaDisplay, singleFunctionMixedFormulaDisplay, splitLoungeFormulaDisplay } from "../domain/contracts/notations";
import {
  areaCheckContract,
  beltCheckContract,
  getNatureSheetLayout,
  getSingleSheetLayout,
  NATURE_AREA_COLUMNS,
  NATURE_BELT_COLUMNS,
  NATURE_EQUIPMENT_COLUMNS,
  type ExcelHeaderLayout,
  type NatureAreaRowLayout,
  type NatureEquipmentRowLayout,
  type ManualExcelLayout,
  type NatureSheetLayout,
  type SingleSheetLayout,
  type SizingExcelLayout,
} from "../domain/excelLayout";
import {
  naturesUsedOnRow,
  pmdMetrics,
  pmdOrigem,
  pmdRows,
  resolveContractValue,
  resolvedSources,
  roundLabel,
  sourceCitation,
  standardTsecForParam,
  TSEC_MANUAL_LABEL,
  usedByPmd,
} from "../domain/pmd";
import { UNOFFICIAL_NOTICE } from "../domain/notice";
import type {
  ComponentContract,
  ComponentId,
  ComponentJustificativas,
  ComponentParamId,
  Evaluation,
  ExcelKind,
  RegistryEntry,
} from "../domain/types";
import { usesAreaTaxa, usesEquipmentTaxa } from "../domain/types";
import { downloadBlob, stampFilename } from "./download";

const COLORS = {
  navy: "FF1C2430",
  slate: "FF2F4A63",
  sand: "FFE4E6EA",
  paper: "FFF5F6F4",
  alt: "FFEEF0F2",
  green: "FFE5F3EA",
  red: "FFFDE8E4",
  white: "FFFFFFFF",
  result: "FFE8EEF3",
} as const;

function requirementsMet(evaluation: Evaluation): boolean {
  return (
    evaluation.areaCheck?.atende !== false &&
    evaluation.equipmentCheck?.atende !== false &&
    evaluation.esteiraCheck?.atende !== false
  );
}

interface ExcelModel {
  airportName: string;
  airport?: AirportSource;
  generatedAt: Date;
  registry: RegistryEntry[];
  contracts: ComponentContract[];
  evaluations: Record<ComponentId, Evaluation>;
  componentOrigens: Record<ComponentId, Record<ComponentParamId, string>>;
  justificativas: Record<ComponentId, ComponentJustificativas>;
}

function fillRow(
  row: ExcelJS.Row,
  argb: string,
  from = 1,
  to = 5,
): void {
  for (let index = from; index <= to; index += 1) {
    row.getCell(index).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb },
    };
  }
}

function titleRow(
  row: ExcelJS.Row,
  text: string,
  argb: string,
  width = 5,
): void {
  row.getCell(1).value = text;
  row.getCell(1).font = { bold: true, color: { argb: COLORS.white }, size: 12 };
  row.getCell(1).alignment = { vertical: "middle" };
  fillRow(row, argb, 1, width);
  row.height = 22;
}

function colHeaders(
  row: ExcelJS.Row,
  labels: string[],
  argb: string,
): void {
  labels.forEach((label, index) => {
    const cell = row.getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: COLORS.white } };
  });
  fillRow(row, argb, 1, labels.length);
}

function writeIdentity(
  sheet: ExcelJS.Worksheet,
  layout: ExcelHeaderLayout,
  model: ExcelModel,
  width: number,
): void {
  const airport = model.airport ?? defaultAirport();
  const nameRow = sheet.getRow(layout.nameRow);
  nameRow.getCell(1).value = "Aeroporto";
  nameRow.getCell(1).font = { bold: true, color: { argb: COLORS.white } };
  nameRow.getCell(2).value = model.airportName;
  nameRow.getCell(2).font = { bold: true, color: { argb: COLORS.white } };
  fillRow(nameRow, COLORS.navy, 1, width);
  nameRow.height = 24;

  const icaoRow = sheet.getRow(layout.icaoRow);
  icaoRow.getCell(1).value = "ICAO";
  icaoRow.getCell(1).font = { bold: true, color: { argb: COLORS.white } };
  icaoRow.getCell(2).value = airport.icao;
  icaoRow.getCell(2).font = { color: { argb: COLORS.white } };
  fillRow(icaoRow, COLORS.navy, 1, width);

  const sourceRow = sheet.getRow(layout.sourceRow);
  sourceRow.getCell(1).value = "Fonte";
  sourceRow.getCell(1).font = { bold: true, color: { argb: COLORS.white } };
  sourceRow.getCell(2).value = sourceCitation(airport);
  sourceRow.getCell(2).font = { color: { argb: COLORS.white } };
  fillRow(sourceRow, COLORS.navy, 1, width);

  const dateRow = sheet.getRow(layout.dateRow);
  dateRow.getCell(1).value = "Data";
  dateRow.getCell(1).font = { bold: true, color: { argb: COLORS.white } };
  dateRow.getCell(2).value = model.generatedAt;
  dateRow.getCell(2).numFmt = "dd/mm/yyyy hh:mm";
  dateRow.getCell(2).font = { color: { argb: COLORS.white } };
  fillRow(dateRow, COLORS.navy, 1, width);

  const noticeRow = sheet.getRow(layout.noticeRow);
  noticeRow.getCell(1).value = UNOFFICIAL_NOTICE;
  noticeRow.getCell(1).font = { italic: true, color: { argb: COLORS.navy } };
  noticeRow.getCell(1).alignment = { wrapText: true, vertical: "middle" };
  sheet.mergeCells(layout.noticeRow, 1, layout.noticeRow, width);
  noticeRow.height = 36;
}

function writePmd(
  sheet: ExcelJS.Worksheet,
  sizing: SizingExcelLayout,
  model: ExcelModel,
  width: number,
): void {
  const airport = model.airport ?? defaultAirport();
  const rows = pmdRows(airport);
  titleRow(
    sheet.getRow(sizing.headerRow),
    `Parâmetros mínimos de dimensionamento — ${roundLabel(airport.roundId)}`,
    COLORS.slate,
    width,
  );
  colHeaders(
    sheet.getRow(sizing.colHeaderRow),
    ["Linha do PMD", "Parâmetro", "Doméstico", "Internacional", "Usado por"],
    COLORS.slate,
  );

  for (const item of sizing.rows) {
    const pmd = rows.find((row) => row.id === item.pmdId);
    if (!pmd) continue;
    const metric = pmdMetrics(pmd).find((entry) => entry.key === item.metricKey);
    if (!metric) continue;
    const first =
      sizing.rows.find((row) => row.pmdId === item.pmdId)?.row === item.row;
    const users = usedByPmd(model.registry, pmd.id);
    const row = sheet.getRow(item.row);
    row.getCell(1).value = first ? pmd.title : "";
    const numFmt = metric.unit === "s" ? "#,##0" : "#,##0.00";
    row.getCell(2).value = `${metric.label} (${metric.unit})`;
    row.getCell(3).value = metric.domestico ?? "—";
    if (typeof metric.domestico === "number") row.getCell(3).numFmt = numFmt;
    row.getCell(4).value = metric.internacional ?? "—";
    if (typeof metric.internacional === "number") {
      row.getCell(4).numFmt = numFmt;
    }
    row.getCell(5).value =
      users.length === 0
        ? "—"
        : users
            .map((entry) => {
              const natures = naturesUsedOnRow(entry, pmd.id)
                .map((nature) => (nature === "internacional" ? "int." : "dom."))
                .join("/");
              return `${entry.title}${natures ? ` (${natures})` : ""}`;
            })
            .join(", ");
    fillRow(row, COLORS.sand, 1, width);
  }
}

const TSEC_EXCEL_NAME =
  TSEC_MANUAL_LABEL.charAt(0).toUpperCase() + TSEC_MANUAL_LABEL.slice(1);

const TSEC_EXCEL_CITATION =
  `Manual de Anteprojeto (ANAC). ${TSEC_EXCEL_NAME}, em segundos. Padrão do requisito de equipamentos na falta de outro tempo informado.`;

function tsecExcelFieldLabel(label: string): string {
  const marker = " · ";
  const at = label.indexOf(marker);
  return at === -1 ? TSEC_EXCEL_NAME : `${TSEC_EXCEL_NAME}${label.slice(at)}`;
}

function writeManual(
  sheet: ExcelJS.Worksheet,
  manual: ManualExcelLayout,
  model: ExcelModel,
  width: number,
): void {
  const airport = model.airport ?? defaultAirport();
  const rows = pmdRows(airport);
  titleRow(
    sheet.getRow(manual.headerRow),
    `Manual de Anteprojeto — ${TSEC_MANUAL_LABEL}`,
    COLORS.slate,
    width,
  );
  const note = sheet.getRow(manual.noteRow);
  note.getCell(1).value =
    "Valores de referência do Anexo B. Na falta de outro tempo informado, são o padrão do requisito de equipamentos.";
  note.getCell(1).alignment = { wrapText: true, vertical: "middle" };
  sheet.mergeCells(manual.noteRow, 1, manual.noteRow, width);
  fillRow(note, COLORS.paper, 1, width);
  note.height = 32;
  colHeaders(
    sheet.getRow(manual.colHeaderRow),
    ["Componente", "Doméstico (s)", "Internacional (s)", "Usado por"],
    COLORS.slate,
  );

  for (const item of manual.rows) {
    const pmd = rows.find((row) => row.id === item.pmdId);
    if (!pmd) continue;
    const metric = pmdMetrics(pmd).find((entry) => entry.key === item.metricKey);
    if (!metric) continue;
    const users = usedByPmd(model.registry, pmd.id);
    const row = sheet.getRow(item.row);
    row.getCell(1).value = pmd.title;
    row.getCell(2).value = metric.domestico ?? "—";
    if (typeof metric.domestico === "number") row.getCell(2).numFmt = "#,##0";
    row.getCell(3).value = metric.internacional ?? "—";
    if (typeof metric.internacional === "number") {
      row.getCell(3).numFmt = "#,##0";
    }
    row.getCell(4).value =
      users.length === 0
        ? "—"
        : users
            .map((entry) => {
              const natures = naturesUsedOnRow(entry, pmd.id)
                .map((nature) => (nature === "internacional" ? "int." : "dom."))
                .join("/");
              return `${entry.title}${natures ? ` (${natures})` : ""}`;
            })
            .join(", ");
    fillRow(row, COLORS.sand, 1, width);
  }
}

function writeSummaryStatusFormatting(
  sheet: ExcelJS.Worksheet,
  layout: ExcelHeaderLayout,
  contracts: ComponentContract[],
): void {
  const first = contracts[0];
  const last = contracts[contracts.length - 1];
  if (!first || !last) return;
  const firstCell = `B${layout.summary.rows[first.id]}`;
  const summaryRef = `${firstCell}:B${layout.summary.rows[last.id]}`;
  sheet.addConditionalFormatting({
    ref: summaryRef,
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: [`${firstCell}="Atende"`],
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: { argb: COLORS.green },
          },
        },
      },
      {
        type: "expression",
        priority: 2,
        formulae: [`${firstCell}="Não atende"`],
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: { argb: COLORS.red },
          },
        },
      },
    ],
  });
}

async function downloadWorkbook(
  workbook: ExcelJS.Workbook,
  filenameBase: string,
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, stampFilename(filenameBase, "xlsx"));
}

function createWorkbook(
  generatedAt: Date,
  sheetName: string,
  widths: number[],
): { workbook: ExcelJS.Workbook; sheet: ExcelJS.Worksheet } {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Airport Capacity";
  workbook.created = generatedAt;
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: false, showRowColHeaders: true }],
  });
  sheet.columns = widths.map((width) => ({ width }));
  return { workbook, sheet };
}

function writeDashOrNumber(
  cell: ExcelJS.Cell,
  value: number | undefined,
  enabled: boolean,
): void {
  if (!enabled || value === undefined) {
    cell.value = "—";
    return;
  }
  cell.value = value;
  cell.numFmt = "#,##0.00";
}

function connectionDemandId(
  inputs: NatureAreaRowLayout["inputs"],
): ComponentParamId | undefined {
  if (inputs.demandaPicoConexaoDesembarqueDomestico) {
    return "demandaPicoConexaoDesembarqueDomestico";
  }
  if (inputs.demandaPicoConexaoDesembarqueInternacional) {
    return "demandaPicoConexaoDesembarqueInternacional";
  }
  if (inputs.demandaPicoConexao) return "demandaPicoConexao";
  return undefined;
}

function connectionResultId(
  results: NatureAreaRowLayout["results"],
): "areaMinimaConexaoDomestico" | "areaMinimaConexaoInternacional" | "areaMinimaConexao" | undefined {
  if (results.areaMinimaConexaoDomestico) return "areaMinimaConexaoDomestico";
  if (results.areaMinimaConexaoInternacional) {
    return "areaMinimaConexaoInternacional";
  }
  if (results.areaMinimaConexao) return "areaMinimaConexao";
  return undefined;
}

function connectionRowLabel(
  title: string,
  demandId: ComponentParamId | undefined,
): string {
  if (demandId === "demandaPicoConexaoDesembarqueDomestico") {
    return `${title} · conexão DOM/INT`;
  }
  if (demandId === "demandaPicoConexaoDesembarqueInternacional") {
    return `${title} · conexão INT/DOM + INT/INT`;
  }
  return `${title} · conexões`;
}

function writeConnectionAreaRow(
  sheet: ExcelJS.Worksheet,
  contract: ComponentContract,
  evaluation: Evaluation,
  flowBlock: NatureAreaRowLayout,
): void {
  const demandId = connectionDemandId(flowBlock.inputs) ?? "demandaPicoConexao";
  const resultId = connectionResultId(flowBlock.results) ?? "areaMinimaConexao";
  const formula = contract.formulas.find((item) => item.id === resultId);
  const empId = Object.keys(flowBlock.inputs).find((id) =>
    id.startsWith("espacoMinimoPorPassageiro"),
  ) as ComponentParamId | undefined;
  const toiId = Object.keys(flowBlock.inputs).find((id) =>
    id.startsWith("tempoDeOcupacao"),
  ) as ComponentParamId | undefined;
  const flowRow = sheet.getRow(flowBlock.row);
  flowRow.getCell(1).value = connectionRowLabel(contract.title, demandId);
  flowRow.getCell(2).value = evaluation.inputs[demandId];
  flowRow.getCell(2).numFmt = "#,##0.00";
  flowRow.getCell(3).value = "—";
  if (empId) {
    flowRow.getCell(4).value = evaluation.inputs[empId];
    flowRow.getCell(4).numFmt = "#,##0.00";
    flowRow.getCell(5).value =
      contract.params.find((field) => field.id === empId)?.unit ?? "m²/ocup";
  } else {
    flowRow.getCell(4).value = "—";
    flowRow.getCell(5).value = "—";
  }
  if (toiId) {
    flowRow.getCell(6).value = evaluation.inputs[toiId];
    flowRow.getCell(6).numFmt = "#,##0.00";
  } else {
    flowRow.getCell(6).value = "—";
  }
  writeDashOrNumber(flowRow.getCell(7), undefined, false);
  flowRow.getCell(8).value = "—";
  flowRow.getCell(9).value = "—";
  flowRow.getCell(10).value = "—";
  flowRow.getCell(11).value = "—";
  flowRow.getCell(12).value = "—";
  flowRow.getCell(13).value = "—";
  if (formula) {
    flowRow.getCell(14).value = {
      formula: formula.toExcel(flowBlock.inputs),
      result: evaluation.results[resultId],
    };
    flowRow.getCell(14).numFmt = "#,##0.00";
  } else {
    flowRow.getCell(14).value = "—";
  }
  flowRow.getCell(15).value = "—";
  flowRow.getCell(16).value = "—";
  flowRow.getCell(17).value = "—";
  writeDashOrNumber(
    flowRow.getCell(18),
    evaluation.inputs.taxaDeUsoArea,
    usesAreaTaxa(contract.requirements),
  );
  if (usesAreaTaxa(contract.requirements)) {
    flowRow.getCell(18).numFmt = "0.00";
  }
  fillRow(flowRow, COLORS.paper, 1, NATURE_AREA_COLUMNS);
}

function writeEquipmentFlowRow(
  sheet: ExcelJS.Worksheet,
  contract: ComponentContract,
  evaluation: Evaluation,
  flowBlock: NatureEquipmentRowLayout,
): void {
  const flowRow = sheet.getRow(flowBlock.row);
  const demandId = Object.keys(flowBlock.inputs).find(
    (id) =>
      id.startsWith("demandaPico") && !id.startsWith("demandaPicoConexao"),
  ) as ComponentParamId | undefined;
  const connectionId = connectionDemandId(flowBlock.inputs);
  const toiId = Object.keys(flowBlock.inputs).find((id) =>
    id.startsWith("tempoDeOcupacao"),
  ) as ComponentParamId | undefined;
  flowRow.getCell(1).value = `${contract.title} · ${flowBlock.label ?? "fluxo"}`;
  if (demandId) {
    flowRow.getCell(2).value = evaluation.inputs[demandId];
    flowRow.getCell(2).numFmt = "#,##0.00";
  } else {
    flowRow.getCell(2).value = "—";
  }
  if (connectionId) {
    flowRow.getCell(3).value = evaluation.inputs[connectionId];
    flowRow.getCell(3).numFmt = "#,##0.00";
  } else {
    flowRow.getCell(3).value = "—";
  }
  const tsecId = Object.keys(flowBlock.inputs).find((id) =>
    id.startsWith("tsec"),
  ) as ComponentParamId | undefined;
  if (tsecId && flowBlock.inputs[tsecId] === `D${flowBlock.row}`) {
    flowRow.getCell(4).value = evaluation.inputs[tsecId];
    flowRow.getCell(4).numFmt = "#,##0.00";
  } else {
    flowRow.getCell(4).value = "—";
  }
  if (toiId) {
    flowRow.getCell(5).value = evaluation.inputs[toiId];
    flowRow.getCell(5).numFmt = "#,##0.00";
  } else {
    flowRow.getCell(5).value = "—";
  }
  flowRow.getCell(6).value = "—";
  flowRow.getCell(7).value = "—";
  flowRow.getCell(8).value = "—";
  flowRow.getCell(9).value = "—";
  fillRow(flowRow, COLORS.paper, 1, NATURE_EQUIPMENT_COLUMNS);
}

function exportByComponent(model: ExcelModel): ExcelJS.Workbook {
  const layout: SingleSheetLayout = getSingleSheetLayout(
    model.contracts,
    model.airport ?? defaultAirport(),
  );
  const { workbook, sheet } = createWorkbook(model.generatedAt, layout.sheetName, [
    42, 22, 18, 64, 36,
  ]);

  writeIdentity(sheet, layout, model, 5);

  titleRow(
    sheet.getRow(layout.summary.titleRow),
    "Resumo — atende / não atende",
    COLORS.navy,
  );
  colHeaders(
    sheet.getRow(layout.summary.colHeaderRow),
    ["Componente", "Status", "Saturação (%)"],
    "FF3D4A58",
  );

  for (const contract of model.contracts) {
    const evaluation = model.evaluations[contract.id];
    const block = layout.components[contract.id];
    const row = sheet.getRow(layout.summary.rows[contract.id]);
    const check =
      evaluation.areaCheck ??
      evaluation.equipmentCheck ??
      evaluation.esteiraCheck;
    const statusCell = block.checkRow
      ? `B${block.checkRow}`
      : block.beltCheckRow
        ? `B${block.beltCheckRow}`
        : null;

    row.getCell(1).value = contract.title;
    if (statusCell) {
      row.getCell(2).value = {
        formula: statusCell,
        result: check?.label ?? "—",
      };
    } else if (check) {
      row.getCell(2).value = check.label;
    } else {
      row.getCell(2).value = "Sem requisito";
    }
    writeDashOrNumber(
      row.getCell(3),
      check?.saturacao,
      check != null && Number.isFinite(check.saturacao),
    );
    fillRow(
      row,
      check == null
        ? COLORS.sand
        : requirementsMet(evaluation)
          ? COLORS.green
          : COLORS.red,
    );
  }

  writePmd(sheet, layout.sizing, model, 5);
  writeManual(sheet, layout.manual, model, 5);

  for (const contract of model.contracts) {
    const evaluation = model.evaluations[contract.id];
    const block = layout.components[contract.id];
    const band = block.band === "even" ? COLORS.paper : COLORS.alt;

    titleRow(sheet.getRow(block.titleRow), contract.title, COLORS.navy);
    colHeaders(
      sheet.getRow(block.colHeaderRow),
      ["Campo", "Valor", "Unidade", "Origem", "Notas"],
      "FF3D4A58",
    );

    for (const field of contract.params) {
      const rowIndex = block.inputRows[field.id];
      if (rowIndex === undefined) continue;
      const row = sheet.getRow(rowIndex);
      row.getCell(1).value = isTsecParam(field.id)
        ? tsecExcelFieldLabel(field.label)
        : field.label;
      row.getCell(2).value = evaluation.inputs[field.id];
      row.getCell(2).numFmt = isTaxaParam(field.id) ? "0.00" : "#,##0.00";
      row.getCell(3).value = field.unit;
      row.getCell(4).value =
        field.id.startsWith("demandaPicoConexao")
          ? field.origem
          : (model.componentOrigens[contract.id]?.[field.id] ?? field.origem);
      if (isSizingParam(field.id)) {
        const entry = model.registry.find((item) => item.id === contract.id);
        const just = model.justificativas[contract.id]?.[field.id] ?? "";
        const contractMeta = resolveContractValue(
          entry,
          field,
          model.airport ?? defaultAirport(),
        );
        const sourceRef = entry
          ? resolvedSources(entry)[field.id]
          : undefined;
        row.getCell(5).value = just.trim()
          ? `Fora do PMD (${contractMeta.value}). ${just}`
          : sourceRef
            ? pmdOrigem(sourceRef, model.airport ?? defaultAirport())
            : "Valor próprio, sem PMD";
      } else if (isTsecParam(field.id)) {
        const entry = model.registry.find((item) => item.id === contract.id);
        const standard = entry ? standardTsecForParam(entry, field.id) : null;
        const just = model.justificativas[contract.id]?.[field.id] ?? "";
        const value = evaluation.inputs[field.id];
        if (standard != null && value !== standard) {
          row.getCell(5).value = just.trim()
            ? `Fora do Manual de Anteprojeto (${TSEC_EXCEL_NAME}, ${standard} s). ${just.trim()}`
            : `Fora do Manual de Anteprojeto (${TSEC_EXCEL_NAME}, ${standard} s).`;
        } else if (standard != null) {
          row.getCell(5).value = TSEC_EXCEL_CITATION;
        } else {
          row.getCell(5).value = "Atributo do componente";
        }
      } else if (isBeltManualParam(field.id)) {
        const standard = beltManualStandard(field.id);
        const just = model.justificativas[contract.id]?.[field.id] ?? "";
        const value = evaluation.inputs[field.id];
        if (value !== standard) {
          row.getCell(5).value = just.trim()
            ? `Fora do Manual de Anteprojeto (${standard} ${field.unit}). ${just.trim()}`
            : `Fora do Manual de Anteprojeto (${standard} ${field.unit}).`;
        } else {
          row.getCell(5).value = "Manual de Anteprojeto.";
        }
      } else {
        row.getCell(5).value = isTaxaParam(field.id)
          ? "Atributo do requisito"
          : "Atributo do componente";
      }
      fillRow(row, band);
    }

    const notes = sheet.getRow(block.notesRow);
    notes.getCell(1).value = "Observações";
    notes.getCell(2).value =
      model.registry.find((item) => item.id === contract.id)?.observacoes ?? "";
    notes.getCell(2).alignment = { wrapText: true, vertical: "top" };
    notes.getCell(5).value = "Atributo do componente";
    fillRow(notes, band);

    for (const formula of contract.formulas) {
      const rowIndex = block.resultRows[formula.id];
      if (rowIndex === undefined) continue;
      const row = sheet.getRow(rowIndex);
      row.getCell(1).value = formula.label;
      row.getCell(1).font = { bold: true };
      row.getCell(2).value = {
        formula: formula.toExcel(block.inputs),
        result: evaluation.results[formula.id],
      };
      row.getCell(2).numFmt =
        formula.id === "numeroMinimoEquipamentos" ? "#,##0" : "#,##0.00";
      row.getCell(2).font = { bold: true };
      row.getCell(3).value = formula.unit;
      row.getCell(4).value = `${formula.origem} Fórmula: ${formula.expression}`;
      fillRow(row, COLORS.result);
    }

    if (block.checkRow !== null && evaluation.areaCheck) {
      const row = sheet.getRow(block.checkRow);
      row.getCell(1).value = areaCheckContract.label;
      row.getCell(1).font = { bold: true };
      row.getCell(2).value = {
        formula: areaCheckContract.toExcel(block),
        result: evaluation.areaCheck.label,
      };
      row.getCell(3).value = "—";
      row.getCell(4).value = areaCheckContract.origem;
      fillRow(
        row,
        evaluation.areaCheck.atende ? COLORS.green : COLORS.red,
      );
    }

    if (block.beltCheckRow !== null && evaluation.esteiraCheck) {
      const row = sheet.getRow(block.beltCheckRow);
      row.getCell(1).value = beltCheckContract.label;
      row.getCell(1).font = { bold: true };
      row.getCell(2).value = {
        formula: beltCheckContract.toExcel(block),
        result: evaluation.esteiraCheck.label,
      };
      row.getCell(3).value = "—";
      row.getCell(4).value = beltCheckContract.origem;
      fillRow(
        row,
        evaluation.esteiraCheck.atende ? COLORS.green : COLORS.red,
      );
    }
  }

  writeSummaryStatusFormatting(sheet, layout, model.contracts);
  return workbook;
}

function exportByNature(model: ExcelModel): ExcelJS.Workbook {
  const layout: NatureSheetLayout = getNatureSheetLayout(
    model.contracts,
    model.airport ?? defaultAirport(),
  );
  const { workbook, sheet } = createWorkbook(model.generatedAt, layout.sheetName, [
    36, 16, 16, 14, 14, 12, 10, 12, 14, 14, 16, 14, 14, 16, 14, 16,
  ]);

  writeIdentity(sheet, layout, model, NATURE_AREA_COLUMNS);

  titleRow(
    sheet.getRow(layout.summary.titleRow),
    "Resumo — atende / não atende",
    COLORS.navy,
    NATURE_AREA_COLUMNS,
  );
  colHeaders(
    sheet.getRow(layout.summary.colHeaderRow),
    ["Componente", "Status", "Saturação (%)"],
    "FF3D4A58",
  );

  for (const contract of model.contracts) {
    const evaluation = model.evaluations[contract.id];
    const areaRow = layout.area?.rows[contract.id];
    const row = sheet.getRow(layout.summary.rows[contract.id]);
    const check =
      evaluation.areaCheck ??
      evaluation.equipmentCheck ??
      evaluation.esteiraCheck;

    row.getCell(1).value = contract.title;
    if (areaRow) {
      row.getCell(2).value = {
        formula: areaRow.statusCell,
        result: evaluation.areaCheck?.label ?? "—",
      };
    } else if (check) {
      row.getCell(2).value = check.label;
    } else {
      row.getCell(2).value = "Sem requisito";
    }
    writeDashOrNumber(
      row.getCell(3),
      check?.saturacao,
      check != null && Number.isFinite(check.saturacao),
    );
    fillRow(
      row,
      check == null
        ? COLORS.sand
        : requirementsMet(evaluation)
          ? COLORS.green
          : COLORS.red,
      1,
      NATURE_AREA_COLUMNS,
    );
  }

  writePmd(sheet, layout.sizing, model, NATURE_AREA_COLUMNS);
  writeManual(sheet, layout.manual, model, NATURE_AREA_COLUMNS);

  if (layout.area) {
    titleRow(
      sheet.getRow(layout.area.titleRow),
      "Requisitos de área",
      COLORS.navy,
      NATURE_AREA_COLUMNS,
    );
    const note = sheet.getRow(layout.area.noteRow);
    note.getCell(1).value =
      `${areaFormulaDisplay(false)}. Com acompanhante: ${areaFormulaDisplay(true)}. Saguão combinado: ${dualAreaFormulaDisplay(true)}. Natureza mista: ${mixedAreaFormulaDisplay(true, 2)} ou ${mixedAreaFormulaDisplay(true, 4)}. Desembarque misto: ${mixedAreaFormulaDisplay(true, 2, false, false, true)}. Desembarque misto com conexão: ${mixedAreaFormulaDisplay(true, 2, false, true, true)}. Sala de desembarque mista: ${mixedAreaFormulaDisplay(false, 2, false, false, true)}. Check-in misto: ${singleFunctionMixedFormulaDisplay(false)}. Sala de embarque sentado e em pé: ${splitLoungeFormulaDisplay(false)}.`;
    note.getCell(1).alignment = { wrapText: true, vertical: "middle" };
    sheet.mergeCells(
      layout.area.noteRow,
      1,
      layout.area.noteRow,
      NATURE_AREA_COLUMNS,
    );
    fillRow(note, COLORS.paper, 1, NATURE_AREA_COLUMNS);
    note.height = 68;
    colHeaders(
      sheet.getRow(layout.area.colHeaderRow),
      [
        "Componente",
        "DHp / DHp embarque",
        "DHp desembarque",
        "Emp / Emp embarque",
        "Unidade Emp",
        "Toi / Toi embarque",
        "v.a.",
        "% assentos",
        "Emp desembarque",
        "Toi desembarque",
        "Área medida (m²)",
        "Ad embarque",
        "Ad desembarque",
        "Ad (m²)",
        "Assentos mín.",
        "Status",
        "v.a. desembarque",
        "Taxa de utilização (%)",
        "Emp em pé",
        "Toi em pé",
        "Ocupação máxima (Ocup_max)",
      ],
      "FF3D4A58",
    );

    for (const contract of model.contracts) {
      const block = layout.area.rows[contract.id];
      if (!block) continue;
      const evaluation = model.evaluations[contract.id];
      const mixedFlows = layout.area.flowRows[contract.id];
      if (mixedFlows && mixedFlows.length > 0) {
        mixedSpecsForParams(contract.params).forEach((spec, index) => {
          const flowBlock = mixedFlows[index];
          if (!flowBlock) return;
          const flowRow = sheet.getRow(flowBlock.row);
          const formula = contract.formulas.find((item) => item.id === spec.area);
          flowRow.getCell(1).value = `${contract.title} · ${mixedFlowLabel(spec)}`;
          flowRow.getCell(2).value = evaluation.inputs[spec.demanda];
          flowRow.getCell(2).numFmt = "#,##0.00";
          flowRow.getCell(3).value = "—";
          flowRow.getCell(4).value = evaluation.inputs[spec.emp];
          flowRow.getCell(4).numFmt = "#,##0.00";
          flowRow.getCell(5).value =
            contract.params.find((field) => field.id === spec.emp)?.unit ?? "m²/ocup";
          flowRow.getCell(6).value = evaluation.inputs[spec.toi];
          flowRow.getCell(6).numFmt = "#,##0.00";
          writeDashOrNumber(
            flowRow.getCell(7),
            evaluation.inputs[spec.va],
            contract.requirements.area?.companions === true,
          );
          flowRow.getCell(8).value = "—";
          flowRow.getCell(9).value = "—";
          flowRow.getCell(10).value = "—";
          flowRow.getCell(11).value = "—";
          flowRow.getCell(12).value = "—";
          flowRow.getCell(13).value = "—";
          if (formula) {
            flowRow.getCell(14).value = {
              formula: formula.toExcel(flowBlock.inputs),
              result: evaluation.results[spec.area],
            };
            flowRow.getCell(14).numFmt = "#,##0.00";
          }
          flowRow.getCell(15).value = "—";
          flowRow.getCell(16).value = "—";
          flowRow.getCell(17).value = "—";
          writeDashOrNumber(
            flowRow.getCell(18),
            evaluation.inputs.taxaDeUsoArea,
            usesAreaTaxa(contract.requirements),
          );
          if (usesAreaTaxa(contract.requirements)) {
            flowRow.getCell(18).numFmt = "0.00";
          }
          fillRow(flowRow, COLORS.paper, 1, NATURE_AREA_COLUMNS);
        });
        for (const connectionBlock of mixedFlows) {
          if (!connectionDemandId(connectionBlock.inputs)) continue;
          writeConnectionAreaRow(sheet, contract, evaluation, connectionBlock);
        }
      }

      const row = sheet.getRow(block.row);
      const companions = contract.requirements.area?.companions === true;
      const seats = hasResult(contract, "assentosMinimos");
      const splitLounge = contract.params.some(
        (field) => field.id === "percentualOcupacaoMaxima",
      );
      const mixed = isMixedNatureContract(contract);
      const dual = isDualContract(contract) && !mixed;
      const empField = contract.params.find(
        (field) =>
          field.id ===
          (dual
            ? "espacoMinimoPorPassageiroEmbarque"
            : "espacoMinimoPorPassageiro"),
      );
      const ad = contract.formulas.find((formula) => formula.id === "areaMinima");
      const adEmbarque = contract.formulas.find(
        (formula) => formula.id === "areaMinimaEmbarque",
      );
      const adDesembarque = contract.formulas.find(
        (formula) => formula.id === "areaMinimaDesembarque",
      );
      const seatsFormula = contract.formulas.find(
        (formula) => formula.id === "assentosMinimos",
      );

      row.getCell(1).value = mixed
        ? `${contract.title} · total`
        : contract.title;
      if (mixed) {
        for (let col = 2; col <= 10; col += 1) {
          row.getCell(col).value = "—";
        }
        row.getCell(17).value = "—";
        writeDashOrNumber(
          row.getCell(18),
          evaluation.inputs.taxaDeUsoArea,
          usesAreaTaxa(contract.requirements),
        );
        if (usesAreaTaxa(contract.requirements)) {
          row.getCell(18).numFmt = "0.00";
        }
        row.getCell(11).value = evaluation.inputs.areaMedida;
        row.getCell(11).numFmt = "#,##0.00";
        row.getCell(12).value = "—";
        row.getCell(13).value = "—";
        if (ad) {
          row.getCell(14).value = {
            formula: ad.toExcel(block.inputs),
            result: evaluation.results.areaMinima,
          };
          row.getCell(14).numFmt = "#,##0.00";
          row.getCell(14).font = { bold: true };
        }
        row.getCell(15).value = "—";
        if (evaluation.areaCheck) {
          row.getCell(16).value = {
            formula: areaCheckContract.toExcel({
              inputs: block.inputs,
              results: block.results,
            }),
            result: evaluation.areaCheck.label,
          };
        } else {
          row.getCell(16).value = "—";
        }
        fillRow(
          row,
          evaluation.areaCheck == null
            ? COLORS.paper
            : evaluation.areaCheck.atende
              ? COLORS.green
              : COLORS.red,
          1,
          NATURE_AREA_COLUMNS,
        );
        continue;
      }
      if (dual) {
        row.getCell(2).value = evaluation.inputs.demandaPicoEmbarque;
        row.getCell(3).value = evaluation.inputs.demandaPicoDesembarque;
        row.getCell(4).value = evaluation.inputs.espacoMinimoPorPassageiroEmbarque;
        row.getCell(6).value = evaluation.inputs.tempoDeOcupacaoEmbarque;
        row.getCell(9).value = evaluation.inputs.espacoMinimoPorPassageiroDesembarque;
        row.getCell(10).value = evaluation.inputs.tempoDeOcupacaoDesembarque;
      } else {
        row.getCell(2).value = evaluation.inputs.demandaPico;
        row.getCell(3).value = "—";
        row.getCell(4).value = evaluation.inputs.espacoMinimoPorPassageiro;
        row.getCell(6).value = evaluation.inputs.tempoDeOcupacao;
        row.getCell(9).value = "—";
        row.getCell(10).value = "—";
      }
      row.getCell(2).numFmt = "#,##0.00";
      if (dual) row.getCell(3).numFmt = "#,##0.00";
      row.getCell(4).numFmt = "#,##0.00";
      row.getCell(5).value = empField?.unit ?? "—";
      row.getCell(6).numFmt = "#,##0.00";
      writeDashOrNumber(
        row.getCell(7),
        dual ? evaluation.inputs.vaEmbarque : evaluation.inputs.va,
        companions,
      );
      writeDashOrNumber(
        row.getCell(17),
        dual ? evaluation.inputs.vaDesembarque : Number.NaN,
        dual && companions,
      );
      writeDashOrNumber(
        row.getCell(18),
        evaluation.inputs.taxaDeUsoArea,
        usesAreaTaxa(contract.requirements),
      );
      if (usesAreaTaxa(contract.requirements)) {
        row.getCell(18).numFmt = "0.00";
      }
      writeDashOrNumber(
        row.getCell(8),
        evaluation.inputs.percentualMinimoAssentos,
        seats || splitLounge,
      );
      writeDashOrNumber(
        row.getCell(19),
        evaluation.inputs.espacoMinimoEmPe,
        splitLounge,
      );
      writeDashOrNumber(
        row.getCell(20),
        evaluation.inputs.tempoDeOcupacaoEmPe,
        splitLounge,
      );
      writeDashOrNumber(
        row.getCell(21),
        evaluation.inputs.percentualOcupacaoMaxima,
        splitLounge,
      );
      if (dual) {
        row.getCell(9).numFmt = "#,##0.00";
        row.getCell(10).numFmt = "#,##0.00";
      }
      row.getCell(11).value = evaluation.inputs.areaMedida;
      row.getCell(11).numFmt = "#,##0.00";
      if (adEmbarque) {
        row.getCell(12).value = {
          formula: adEmbarque.toExcel(block.inputs),
          result: evaluation.results.areaMinimaEmbarque,
        };
        row.getCell(12).numFmt = "#,##0.00";
      } else {
        row.getCell(12).value = "—";
      }
      if (adDesembarque) {
        row.getCell(13).value = {
          formula: adDesembarque.toExcel(block.inputs),
          result: evaluation.results.areaMinimaDesembarque,
        };
        row.getCell(13).numFmt = "#,##0.00";
      } else {
        row.getCell(13).value = "—";
      }
      if (ad) {
        row.getCell(14).value = {
          formula: ad.toExcel(block.inputs),
          result: evaluation.results.areaMinima,
        };
        row.getCell(14).numFmt = "#,##0.00";
        row.getCell(14).font = { bold: true };
      }
      if (seats && seatsFormula) {
        row.getCell(15).value = {
          formula: seatsFormula.toExcel(block.inputs),
          result: evaluation.results.assentosMinimos,
        };
        row.getCell(15).numFmt = "#,##0.00";
      } else {
        row.getCell(15).value = "—";
      }
      if (evaluation.areaCheck) {
        row.getCell(16).value = {
          formula: areaCheckContract.toExcel({
            inputs: block.inputs,
            results: block.results,
          }),
          result: evaluation.areaCheck.label,
        };
      } else {
        row.getCell(16).value = "—";
      }
      fillRow(
        row,
        evaluation.areaCheck == null
          ? COLORS.paper
          : evaluation.areaCheck.atende
            ? COLORS.green
            : COLORS.red,
        1,
        NATURE_AREA_COLUMNS,
      );
    }
  }

  if (layout.equipment) {
    titleRow(
      sheet.getRow(layout.equipment.titleRow),
      "Requisitos de equipamentos",
      COLORS.navy,
      NATURE_AREA_COLUMNS,
    );
    const equipmentFormula = model.contracts
      .flatMap((contract) => contract.formulas)
      .find((formula) => formula.id === "numeroMinimoEquipamentos");
    const note = sheet.getRow(layout.equipment.noteRow);
    note.getCell(1).value = equipmentFormula
      ? `${equipmentFormula.label}: ${equipmentFormula.expression}. Cada fluxo usa o seu Toi e o seu tsec.`
      : "Número mínimo de equipamentos.";
    note.getCell(1).alignment = { wrapText: true, vertical: "middle" };
    sheet.mergeCells(
      layout.equipment.noteRow,
      1,
      layout.equipment.noteRow,
      NATURE_AREA_COLUMNS,
    );
    fillRow(note, COLORS.paper, 1, NATURE_AREA_COLUMNS);
    note.height = 32;
    colHeaders(
      sheet.getRow(layout.equipment.colHeaderRow),
      [
        "Componente",
        "DHp / DHp embarque",
        "DHp desembarque",
        "Tsec (s)",
        "Tempo de ocupação (min)",
        "Nº mín. equipamentos",
        "DHp desembarque doméstico",
        "DHp desembarque internacional",
        "Taxa de utilização (%)",
      ],
      "FF3D4A58",
    );

    for (const contract of model.contracts) {
      const block = layout.equipment.rows[contract.id];
      if (!block) continue;
      const evaluation = model.evaluations[contract.id];
      const row = sheet.getRow(block.row);
      const dual = isDualContract(contract);
      const mixed = isMixedNatureContract(contract);
      const formula = contract.formulas.find(
        (item) => item.id === "numeroMinimoEquipamentos",
      );
      const areaInputs = layout.area?.rows[contract.id]?.inputs;
      const flowBlocks = layout.equipment.flowRows[contract.id] ?? [];
      for (const flowBlock of flowBlocks) {
        writeEquipmentFlowRow(sheet, contract, evaluation, flowBlock);
      }

      row.getCell(1).value = contract.title;
      if (flowBlocks.length > 0) {
        row.getCell(2).value = "—";
        row.getCell(3).value = "—";
        row.getCell(5).value = "—";
        row.getCell(7).value = "—";
        row.getCell(8).value = "—";
      } else if (mixed) {
        const mixedFlows = layout.area?.flowRows[contract.id];
        if (mixedFlows && mixedFlows.length > 0) {
          row.getCell(2).value = "—";
          row.getCell(3).value = "—";
        } else if (
          contract.params.some((field) => field.id === "demandaPicoDomestico")
        ) {
          row.getCell(2).value = evaluation.inputs.demandaPicoDomestico;
          row.getCell(3).value = evaluation.inputs.demandaPicoInternacional;
          row.getCell(3).numFmt = "#,##0.00";
        } else {
          row.getCell(2).value = evaluation.inputs.demandaPicoEmbarqueDomestico;
          row.getCell(3).value = evaluation.inputs.demandaPicoEmbarqueInternacional;
          row.getCell(3).numFmt = "#,##0.00";
          if (
            contract.params.some(
              (field) => field.id === "demandaPicoDesembarqueDomestico",
            )
          ) {
            row.getCell(7).value =
              evaluation.inputs.demandaPicoDesembarqueDomestico;
            row.getCell(8).value =
              evaluation.inputs.demandaPicoDesembarqueInternacional;
            row.getCell(7).numFmt = "#,##0.00";
            row.getCell(8).numFmt = "#,##0.00";
          }
        }
      } else if (dual) {
        if (areaInputs?.demandaPicoEmbarque) {
          row.getCell(2).value = {
            formula: areaInputs.demandaPicoEmbarque,
            result: evaluation.inputs.demandaPicoEmbarque,
          };
        } else {
          row.getCell(2).value = evaluation.inputs.demandaPicoEmbarque;
        }
        if (areaInputs?.demandaPicoDesembarque) {
          row.getCell(3).value = {
            formula: areaInputs.demandaPicoDesembarque,
            result: evaluation.inputs.demandaPicoDesembarque,
          };
        } else {
          row.getCell(3).value = evaluation.inputs.demandaPicoDesembarque;
        }
        row.getCell(3).numFmt = "#,##0.00";
      } else if (areaInputs?.demandaPico) {
        row.getCell(2).value = {
          formula: areaInputs.demandaPico,
          result: evaluation.inputs.demandaPico,
        };
        row.getCell(3).value = "—";
      } else {
        row.getCell(2).value = evaluation.inputs.demandaPico;
        row.getCell(3).value = "—";
      }
      row.getCell(2).numFmt = "#,##0.00";
      if (block.inputs.demandaPicoConexao === `G${block.row}`) {
        row.getCell(7).value = evaluation.inputs.demandaPicoConexao;
        row.getCell(7).numFmt = "#,##0.00";
      }
      if (flowBlocks.length > 0) {
        row.getCell(4).value = "—";
      } else {
        row.getCell(4).value = evaluation.inputs.tsec;
        row.getCell(4).numFmt = "#,##0.00";
      }
      if (flowBlocks.length === 0) {
        const toiId = (contract.equipmentTerms ?? []).find(
          (term) => block.inputs[term.toi],
        )?.toi;
        const singleToi =
          (contract.equipmentTerms ?? []).length <= 1 ? toiId : undefined;
        const toiCell = singleToi ? block.inputs[singleToi] : undefined;
        if (singleToi && toiCell === `E${block.row}`) {
          row.getCell(5).value = evaluation.inputs[singleToi];
          row.getCell(5).numFmt = "#,##0.00";
        } else if (singleToi && toiCell) {
          row.getCell(5).value = {
            formula: toiCell,
            result: evaluation.inputs[singleToi],
          };
          row.getCell(5).numFmt = "#,##0.00";
        } else {
          row.getCell(5).value = "—";
        }
      }
      writeDashOrNumber(
        row.getCell(9),
        evaluation.inputs.taxaDeUsoEquipamento,
        usesEquipmentTaxa(contract.requirements),
      );
      if (usesEquipmentTaxa(contract.requirements)) {
        row.getCell(9).numFmt = "0.00";
      }
      if (formula) {
        row.getCell(6).value = {
          formula: formula.toExcel(block.inputs),
          result: evaluation.results.numeroMinimoEquipamentos,
        };
        row.getCell(6).numFmt = "#,##0";
        row.getCell(6).font = { bold: true };
      }
      fillRow(row, COLORS.result, 1, NATURE_EQUIPMENT_COLUMNS);
    }
  }

  writeBeltBlock(sheet, layout, model);

  writeSummaryStatusFormatting(sheet, layout, model.contracts);
  return workbook;
}

function writeLinkedMeasure(
  cell: ExcelJS.Cell,
  ref: string | undefined,
  local: string,
  value: number,
) {
  if (ref && ref !== local) {
    cell.value = { formula: ref, result: value };
  } else {
    cell.value = value;
  }
  cell.numFmt = "#,##0.00";
}

function writeBeltBlock(
  sheet: ExcelJS.Worksheet,
  layout: NatureSheetLayout,
  model: ExcelModel,
) {
  if (!layout.belt) return;
  titleRow(
    sheet.getRow(layout.belt.titleRow),
    "Tamanho mínimo de esteira",
    COLORS.navy,
    NATURE_AREA_COLUMNS,
  );
  const expression = model.contracts
    .flatMap((contract) => contract.formulas)
    .find((formula) => formula.id === "comprimentoMinimoEsteira")?.expression;
  const note = sheet.getRow(layout.belt.noteRow);
  note.getCell(1).value = expression
    ? `Comprimento mínimo da esteira: ${expression}. Tr mínimo 30%. Lmp mínimo 0,9 m. Atende se o comprimento somado das esteiras for maior ou igual a C.`
    : "Comprimento mínimo da esteira.";
  note.getCell(1).alignment = { wrapText: true, vertical: "middle" };
  sheet.mergeCells(
    layout.belt.noteRow,
    1,
    layout.belt.noteRow,
    NATURE_AREA_COLUMNS,
  );
  fillRow(note, COLORS.paper, 1, NATURE_AREA_COLUMNS);
  note.height = 32;
  colHeaders(
    sheet.getRow(layout.belt.colHeaderRow),
    [
      "Componente",
      "DHp (pax/h)",
      "Tr (%)",
      "Lmp (m)",
      "Toi (min)",
      "C (m)",
      "Comprimento somado (m)",
      "Atende",
    ],
    "FF3D4A58",
  );

  for (const contract of model.contracts) {
    const block = layout.belt.rows[contract.id];
    if (!block) continue;
    const evaluation = model.evaluations[contract.id];
    const flows = layout.belt.flowRows[contract.id] ?? [];
    for (const flow of flows) {
      const flowRow = sheet.getRow(flow.row);
      flowRow.getCell(1).value = flow.label ?? contract.title;
      const demandId = (Object.keys(flow.inputs) as ComponentParamId[]).find(
        (id) => id.startsWith("demandaPico"),
      );
      const toiId = (Object.keys(flow.inputs) as ComponentParamId[]).find(
        (id) => id.startsWith("tempoDeOcupacao"),
      );
      if (demandId) {
        writeLinkedMeasure(
          flowRow.getCell(2),
          flow.inputs[demandId],
          `B${flow.row}`,
          evaluation.inputs[demandId],
        );
      }
      flowRow.getCell(3).value = "—";
      flowRow.getCell(4).value = "—";
      if (toiId) {
        writeLinkedMeasure(
          flowRow.getCell(5),
          flow.inputs[toiId],
          `E${flow.row}`,
          evaluation.inputs[toiId],
        );
      }
      const partialId = (Object.keys(flow.results) as (keyof typeof flow.results)[]).find(
        (id) => id.startsWith("comprimentoMinimo"),
      );
      const partial = partialId
        ? contract.formulas.find((formula) => formula.id === partialId)
        : undefined;
      if (partial && partialId) {
        flowRow.getCell(6).value = {
          formula: partial.toExcel(flow.inputs),
          result: evaluation.results[partialId],
        };
        flowRow.getCell(6).numFmt = "#,##0.00";
      }
      flowRow.getCell(7).value = "—";
      flowRow.getCell(8).value = "—";
      fillRow(flowRow, COLORS.paper, 1, NATURE_BELT_COLUMNS);
    }

    const row = sheet.getRow(block.row);
    row.getCell(1).value = contract.title;
    if (flows.length > 0) {
      row.getCell(2).value = "—";
      row.getCell(5).value = "—";
    } else {
      const demandId = (Object.keys(block.inputs) as ComponentParamId[]).find(
        (id) => id.startsWith("demandaPico"),
      );
      const toiId = (Object.keys(block.inputs) as ComponentParamId[]).find(
        (id) => id.startsWith("tempoDeOcupacao"),
      );
      if (demandId) {
        writeLinkedMeasure(
          row.getCell(2),
          block.inputs[demandId],
          `B${block.row}`,
          evaluation.inputs[demandId],
        );
      }
      if (toiId) {
        writeLinkedMeasure(
          row.getCell(5),
          block.inputs[toiId],
          `E${block.row}`,
          evaluation.inputs[toiId],
        );
      }
    }
    row.getCell(3).value = evaluation.inputs.taxaRetiradaBagagem;
    row.getCell(3).numFmt = "0.00";
    row.getCell(4).value = evaluation.inputs.comprimentoLinearPassageiro;
    row.getCell(4).numFmt = "0.00";
    const formula = contract.formulas.find(
      (item) => item.id === "comprimentoMinimoEsteira",
    );
    if (formula) {
      row.getCell(6).value = {
        formula: formula.toExcel(block.inputs),
        result: evaluation.results.comprimentoMinimoEsteira,
      };
      row.getCell(6).numFmt = "#,##0.00";
      row.getCell(6).font = { bold: true };
    }
    row.getCell(7).value = evaluation.inputs.comprimentoEsteiras;
    row.getCell(7).numFmt = "#,##0.00";
    if (evaluation.esteiraCheck) {
      row.getCell(8).value = {
        formula: beltCheckContract.toExcel({
          inputs: block.inputs,
          results: block.results,
        }),
        result: evaluation.esteiraCheck.label,
      };
    }
    fillRow(
      row,
      evaluation.esteiraCheck == null
        ? COLORS.paper
        : evaluation.esteiraCheck.atende
          ? COLORS.green
          : COLORS.red,
      1,
      NATURE_BELT_COLUMNS,
    );
  }
}

export async function exportAirportExcel(
  model: ExcelModel,
  kind: ExcelKind = "component",
): Promise<void> {
  const workbook =
    kind === "nature" ? exportByNature(model) : exportByComponent(model);
  await downloadWorkbook(
    workbook,
    kind === "nature" ? "aeroporto-por-natureza" : "aeroporto-por-componente",
  );
}

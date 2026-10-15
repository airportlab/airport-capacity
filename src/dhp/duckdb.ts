import * as duckdb from "@duckdb/duckdb-wasm";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import ehWasm from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import mvpWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import { AIRPORTS } from "../domain/airports";
import {
  BOARDING_FLOW_KEYS,
  type BoardingFlowKey,
  type BoardingHourCounts,
  type BoardingPonderation,
} from "../domain/boardingDhp";
import { readMovimento, writeMovimento } from "./movimentoStore";

const BOARDING_RANK_LIMIT = 500;
const PARQUET_NAME = "movimentacoes.parquet";
const MISSING_FILE = "Envie o arquivo de movimentação na aba DHp.";
const UNREADABLE = "Não foi possível ler o arquivo de movimentação.";
const UNSAVED = "Não foi possível guardar o arquivo de movimentação.";
const REQUIRED_COLUMNS = [
  "DT_CALCO",
  "HH_CALCO",
  "QT_PAX_LOCAL",
  "NR_AEROPORTO_REFERENCIA",
  "NR_MOVIMENTO_TIPO",
  "NR_NATUREZA",
  "QT_PAX_CONEXAO_DOMESTICO",
  "QT_PAX_CONEXAO_INTERNACIONAL",
] as const;
const PLACE_COLUMNS = ["NR_BOX", "NR_TERMINAL"] as const;
const MISSING_PLACE = "O arquivo não tem NR_BOX e NR_TERMINAL.";

const MONTH_CODES = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
] as const;

export interface DhpCoverage {
  dataRecente: string | null;
  periodoInicio: string | null;
  periodoFim: string | null;
}

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
};

export interface BoardingDhpWindow {
  posicao: number;
  inicio: string;
  fim: string;
  demandaPonderada: number;
  counts: BoardingHourCounts;
}

export interface BoardingDhpResult {
  suficiente: boolean;
  quantidadeJanelas: number;
  janelas: BoardingDhpWindow[];
  coverage: DhpCoverage;
}

export interface BoardingPlaceFilter {
  boxes: readonly string[];
  terminals: readonly string[];
}

export interface BoardingPlaceCatalog {
  boxes: string[];
  terminals: string[];
}

export function boardingPlaceActive(filter: BoardingPlaceFilter | undefined): boolean {
  return !!filter && (filter.boxes.length > 0 || filter.terminals.length > 0);
}

const FLOW_SQL: Record<BoardingFlowKey, string> = {
  origemDom: "origem_dom",
  origemInt: "origem_int",
  destinoDom: "destino_dom",
  destinoInt: "destino_int",
  conexaoDomDom: "conexao_dom_dom",
  conexaoIntDom: "conexao_int_dom",
  conexaoDomInt: "conexao_dom_int",
  conexaoIntInt: "conexao_int_int",
  chegadaDomInt: "chegada_dom_int",
  chegadaIntDom: "chegada_int_dom",
  chegadaIntInt: "chegada_int_int",
};

export interface MovimentoState {
  nome: string | null;
  restaurando: boolean;
  enviando: boolean;
  erro: string | null;
}

interface Session {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
}

const listeners = new Set<() => void>();
let state: MovimentoState = {
  nome: null,
  restaurando: false,
  enviando: false,
  erro: null,
};
let session: Session | null = null;
const placeCaches = new Map<string, BoardingPlaceCatalog>();
let tail: Promise<void> = Promise.resolve();
let restoring: Promise<void> | null = null;
let queries = 0;
let idle: Promise<void> = Promise.resolve();
let idleResolve: (() => void) | null = null;

export function movimentoAtual(): MovimentoState {
  return state;
}

export function subscribeMovimento(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: MovimentoState): void {
  state = next;
  for (const listener of listeners) listener();
}

function catalogIcao(icao: string): string | null {
  return AIRPORTS.find((item) => item.icao === icao)?.icao ?? null;
}

function lock<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function enterQuery(): void {
  queries += 1;
  if (queries === 1) {
    idle = new Promise((resolve) => {
      idleResolve = resolve;
    });
  }
}

function leaveQuery(): void {
  queries -= 1;
  if (queries === 0 && idleResolve) {
    idleResolve();
    idleResolve = null;
  }
}

async function withConnection<T>(
  job: (conn: duckdb.AsyncDuckDBConnection) => Promise<T>,
): Promise<T> {
  await tail;
  if (!session) throw new Error(MISSING_FILE);
  const conn = session.conn;
  enterQuery();
  try {
    return await job(conn);
  } finally {
    leaveQuery();
  }
}

async function createDb(): Promise<duckdb.AsyncDuckDB> {
  const bundle = await duckdb.selectBundle(BUNDLES);
  if (!bundle.mainWorker) {
    throw new Error("Worker do DuckDB indisponível.");
  }
  const worker = new Worker(bundle.mainWorker);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  try {
    await db.instantiate(bundle.mainModule);
    return db;
  } catch (error) {
    await db.terminate().catch(() => undefined);
    throw error;
  }
}

async function closeSession(): Promise<void> {
  await idle;
  placeCaches.clear();
  const current = session;
  session = null;
  if (!current) return;
  await current.db.terminate().catch(() => undefined);
}

function columnName(record: Record<string, unknown>): string | null {
  const value = record.column_name ?? record.name;
  return typeof value === "string" ? value : null;
}

async function parquetColumns(
  conn: duckdb.AsyncDuckDBConnection,
): Promise<Set<string>> {
  let rows: Record<string, unknown>[];
  try {
    const table = await conn.query(
      `SELECT column_name FROM (DESCRIBE SELECT * FROM read_parquet('${PARQUET_NAME}'))`,
    );
    rows = table.toArray() as Record<string, unknown>[];
  } catch {
    throw new Error(UNREADABLE);
  }
  return new Set(
    rows.flatMap((row) => {
      const name = columnName(row);
      return name ? [name] : [];
    }),
  );
}

async function assertColumns(conn: duckdb.AsyncDuckDBConnection): Promise<void> {
  const present = await parquetColumns(conn);
  const missing = REQUIRED_COLUMNS.filter((name) => !present.has(name));
  if (missing.length > 0) {
    throw new Error(`Faltam colunas: ${missing.join(", ")}.`);
  }
}

async function assertPlaceColumns(conn: duckdb.AsyncDuckDBConnection): Promise<void> {
  const present = await parquetColumns(conn);
  if (!PLACE_COLUMNS.every((name) => present.has(name))) {
    throw new Error(MISSING_PLACE);
  }
}

async function openRegistered(
  nome: string,
  bytes: Uint8Array,
  persist: boolean,
): Promise<void> {
  await closeSession();
  const db = await createDb();
  let conn: duckdb.AsyncDuckDBConnection;
  try {
    await db.registerFileBuffer(PARQUET_NAME, bytes.slice());
    conn = await db.connect();
    await assertColumns(conn);
  } catch (error) {
    await db.terminate().catch(() => undefined);
    if (
      error instanceof Error &&
      (error.message === UNREADABLE || error.message.startsWith("Faltam colunas:"))
    ) {
      throw error;
    }
    throw new Error(UNREADABLE);
  }
  if (persist) {
    try {
      await writeMovimento(nome, bytes);
    } catch {
      await db.terminate().catch(() => undefined);
      throw new Error(UNSAVED);
    }
  }
  session = { db, conn };
  publish({ nome, restaurando: false, enviando: state.enviando, erro: null });
}

async function reopenStored(): Promise<void> {
  let stored: Awaited<ReturnType<typeof readMovimento>>;
  try {
    stored = await readMovimento();
  } catch {
    publish({ nome: null, restaurando: false, enviando: false, erro: null });
    return;
  }
  if (!stored) {
    publish({ nome: null, restaurando: false, enviando: false, erro: null });
    return;
  }
  try {
    await openRegistered(stored.nome, stored.bytes, false);
  } catch (error) {
    publish({
      nome: null,
      restaurando: false,
      enviando: false,
      erro: error instanceof Error ? error.message : UNREADABLE,
    });
  }
}

export function restoreMovimento(): Promise<void> {
  if (restoring) return restoring;
  publish({ nome: state.nome, restaurando: true, enviando: false, erro: null });
  restoring = lock(async () => {
    try {
      const stored = await readMovimento();
      if (!stored) {
        publish({ nome: null, restaurando: false, enviando: false, erro: null });
        return;
      }
      await openRegistered(stored.nome, stored.bytes, false);
    } catch (error) {
      publish({
        nome: null,
        restaurando: false,
        enviando: false,
        erro: error instanceof Error ? error.message : UNREADABLE,
      });
    }
  });
  return restoring;
}

export function loadMovimento(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".parquet")) {
    return Promise.reject(new Error("Envie um arquivo .parquet."));
  }
  return lock(async () => {
    publish({ ...state, enviando: true, erro: null });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error(UNREADABLE);
      try {
        await openRegistered(file.name, bytes, true);
      } catch (error) {
        await reopenStored();
        throw error;
      }
    } finally {
      if (state.enviando) publish({ ...state, enviando: false });
    }
  });
}

function sqlWeight(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("Informe os parâmetros da área.");
  }
  return value.toFixed(12);
}

function coverageCte(icao: string): string {
  return `
cobertura AS (
    SELECT MAX(CAST(DT_CALCO AS DATE)) AS ultima
    FROM read_parquet('${PARQUET_NAME}')
    WHERE NR_AEROPORTO_REFERENCIA = '${icao}'
),
mes AS (
    SELECT
        ultima,
        date_trunc('month', ultima) AS inicio_mes,
        CAST(ultima AS DATE) = CAST(
            date_trunc('month', ultima) + INTERVAL '1' MONTH - INTERVAL '1' DAY
            AS DATE
        ) AS completo
    FROM cobertura
),
periodo AS (
    SELECT
        ultima,
        CASE
            WHEN ultima IS NULL THEN NULL
            WHEN completo THEN inicio_mes - INTERVAL '11' MONTH
            ELSE inicio_mes - INTERVAL '12' MONTH
        END AS inicio_periodo,
        CASE
            WHEN ultima IS NULL THEN NULL
            WHEN completo THEN inicio_mes + INTERVAL '1' MONTH
            ELSE inicio_mes
        END AS fim_periodo
    FROM mes
)`;
}

function coverageColumns(): string {
  return `
    strftime(periodo.ultima, '%d/%m/%Y') AS data_recente,
    strftime(CAST(periodo.inicio_periodo AS DATE), '%Y-%m-%d') AS periodo_inicio,
    strftime(
        CAST(periodo.fim_periodo AS DATE) - INTERVAL '1' DAY,
        '%Y-%m-%d'
    ) AS periodo_fim`;
}

function periodFilter(): string {
  return `
        AND periodo.inicio_periodo IS NOT NULL
        AND CAST(DT_CALCO AS DATE) >= CAST(periodo.inicio_periodo AS DATE)
        AND CAST(DT_CALCO AS DATE) < CAST(periodo.fim_periodo AS DATE)`;
}

function periodToken(iso: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const code = MONTH_CODES[Number(match[2]) - 1];
  return code ? `${code}${match[1]}` : iso;
}

export function dhpPeriodRange(coverage: DhpCoverage): string | null {
  if (!coverage.periodoInicio || !coverage.periodoFim) return null;
  return `${periodToken(coverage.periodoInicio)} a ${periodToken(coverage.periodoFim)}`;
}

export function dhpCoverageText(coverage: DhpCoverage): string {
  const range = dhpPeriodRange(coverage);
  if (!coverage.dataRecente || !range) {
    return "DHP Calculado no Período de —.";
  }
  return `DHP Calculado no Período de ${range}`;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function coverageFrom(record: Record<string, unknown> | undefined): DhpCoverage {
  return {
    dataRecente: textOrNull(record?.data_recente),
    periodoInicio: textOrNull(record?.periodo_inicio),
    periodoFim: textOrNull(record?.periodo_fim),
  };
}

const EMPTY_COVERAGE: DhpCoverage = {
  dataRecente: null,
  periodoInicio: null,
  periodoFim: null,
};

function coverageQuery(icao: string): string {
  return `
WITH ${coverageCte(icao)}
SELECT
    ${coverageColumns()}
FROM periodo
`;
}

export async function loadDhpCoverage(icao: string): Promise<DhpCoverage> {
  const code = catalogIcao(icao);
  if (!code) throw new Error("Aeroporto fora do catálogo.");
  try {
    return await withConnection(async (conn) => {
      const table = await conn.query(coverageQuery(code));
      const rows = table.toArray() as Record<string, unknown>[];
      return rows.length === 0 ? EMPTY_COVERAGE : coverageFrom(rows[0]);
    });
  } catch (error) {
    if (error instanceof Error && error.message === MISSING_FILE) throw error;
    throw new Error("Não foi possível ler o movimento.");
  }
}

function cellText(value: unknown): string {
  if (value == null) return "—";
  return String(value);
}

function cellNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  const raw = Number(value);
  return Number.isFinite(raw) ? raw : Number.NaN;
}

function windowRecord(record: Record<string, unknown>): boolean {
  return textOrNull(record.inicio) !== null;
}

function searchFailure(error: unknown): Error {
  if (error instanceof Error && error.message === MISSING_FILE) return error;
  if (error instanceof Error && error.message === MISSING_PLACE) return error;
  const detail = error instanceof Error ? error.message : "";
  if (/404|Not Found|HTTP Error|failed to fetch|NetworkError/i.test(detail)) {
    return new Error(UNREADABLE);
  }
  return new Error("Não foi possível consultar as janelas.");
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function comparePlace(a: string, b: string): number {
  return a.localeCompare(b, "pt", { numeric: true, sensitivity: "base" });
}

function placeFilterSql(filter: BoardingPlaceFilter | undefined): string {
  if (!boardingPlaceActive(filter) || !filter) return "";
  const parts: string[] = [];
  if (filter.boxes.length > 0) {
    parts.push(
      `AND TRIM(CAST(NR_BOX AS VARCHAR)) IN (${filter.boxes.map(sqlLiteral).join(", ")})`,
    );
  }
  if (filter.terminals.length > 0) {
    parts.push(
      `AND TRIM(CAST(NR_TERMINAL AS VARCHAR)) IN (${filter.terminals.map(sqlLiteral).join(", ")})`,
    );
  }
  return `\n        ${parts.join("\n        ")}`;
}

function placeText(value: unknown): string | null {
  if (typeof value === "string") return textOrNull(value);
  if (typeof value === "number" || typeof value === "bigint") {
    const text = String(value).trim();
    return text === "" ? null : text;
  }
  return null;
}

function distinctPlaces(rows: Record<string, unknown>[], key: string): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = placeText(row[key]);
    if (value) values.add(value);
  }
  return [...values].sort(comparePlace);
}

function rankLimit(value: number): number {
  const n = Math.floor(value);
  if (!Number.isFinite(n) || n < 1) return BOARDING_RANK_LIMIT;
  return n;
}

function boardingQuery(
  icao: string,
  pesos: BoardingPonderation,
  limit = BOARDING_RANK_LIMIT,
  filter?: BoardingPlaceFilter,
): string {
  const weight = Object.fromEntries(
    BOARDING_FLOW_KEYS.map((key) => [key, sqlWeight(pesos[key])]),
  ) as Record<BoardingFlowKey, string>;
  const demanda = BOARDING_FLOW_KEYS.map(
    (key) => `${FLOW_SQL[key]} * ${weight[key]}`,
  ).join("\n            + ");
  return `
WITH ${coverageCte(icao)},
movimentos AS (
    SELECT
        CAST(DT_CALCO || ' ' || HH_CALCO AS TIMESTAMP) AS instante,
        NR_MOVIMENTO_TIPO = 'D' AS embarque,
        TRIM(NR_NATUREZA) AS natureza,
        COALESCE(CAST(QT_PAX_LOCAL AS DOUBLE), 0) AS pax_local,
        COALESCE(CAST(QT_PAX_CONEXAO_DOMESTICO AS DOUBLE), 0) AS conexao_dom,
        COALESCE(CAST(QT_PAX_CONEXAO_INTERNACIONAL AS DOUBLE), 0) AS conexao_int
    FROM read_parquet('${PARQUET_NAME}')
    CROSS JOIN periodo
    WHERE
        NR_AEROPORTO_REFERENCIA = '${icao}'
        AND NR_MOVIMENTO_TIPO IN ('D', 'P')
        ${periodFilter()}${placeFilterSql(filter)}
),
classificados AS (
    SELECT
        instante,
        CASE WHEN embarque AND natureza = 'D' THEN pax_local ELSE 0 END AS origem_dom,
        CASE WHEN embarque AND natureza = 'I' THEN pax_local ELSE 0 END AS origem_int,
        CASE WHEN NOT embarque AND natureza = 'D' THEN pax_local ELSE 0 END AS destino_dom,
        CASE WHEN NOT embarque AND natureza = 'I' THEN pax_local ELSE 0 END AS destino_int,
        CASE WHEN embarque AND natureza = 'D' THEN conexao_dom ELSE 0 END AS conexao_dom_dom,
        CASE WHEN embarque AND natureza = 'D' THEN conexao_int ELSE 0 END AS conexao_int_dom,
        CASE WHEN embarque AND natureza = 'I' THEN conexao_dom ELSE 0 END AS conexao_dom_int,
        CASE WHEN embarque AND natureza = 'I' THEN conexao_int ELSE 0 END AS conexao_int_int,
        CASE WHEN NOT embarque AND natureza = 'I' THEN conexao_dom ELSE 0 END AS chegada_dom_int,
        CASE WHEN NOT embarque AND natureza = 'D' THEN conexao_int ELSE 0 END AS chegada_int_dom,
        CASE WHEN NOT embarque AND natureza = 'I' THEN conexao_int ELSE 0 END AS chegada_int_int
    FROM movimentos
),
janelas AS (
    SELECT
        date_trunc('hour', instante) AS inicio,
        date_trunc('hour', instante) + INTERVAL '60 minutes' AS fim,
        SUM(origem_dom) AS origem_dom,
        SUM(origem_int) AS origem_int,
        SUM(destino_dom) AS destino_dom,
        SUM(destino_int) AS destino_int,
        SUM(conexao_dom_dom) AS conexao_dom_dom,
        SUM(conexao_int_dom) AS conexao_int_dom,
        SUM(conexao_dom_int) AS conexao_dom_int,
        SUM(conexao_int_int) AS conexao_int_int,
        SUM(chegada_dom_int) AS chegada_dom_int,
        SUM(chegada_int_dom) AS chegada_int_dom,
        SUM(chegada_int_int) AS chegada_int_int,
        SUM(
            ${demanda}
        ) AS demanda_ponderada
    FROM classificados
    GROUP BY date_trunc('hour', instante)
)
SELECT
    ${coverageColumns()},
    ranqueadas.quantidade_janelas,
    ranqueadas.posicao,
    strftime(ranqueadas.inicio, '%d/%m/%Y %H:%M') AS inicio,
    strftime(ranqueadas.fim, '%d/%m/%Y %H:%M') AS fim,
    ranqueadas.demanda_ponderada,
    ranqueadas.origem_dom,
    ranqueadas.origem_int,
    ranqueadas.destino_dom,
    ranqueadas.destino_int,
    ranqueadas.conexao_dom_dom,
    ranqueadas.conexao_int_dom,
    ranqueadas.conexao_dom_int,
    ranqueadas.conexao_int_int,
    ranqueadas.chegada_dom_int,
    ranqueadas.chegada_int_dom,
    ranqueadas.chegada_int_int
FROM periodo
LEFT JOIN (
    SELECT
        inicio,
        fim,
        origem_dom,
        origem_int,
        destino_dom,
        destino_int,
        conexao_dom_dom,
        conexao_int_dom,
        conexao_dom_int,
        conexao_int_int,
        chegada_dom_int,
        chegada_int_dom,
        chegada_int_int,
        demanda_ponderada,
        COUNT(*) OVER () AS quantidade_janelas,
        ROW_NUMBER() OVER (
            ORDER BY demanda_ponderada DESC, inicio
        ) AS posicao
    FROM janelas
) AS ranqueadas ON ranqueadas.posicao <= ${rankLimit(limit)}
ORDER BY ranqueadas.posicao DESC
`;
}

function countsFrom(record: Record<string, unknown>): BoardingHourCounts {
  return Object.fromEntries(
    BOARDING_FLOW_KEYS.map((key) => [key, cellNumber(record[FLOW_SQL[key]])]),
  ) as BoardingHourCounts;
}

function placesQuery(icao: string): string {
  return `
WITH ${coverageCte(icao)}
SELECT DISTINCT
    NULLIF(TRIM(CAST(NR_BOX AS VARCHAR)), '') AS box,
    NULLIF(TRIM(CAST(NR_TERMINAL AS VARCHAR)), '') AS terminal
FROM read_parquet('${PARQUET_NAME}')
CROSS JOIN periodo
WHERE
    NR_AEROPORTO_REFERENCIA = '${icao}'
    AND NR_MOVIMENTO_TIPO IN ('D', 'P')
    ${periodFilter()}
`;
}

export async function listBoardingPlaces(icao: string): Promise<BoardingPlaceCatalog> {
  const code = catalogIcao(icao);
  if (!code) throw new Error("Aeroporto fora do catálogo.");
  const arquivo = state.nome;
  if (!arquivo) throw new Error(MISSING_FILE);
  const key = `${arquivo}\n${code}`;
  const cached = placeCaches.get(key);
  if (cached) return cached;
  try {
    const catalog = await withConnection(async (conn) => {
      await assertPlaceColumns(conn);
      const table = await conn.query(placesQuery(code));
      const rows = table.toArray() as Record<string, unknown>[];
      return {
        boxes: distinctPlaces(rows, "box"),
        terminals: distinctPlaces(rows, "terminal"),
      };
    });
    if (state.nome === arquivo) placeCaches.set(key, catalog);
    return catalog;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === MISSING_FILE ||
        error.message === MISSING_PLACE ||
        error.message === UNREADABLE)
    ) {
      throw error;
    }
    throw new Error("Não foi possível ler os boxes e os terminais.");
  }
}

export async function searchBoardingDhp(
  icao: string,
  pesos: BoardingPonderation,
  limit = BOARDING_RANK_LIMIT,
  filter?: BoardingPlaceFilter,
): Promise<BoardingDhpResult> {
  const code = catalogIcao(icao);
  if (!code) throw new Error("Aeroporto fora do catálogo.");
  for (const key of BOARDING_FLOW_KEYS) sqlWeight(pesos[key]);
  const advanced = boardingPlaceActive(filter);
  try {
    return await withConnection(async (conn) => {
      if (advanced) await assertPlaceColumns(conn);
      const table = await conn.query(
        boardingQuery(code, pesos, limit, advanced ? filter : undefined),
      );
      const rows = table.toArray() as Record<string, unknown>[];
      const coverage = coverageFrom(rows[0]);
      const ranked = rows.filter(windowRecord);
      if (ranked.length === 0) {
        return { suficiente: false, quantidadeJanelas: 0, janelas: [], coverage };
      }
      const quantidadeJanelas = cellNumber(ranked[0]?.quantidade_janelas);
      const janelas: BoardingDhpWindow[] = ranked.map((record) => ({
        posicao: cellNumber(record.posicao),
        inicio: cellText(record.inicio),
        fim: cellText(record.fim),
        demandaPonderada: cellNumber(record.demanda_ponderada),
        counts: countsFrom(record),
      }));
      return {
        suficiente: quantidadeJanelas >= 30 && janelas.some((item) => item.posicao === 30),
        quantidadeJanelas,
        janelas,
        coverage,
      };
    });
  } catch (error) {
    throw searchFailure(error);
  }
}

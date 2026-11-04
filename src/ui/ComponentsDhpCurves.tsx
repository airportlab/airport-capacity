import { useEffect, useMemo, useRef, useState } from "react";
import {
  boardingPonderation,
  rankBoardingHours,
  type BoardingHourSlot,
} from "../domain/boardingDhp";
import { journeyRank } from "../domain/templates/organs";
import type {
  ComponentId,
  ComponentParamId,
  RegistryEntry,
} from "../domain/types";
import {
  boardingPlaceActive,
  dhpCoverageText,
  dhpPeriodRange,
  loadBoardingHourCounts,
  type BoardingDhpWindow,
  type BoardingPlaceFilter,
  type DhpCoverage,
} from "../dhp/duckdb";
import {
  BOARDING_AREA_INVALID_MESSAGE,
  BOARDING_AREA_MISSING_MESSAGE,
  EMPTY_BOARDING_PLACES,
  graficoTitulo,
  prepareBoardingFlows,
  saturacaoDaCurva,
} from "./BoardingDhpButton";
import {
  OrderedDemandChart,
  visibleDhpWindows,
  type DhpCurveForm,
} from "./DhpDemandChart";
import { parseLocaleNumber } from "./format";
import { useMovimento } from "./useMovimento";

const NO_FILE = "Envie o arquivo de movimentação na aba DHp.";
const NO_COMPONENTS = "Cadastre um componente operacional para ver a curva.";
const NO_HOURS = "Não há janelas no período.";

interface ComponentsDhpCurvesProps {
  icao: string;
  airportName: string;
  registry: readonly RegistryEntry[];
  drafts: Record<ComponentId, Record<ComponentParamId, string>>;
  dhpPlaces: Partial<
    Record<ComponentId, Partial<Record<string, BoardingPlaceFilter>>>
  >;
}

type CurveStatus = "curve" | "invalid" | "no-area" | "empty";

interface CurveItem {
  id: string;
  name: string;
  status: CurveStatus;
  janelas: BoardingDhpWindow[];
  capacidade: number | null;
}

interface CurvesView {
  coverage: DhpCoverage | null;
  items: CurveItem[];
}

function comparePlace(left: string, right: string): number {
  return left.localeCompare(right, "pt", { numeric: true, sensitivity: "base" });
}

function filterKey(filter: BoardingPlaceFilter): string {
  if (!boardingPlaceActive(filter)) return "";
  return JSON.stringify({
    boxes: [...filter.boxes].sort(comparePlace),
    terminals: [...filter.terminals].sort(comparePlace),
  });
}

function measuredArea(
  drafts: Record<ComponentParamId, string> | undefined,
): number | null {
  const parsed = parseLocaleNumber(drafts?.areaMedida ?? "");
  return parsed !== null && parsed > 0 ? parsed : null;
}

function statusMessage(status: CurveStatus): string {
  if (status === "invalid") return BOARDING_AREA_INVALID_MESSAGE;
  if (status === "no-area") return BOARDING_AREA_MISSING_MESSAGE;
  return NO_HOURS;
}

export function ComponentsDhpCurves({
  icao,
  airportName,
  registry,
  drafts,
  dhpPlaces,
}: ComponentsDhpCurvesProps) {
  const movimento = useMovimento();
  const request = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [forma, setForma] = useState<DhpCurveForm>("discreta");
  const [view, setView] = useState<CurvesView | null>(null);
  const ordered = useMemo(
    () =>
      [...registry].sort(
        (left, right) => journeyRank(left.kind) - journeyRank(right.kind),
      ),
    [registry],
  );

  useEffect(() => {
    request.current += 1;
    setBusy(false);
    setOpen(false);
    setView(null);
    setError(null);
    setNotice(null);
  }, [icao, movimento.nome]);

  async function showCurves() {
    const token = ++request.current;
    setError(null);
    setNotice(null);
    setOpen(false);
    setView(null);
    if (!movimento.nome) {
      setNotice(NO_FILE);
      return;
    }
    if (ordered.length === 0) {
      setNotice(NO_COMPONENTS);
      return;
    }
    const prepared = ordered.map((entry) => {
      const draftsFor = drafts[entry.id];
      const flows = prepareBoardingFlows(entry, draftsFor ?? ({} as Record<ComponentParamId, string>));
      const filter = dhpPlaces[entry.id]?.[icao] ?? EMPTY_BOARDING_PLACES;
      return { entry, flows, filter, capacidade: measuredArea(draftsFor) };
    });
    if (!prepared.some((item) => Array.isArray(item.flows))) {
      setView({
        coverage: null,
        items: prepared.map((item) => ({
          id: item.entry.id,
          name: item.entry.title.trim() || "Componente",
          status: item.flows === "invalid" ? "invalid" : "no-area",
          janelas: [],
          capacidade: item.capacidade,
        })),
      });
      setOpen(true);
      return;
    }
    setBusy(true);
    try {
      const groups = new Map<string, BoardingPlaceFilter | undefined>();
      for (const item of prepared) {
        if (!Array.isArray(item.flows)) continue;
        const key = filterKey(item.filter);
        if (!groups.has(key)) {
          groups.set(key, boardingPlaceActive(item.filter) ? item.filter : undefined);
        }
      }
      const hoursByKey = new Map<string, BoardingHourSlot[]>();
      let coverage: DhpCoverage | null = null;
      for (const [key, filter] of groups) {
        const result = await loadBoardingHourCounts(icao, filter);
        if (token !== request.current) return;
        coverage = result.coverage;
        hoursByKey.set(key, result.hours);
      }
      const items: CurveItem[] = prepared.map((item) => {
        const name = item.entry.title.trim() || "Componente";
        if (!Array.isArray(item.flows)) {
          return {
            id: item.entry.id,
            name,
            status: item.flows === "invalid" ? "invalid" : "no-area",
            janelas: [],
            capacidade: item.capacidade,
          };
        }
        const hours = hoursByKey.get(filterKey(item.filter)) ?? [];
        const ranked = rankBoardingHours(hours, boardingPonderation(item.flows));
        const janelas: BoardingDhpWindow[] = ranked.map((hour) => ({
          posicao: hour.posicao,
          inicio: hour.inicio,
          fim: hour.fim,
          demandaPonderada: hour.demandaPonderada,
          counts: hour.counts,
        }));
        return {
          id: item.entry.id,
          name,
          status: janelas.length === 0 ? "empty" : "curve",
          janelas,
          capacidade: item.capacidade,
        };
      });
      if (token !== request.current) return;
      setView({ coverage, items });
      setOpen(true);
    } catch (caught) {
      if (token !== request.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível consultar as janelas.",
      );
    } finally {
      if (token === request.current) setBusy(false);
    }
  }

  const range = view?.coverage ? dhpPeriodRange(view.coverage) : null;

  return (
    <>
      <hr className="dhp-rule" />
      <div className="actions dhp-actions">
        <button
          type="button"
          className="dhp-gear ghost"
          aria-label="Apresentação da curva"
          aria-pressed={settingsOpen}
          onClick={() => setSettingsOpen(true)}
          disabled={busy || movimento.restaurando || movimento.enviando}
        >
          <GearIcon />
        </button>
        <button
          type="button"
          onClick={() => void showCurves()}
          disabled={busy || movimento.restaurando || movimento.enviando}
        >
          {busy ? "A calcular…" : "Mostrar curva DHP dos componentes"}
        </button>
      </div>
      {notice ? <p className="panel-lead">{notice}</p> : null}
      {error ? <p className="panel-lead">{error}</p> : null}
      {open && view ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="panel modal modal-dhp"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dhp-curvas-titulo"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="dhp-curvas-titulo">
              Curva DHP dos componentes — {airportName}
            </h2>
            {view.coverage ? (
              <p className="dhp-meta">{dhpCoverageText(view.coverage)}</p>
            ) : null}
            {view.items.map((item, index) => {
              const labelledBy = `dhp-curva-${index}`;
              if (item.status !== "curve") {
                return (
                  <section key={item.id} className="dhp-curve-block">
                    <h3 id={labelledBy}>{item.name}</h3>
                    <p className="panel-lead">{statusMessage(item.status)}</p>
                  </section>
                );
              }
              const visible = visibleDhpWindows(item.janelas, item.capacidade);
              const ultima = visible[visible.length - 1]?.posicao;
              return (
                <section key={item.id} className="dhp-curve-block">
                  <h3 id={labelledBy}>
                    {graficoTitulo(
                      range,
                      item.name,
                      airportName,
                      saturacaoDaCurva(item.janelas, item.capacidade),
                    )}
                  </h3>
                  <p className="dhp-meta">
                    A curva começa no Nº 1 e desce até o Nº {ultima}. O ponto 30
                    é a hora gravada no componente.
                  </p>
                  <OrderedDemandChart
                    labelledBy={labelledBy}
                    janelas={item.janelas}
                    capacidade={item.capacidade}
                    forma={forma}
                  />
                  {item.capacidade === null ? (
                    <p className="panel-lead">
                      Informe a área medida para ver a capacidade.
                    </p>
                  ) : null}
                </section>
              );
            })}
            <div className="actions modal-actions">
              <button type="button" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {settingsOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="panel modal modal-dhp-matriz"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dhp-curva-forma-titulo"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="dhp-curva-forma-titulo">Apresentação da curva</h2>
            <p className="panel-lead">
              Cada Nº é uma hora. A forma discreta conserva o valor dessa hora.
              A contínua liga uma hora à seguinte.
            </p>
            <div role="radiogroup" aria-label="Forma da curva">
              <label className="choice">
                <input
                  type="radio"
                  name="dhp-curva-forma"
                  checked={forma === "discreta"}
                  onChange={() => setForma("discreta")}
                />
                Discreta
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="dhp-curva-forma"
                  checked={forma === "continua"}
                  onChange={() => setForma("continua")}
                />
                Contínua
              </label>
            </div>
            <div className="actions modal-actions">
              <button type="button" onClick={() => setSettingsOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
      />
    </svg>
  );
}

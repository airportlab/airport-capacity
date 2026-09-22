import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  airportById,
  shouldReplaceAirportName,
  type AirportId,
} from "../domain/airports";
import {
  defaultComponentOrigens,
  defaultComponentParams,
} from "../domain/contracts/catalog";
import { isSizingParam, isTaxaParam, isTsecParam } from "../domain/contracts/fields";
import { resolveContracts, slugify } from "../domain/contracts/factory";
import { evaluateAll } from "../domain/engine";
import { UNOFFICIAL_NOTICE } from "../domain/notice";
import {
  overlaySizingSources,
  pmdOrigem,
  relabelPmdOrigens,
  resolvedSources,
  reabsorbTsecParams,
  resolveContractValue,
  roundLabel,
  sourceCitation,
  standardTsecForParam,
  TSEC_MANUAL_CITATION,
} from "../domain/pmd";
import {
  instantiateOrgan,
  natureOfEntry,
  organAllowsCompanions,
  organNatureLabel,
  rebindOrganNature,
  remapDemandaOnNatureChange,
  templateByKind,
  templateForEntry,
  type OrganKind,
  type OrganNature,
} from "../domain/templates/organs";
import type {
  ComponentId,
  ComponentJustificativas,
  ComponentParamId,
  JustificativaId,
  ComponentParams,
  EditorTab,
  ExcelKind,
  PdfKind,
  RegistryEntry,
} from "../domain/types";
import { downloadBlob, stampFilename, waitForPaint } from "../export/download";
import {
  createPersistedState,
  emptyEditorState,
  exampleEditorState,
  type EditorState,
  type PersistedAirportState,
} from "../persistence/localStore";
import {
  packSnapshot,
  SNAPSHOT_EXTENSION,
  SnapshotError,
  unpackSnapshot,
} from "../persistence/snapshot";
import { AboutPage } from "./AboutPage";
import { ComponentEditor } from "./ComponentEditor";
import {
  formatAirportName,
  formatEditable,
  formatSavedAt,
  parseLocaleNumber,
} from "./format";
import { ParametersTab } from "./ParametersTab";
import { RegisterComponent } from "./RegisterComponent";
import { ReportView } from "./ReportView";
import { SummaryPage } from "./SummaryPage";

function draftsFromRecord<K extends string>(
  values: Record<K, number>,
  ids: readonly K[],
): Record<K, string> {
  return Object.fromEntries(
    ids.map((id) => [id, formatEditable(values[id] ?? 0)]),
  ) as Record<K, string>;
}

export function AirportEditor() {
  const initial = emptyEditorState();
  const [tab, setTab] = useState<EditorTab>("summary");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [airportName, setAirportName] = useState(initial.airportName);
  const [airportId, setAirportId] = useState<AirportId>(initial.airportId);
  const airport = airportById(airportId);
  const [registry, setRegistry] = useState<RegistryEntry[]>(initial.registry);
  const [components, setComponents] = useState(initial.components);
  const [componentOrigens, setComponentOrigens] = useState(
    initial.componentOrigens,
  );
  const [justificativas, setJustificativas] = useState(initial.justificativas);
  const contracts = useMemo(() => resolveContracts(registry), [registry]);
  const [componentDrafts, setComponentDrafts] = useState(() =>
    Object.fromEntries(
      resolveContracts(initial.registry).map((contract) => [
        contract.id,
        draftsFromRecord(
          initial.components[contract.id] ?? defaultComponentParams(contract),
          contract.params.map((field) => field.id),
        ),
      ]),
    ) as Record<ComponentId, Record<ComponentParamId, string>>,
  );
  const [savedAt, setSavedAt] = useState<string | null>(initial.savedAt);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    "excel-component" | "excel-nature" | PdfKind | "save" | "load" | null
  >(null);
  const [pdfKind, setPdfKind] = useState<PdfKind>("simplificado");
  const reportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const evaluations = useMemo(
    () => evaluateAll(contracts, components),
    [contracts, components],
  );

  function updateComponent(
    componentId: ComponentId,
    id: ComponentParamId,
    raw: string,
  ) {
    setComponentDrafts((current) => ({
      ...current,
      [componentId]: { ...current[componentId], [id]: raw },
    }));
    const parsed = parseLocaleNumber(raw);
    if (parsed === null) return;
    setComponents((current) => ({
      ...current,
      [componentId]: { ...current[componentId], [id]: parsed },
    }));
  }

  function rebuildDrafts(
    nextRegistry: RegistryEntry[],
    nextComponents: typeof components,
  ) {
    const nextContracts = resolveContracts(nextRegistry);
    setComponentDrafts(
      Object.fromEntries(
        nextContracts.map((contract) => [
          contract.id,
          draftsFromRecord(
            nextComponents[contract.id] ?? defaultComponentParams(contract),
            contract.params.map((field) => field.id),
          ),
        ]),
      ) as Record<ComponentId, Record<ComponentParamId, string>>,
    );
  }

  function applyState(next: EditorState | PersistedAirportState) {
    setAirportName(next.airportName);
    setAirportId(next.airportId);
    setRegistry(next.registry);
    setComponents(next.components);
    setComponentOrigens(next.componentOrigens);
    setJustificativas(next.justificativas);
    rebuildDrafts(next.registry, next.components);
  }

  function handleAirportChange(nextId: AirportId) {
    const previous = airport;
    const next = airportById(nextId);
    if (previous.id === next.id) return;
    setAirportId(next.id);
    setAirportName((current) =>
      shouldReplaceAirportName(current, previous) ? next.name : current,
    );
    setComponentOrigens((current) =>
      relabelPmdOrigens(registry, current, previous, next),
    );
  }

  async function handleSave() {
    setBusy("save");
    try {
      const persisted = createPersistedState({
        airportName,
        airportId: airport.id,
        roundId: airport.roundId,
        registry,
        components,
        componentOrigens,
        justificativas,
      });
      const blob = await packSnapshot(persisted);
      const base = slugify(airportName.trim() || "aeroporto", []);
      downloadBlob(blob, stampFilename(base, SNAPSHOT_EXTENSION));
      setSavedAt(persisted.savedAt);
      setMessage("Arquivo guardado.");
    } catch {
      setMessage("Falha ao guardar o arquivo.");
    } finally {
      setBusy(null);
    }
  }

  function handleLoad() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      (registry.length > 0 || airportName.trim() !== "") &&
      !window.confirm("Substituir o estado atual pelo arquivo?")
    ) {
      return;
    }
    setBusy("load");
    try {
      const loaded = await unpackSnapshot(await file.arrayBuffer());
      applyState(loaded);
      setSavedAt(loaded.savedAt);
      setTab("summary");
      setMessage(`Arquivo carregado (${formatSavedAt(loaded.savedAt)}).`);
    } catch (error) {
      setMessage(
        error instanceof SnapshotError
          ? error.message
          : "Falha ao carregar o arquivo.",
      );
    } finally {
      setBusy(null);
    }
  }

  function handleLoadExample() {
    if (
      registry.length > 0 &&
      !window.confirm(
        "Substituir os componentes operacionais atuais pelo exemplo fictício?",
      )
    ) {
      return;
    }
    applyState(exampleEditorState(airportName, airport.id));
    setTab("summary");
    setMessage(
      "Exemplo fictício carregado: um componente operacional de cada tipo do PMD.",
    );
  }

  function handleCreate(kind: OrganKind, nature: OrganNature, title: string) {
    const template = templateByKind(kind);
    if (!template) return;
    const entry = instantiateOrgan(
      template,
      nature,
      title,
      registry.map((item) => item.id),
    );
    applyComponentRecords(entry.id, entry, undefined, undefined);
    setRegistry((current) => [...current, entry]);
    setTab(entry.id);
    setMessage(`Componente “${entry.title}” cadastrado a partir do PMD.`);
  }

  function handleClone(sourceId: ComponentId, title: string) {
    const source = registry.find((entry) => entry.id === sourceId);
    if (!source) return;
    const id = slugify(
      title,
      registry.map((entry) => entry.id),
    );
    const entry: RegistryEntry = {
      id,
      title,
      kind: source.kind,
      requirements: {
        ...source.requirements,
        area: source.requirements.area
          ? { ...source.requirements.area }
          : undefined,
      },
      pmd: source.pmd ? { ...source.pmd } : undefined,
      flows: source.flows?.map((flow) => ({
        role: flow.role,
        pmd: { ...flow.pmd },
      })),
      sizingSources: source.sizingSources
        ? { ...source.sizingSources }
        : undefined,
      observacoes: source.observacoes,
      hasConnection: source.hasConnection,
    };
    applyComponentRecords(
      id,
      entry,
      components[sourceId],
      componentOrigens[sourceId],
    );
    setJustificativas((current) => ({
      ...current,
      [id]: { ...(current[sourceId] ?? {}) },
    }));
    setRegistry((current) => [...current, entry]);
    setTab(id);
    setMessage(`Componente “${title}” duplicado a partir de ${source.title}.`);
  }

  function applyComponentRecords(
    id: ComponentId,
    entry: RegistryEntry,
    previousParams: typeof components[string] | undefined,
    previousOrigens: typeof componentOrigens[string] | undefined,
    previousEntry?: RegistryEntry,
    options?: {
      identityOverrides?: Partial<ComponentParams>;
      dropSizingJustificativas?: boolean;
    },
  ) {
    const contract = resolveContracts([entry])[0];
    const params = defaultComponentParams(contract);
    const origens = defaultComponentOrigens(contract);
    const keep = new Set(
      previousEntry
        ? resolveContracts([previousEntry])[0].params.map((field) => field.id)
        : [],
    );
    if (previousParams) {
      for (const field of contract.params) {
        const shouldKeep =
          previousEntry
            ? keep.has(field.id) || isTaxaParam(field.id)
            : true;
        if (shouldKeep && previousParams[field.id] !== undefined) {
          params[field.id] = previousParams[field.id];
        }
      }
    }
    if (previousOrigens) {
      for (const field of contract.params) {
        const shouldKeep = previousEntry ? keep.has(field.id) : true;
        const origem = previousOrigens[field.id];
        if (shouldKeep && origem) origens[field.id] = origem;
      }
    }
    const overlaid = overlaySizingSources(entry, params, origens, airport);
    const freshZeros = new Set<ComponentParamId>([
      "areaMedida",
      "quantidadeEquipamentos",
      "tsec",
      "demandaPicoConexao",
    ]);
    const sources = resolvedSources(entry);
    for (const field of contract.params) {
      if (isSizingParam(field.id) && sources[field.id]) {
        params[field.id] = overlaid.params[field.id];
        origens[field.id] = overlaid.origens[field.id];
        continue;
      }
      if (previousEntry && keep.has(field.id)) continue;
      if (
        previousEntry &&
        isTaxaParam(field.id) &&
        previousParams &&
        previousParams[field.id] > 0
      ) {
        params[field.id] = previousParams[field.id];
        continue;
      }
      params[field.id] = overlaid.params[field.id];
      origens[field.id] = overlaid.origens[field.id];
      if (previousEntry && freshZeros.has(field.id)) {
        const keepManualTsec =
          isTsecParam(field.id) && standardTsecForParam(entry, field.id) != null;
        if (!keepManualTsec) params[field.id] = 0;
      }
      if (previousEntry && isSizingParam(field.id) && !sources[field.id]) {
        params[field.id] = 0;
      }
    }
    if (options?.identityOverrides) {
      for (const field of contract.params) {
        const override = options.identityOverrides[field.id];
        if (override !== undefined) params[field.id] = override;
      }
    }
    if (previousEntry && previousParams) {
      reabsorbTsecParams(
        previousEntry,
        entry,
        previousParams,
        params,
        origens,
        new Set(contract.params.map((field) => field.id)),
      );
    }
    if (!previousParams) {
      params.demandaPico = 0;
      params.demandaPicoEmbarque = 0;
      params.demandaPicoDesembarque = 0;
      params.demandaPicoEmbarqueDomestico = 0;
      params.demandaPicoEmbarqueInternacional = 0;
      params.demandaPicoDesembarqueDomestico = 0;
      params.demandaPicoDesembarqueInternacional = 0;
      params.demandaPicoDomestico = 0;
      params.demandaPicoInternacional = 0;
      params.demandaPicoConexao = 0;
      params.areaMedida = 0;
    }
    for (const field of contract.params) {
      if (!isTsecParam(field.id)) continue;
      const tsecStandard = standardTsecForParam(entry, field.id);
      if (tsecStandard != null) origens[field.id] = TSEC_MANUAL_CITATION;
    }
    setComponents((current) => ({ ...current, [id]: params }));
    setComponentOrigens((current) => ({ ...current, [id]: origens }));
    setComponentDrafts((current) => ({
      ...current,
      [id]: draftsFromRecord(
        params,
        contract.params.map((field) => field.id),
      ),
    }));
    setJustificativas((current) => {
      if (options?.dropSizingJustificativas) {
        return { ...current, [id]: {} };
      }
      const kept: ComponentJustificativas = {};
      for (const field of contract.params) {
        if (!isSizingParam(field.id)) continue;
        if (previousEntry && !keep.has(field.id)) continue;
        const text = current[id]?.[field.id];
        if (text) kept[field.id] = text;
      }
      for (const field of contract.params) {
        if (!isTsecParam(field.id)) continue;
        const tsecText = current[id]?.[field.id];
        const tsecStandard = standardTsecForParam(entry, field.id);
        if (tsecText && tsecStandard != null && params[field.id] !== tsecStandard) {
          kept[field.id] = tsecText;
        }
      }
      return { ...current, [id]: kept };
    });
  }

  function handleNatureChange(id: ComponentId, nature: OrganNature) {
    const current = registry.find((entry) => entry.id === id);
    if (!current) return;
    if (natureOfEntry(current) === nature) return;
    const next = rebindOrganNature(current, nature);
    if (next === current) return;
    const previousParams = components[id];
    applyComponentRecords(
      id,
      next,
      previousParams,
      componentOrigens[id],
      current,
      {
        identityOverrides: previousParams
          ? remapDemandaOnNatureChange(current, next, previousParams)
          : undefined,
        dropSizingJustificativas: true,
      },
    );
    setRegistry((entries) =>
      entries.map((entry) => (entry.id === id ? next : entry)),
    );
    setMessage(`Natureza alterada para ${organNatureLabel(nature)}.`);
  }

  function updateRequirements(
    id: ComponentId,
    mutate: (entry: RegistryEntry) => RegistryEntry,
  ) {
    const current = registry.find((entry) => entry.id === id);
    if (!current) return;
    const next = mutate(current);
    applyComponentRecords(
      id,
      next,
      components[id],
      componentOrigens[id],
      current,
    );
    setRegistry((entries) =>
      entries.map((entry) => (entry.id === id ? next : entry)),
    );
  }

  function handleAddArea(id: ComponentId, companions: boolean) {
    updateRequirements(id, (entry) => ({
      ...entry,
      requirements: {
        ...entry.requirements,
        area: { companions: companions && organAllowsCompanions(entry) },
      },
    }));
    setMessage("Requisito de área cadastrado.");
  }

  function handleSetCompanions(id: ComponentId, companions: boolean) {
    updateRequirements(id, (entry) => {
      if (!entry.requirements.area) return entry;
      return {
        ...entry,
        requirements: {
          ...entry.requirements,
          area: {
            ...entry.requirements.area,
            companions: companions && organAllowsCompanions(entry),
          },
        },
      };
    });
  }

  function handleSetAreaTaxa(id: ComponentId, taxaDiferente: boolean) {
    updateRequirements(id, (entry) => {
      if (!entry.requirements.area) return entry;
      return {
        ...entry,
        requirements: {
          ...entry.requirements,
          area: {
            ...entry.requirements.area,
            taxaDiferente: taxaDiferente || undefined,
          },
        },
      };
    });
  }

  function handleSetConnection(id: ComponentId, hasConnection: boolean) {
    updateRequirements(id, (entry) => ({
      ...entry,
      hasConnection: hasConnection || undefined,
    }));
  }

  function handleSetEquipmentTaxa(id: ComponentId, taxaDiferente: boolean) {
    updateRequirements(id, (entry) => {
      if (!entry.requirements.equipment) return entry;
      return {
        ...entry,
        requirements: {
          ...entry.requirements,
          equipment: {
            ...entry.requirements.equipment,
            taxaDiferente: taxaDiferente || undefined,
          },
        },
      };
    });
  }

  function handleRemoveArea(id: ComponentId) {
    if (!window.confirm("Remover o requisito de área deste componente?")) return;
    updateRequirements(id, (entry) => {
      const requirements = { ...entry.requirements };
      delete requirements.area;
      return { ...entry, requirements };
    });
    setMessage("Requisito de área removido.");
  }

  function handleAddEquipment(id: ComponentId) {
    updateRequirements(id, (entry) => ({
      ...entry,
      requirements: { ...entry.requirements, equipment: {} },
    }));
    setMessage("Requisito de equipamentos cadastrado.");
  }

  function handleRemoveEquipment(id: ComponentId) {
    if (!window.confirm("Remover o requisito de equipamentos deste componente?")) {
      return;
    }
    updateRequirements(id, (entry) => {
      const requirements = { ...entry.requirements };
      delete requirements.equipment;
      return { ...entry, requirements };
    });
    setMessage("Requisito de equipamentos removido.");
  }

  function handleRemoveAll() {
    if (registry.length === 0) return;
    if (!window.confirm("Apagar todos os componentes operacionais?")) return;
    setRegistry([]);
    setComponents({});
    setComponentOrigens({});
    setJustificativas({});
    rebuildDrafts([], {});
    setTab("summary");
    setMessage("Todos os componentes operacionais foram apagados.");
  }

  function handleRemove(id: ComponentId) {
    const entry = registry.find((item) => item.id === id);
    if (!entry) return;
    if (!window.confirm(`Remover o componente “${entry.title}”?`)) return;
    const nextRegistry = registry.filter((item) => item.id !== id);
    const nextComponents = { ...components };
    delete nextComponents[id];
    const nextOrigens = { ...componentOrigens };
    delete nextOrigens[id];
    const nextDrafts = { ...componentDrafts };
    delete nextDrafts[id];
    const nextJust = { ...justificativas };
    delete nextJust[id];
    setRegistry(nextRegistry);
    setComponents(nextComponents);
    setComponentOrigens(nextOrigens);
    setComponentDrafts(nextDrafts);
    setJustificativas(nextJust);
    if (tab === id) setTab("summary");
    setMessage(`Componente “${entry.title}” removido.`);
  }

  function handleRename(id: ComponentId, title: string) {
    setRegistry((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, title } : entry)),
    );
  }

  function handleObservacoesChange(id: ComponentId, raw: string) {
    setRegistry((current) =>
      current.map((entry) => {
        if (entry.id !== id) return entry;
        const observacoes = raw.trim() === "" ? undefined : raw;
        return { ...entry, observacoes };
      }),
    );
  }

  function handleJustificationChange(
    componentId: ComponentId,
    id: JustificativaId,
    raw: string,
  ) {
    setJustificativas((current) => ({
      ...current,
      [componentId]: { ...current[componentId], [id]: raw },
    }));
  }

  function handleRestoreContract(componentId: ComponentId, id: JustificativaId) {
    const contract = contracts.find((item) => item.id === componentId);
    const field = contract?.params.find((item) => item.id === id);
    if (!contract || !field) return;
    if (isTsecParam(id)) {
      const entry = registry.find((item) => item.id === componentId);
      const standard = entry ? standardTsecForParam(entry, id) : null;
      if (standard == null) return;
      updateComponent(componentId, id, formatEditable(standard));
      setComponentOrigens((current) => ({
        ...current,
        [componentId]: {
          ...current[componentId],
          [id]: TSEC_MANUAL_CITATION,
        },
      }));
      setJustificativas((current) => {
        const next = { ...(current[componentId] ?? {}) };
        delete next[id];
        return { ...current, [componentId]: next };
      });
      return;
    }
    const entry = registry.find((item) => item.id === componentId);
    const meta = resolveContractValue(entry, field);
    const sourceRef = entry ? resolvedSources(entry)[id] : undefined;
    updateComponent(componentId, id, formatEditable(meta.value));
    setComponentOrigens((current) => ({
      ...current,
      [componentId]: {
        ...current[componentId],
        [id]: meta.source === "pmd" && sourceRef ? pmdOrigem(sourceRef, airport) : field.origem,
      },
    }));
    setJustificativas((current) => {
      const next = { ...(current[componentId] ?? {}) };
      delete next[id];
      return { ...current, [componentId]: next };
    });
  }

  async function handleExcel(kind: ExcelKind) {
    setBusy(kind === "nature" ? "excel-nature" : "excel-component");
    try {
      const { exportAirportExcel } = await import("../export/excel");
      await exportAirportExcel(
        {
          airportName: formatAirportName(airportName),
          airport,
          generatedAt: new Date(),
          registry,
          contracts,
          evaluations,
          componentOrigens,
          justificativas,
        },
        kind,
      );
      setMessage(
        kind === "nature"
          ? "Planilha por natureza exportada: requisitos de área e de equipamentos."
          : "Planilha por componente exportada com resumo, parâmetros e fórmulas.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao exportar Excel.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handlePdf(kind: PdfKind) {
    setBusy(kind);
    setPdfKind(kind);
    await waitForPaint();
    try {
      if (!reportRef.current) {
        throw new Error("Relatório não está pronto para captura.");
      }
      const { exportReportPdf } = await import("../export/pdf");
      await exportReportPdf(reportRef.current, kind, "aeroporto-relatorio");
      setMessage(
        kind === "completo"
          ? "PDF completo exportado."
          : "PDF simplificado exportado.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao exportar PDF.",
      );
    } finally {
      setBusy(null);
    }
  }

  const viewingAbout = tab === "about";
  const activeContract =
    tab === "params" || tab === "summary" || viewingAbout
      ? null
      : (contracts.find((contract) => contract.id === tab) ?? null);

  return (
    <div className="page">
      <header className={viewingAbout ? "hero hero-about" : "hero"}>
        <div className="kicker kicker-row">
          {viewingAbout ? (
            <button
              type="button"
              className="kicker-home"
              onClick={() => setTab("summary")}
            >
              Capacidade aeroportuária · {airport.icao} ·{" "}
              {roundLabel(airport.roundId)}
            </button>
          ) : (
            <span>
              Capacidade aeroportuária · {airport.icao} ·{" "}
              {roundLabel(airport.roundId)}
            </span>
          )}
          <button
            type="button"
            className="linkish kicker-about"
            aria-current={viewingAbout ? "page" : undefined}
            onClick={() => setTab("about")}
          >
            Sobre
          </button>
        </div>
        {viewingAbout ? null : (
          <>
            <h1>{formatAirportName(airportName)}</h1>
            <p className="lede">
              Cadastre componentes operacionais a partir da lista do PMD. O
              Excel e o PDF usam o aeroporto de estudo atual.
            </p>
            <p className="lede">{UNOFFICIAL_NOTICE}</p>
            <p className="save-meta">Último estado: {formatSavedAt(savedAt)}</p>
          </>
        )}
      </header>

      {viewingAbout ? (
        <AboutPage onBack={() => setTab("summary")} />
      ) : (
        <>
      <nav className="tabs" aria-label="Seções do editor">
        <div className="tabs-pinned">
          <button
            type="button"
            className={tab === "summary" ? "tab active" : "tab"}
            aria-current={tab === "summary" ? "page" : undefined}
            onClick={() => setTab("summary")}
          >
            Resumo
          </button>
          <button
            type="button"
            className={tab === "params" ? "tab active" : "tab"}
            aria-current={tab === "params" ? "page" : undefined}
            onClick={() => setTab("params")}
          >
            Parâmetros
          </button>
        </div>
        <div className="tabs-scroll">
          {contracts.map((contract) => (
            <button
              key={contract.id}
              type="button"
              className={tab === contract.id ? "tab active" : "tab"}
              aria-current={tab === contract.id ? "page" : undefined}
              onClick={() => setTab(contract.id)}
            >
              {contract.title}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="tab tab-add"
          onClick={() => setRegisterOpen(true)}
        >
          + Componente
        </button>
      </nav>

      {tab === "summary" ? (
        <SummaryPage
          airportName={airportName}
          onAirportNameChange={setAirportName}
          airportId={airport.id}
          onAirportChange={handleAirportChange}
          sourceNote={sourceCitation(airport)}
          contracts={contracts}
          kinds={Object.fromEntries(
            registry.map((entry) => [
              entry.id,
              entry.kind ?? templateForEntry(entry)?.kind,
            ]),
          )}
          evaluations={evaluations}
          onOpenComponent={setTab}
          onRegister={() => setRegisterOpen(true)}
          onLoadExample={handleLoadExample}
          onRemove={handleRemove}
          onRemoveAll={handleRemoveAll}
        />
      ) : null}

      {tab === "params" ? (
        <ParametersTab
          airport={airport}
          registry={registry}
          onOpenComponent={setTab}
        />
      ) : null}

      {activeContract && evaluations[activeContract.id] ? (
        <ComponentEditor
          contract={activeContract}
          entry={
            registry.find((item) => item.id === activeContract.id) ?? {
              id: activeContract.id,
              title: activeContract.title,
              requirements: activeContract.requirements,
            }
          }
          drafts={
            componentDrafts[activeContract.id] ??
            draftsFromRecord(
              components[activeContract.id] ??
                defaultComponentParams(activeContract),
              activeContract.params.map((field) => field.id),
            )
          }
          origens={
            componentOrigens[activeContract.id] ??
            defaultComponentOrigens(activeContract)
          }
          justificativas={justificativas[activeContract.id] ?? {}}
          evaluation={evaluations[activeContract.id]}
          canRemove={registry.length > 0}
          onTitleChange={(title) => handleRename(activeContract.id, title)}
          onObservacoesChange={(raw) =>
            handleObservacoesChange(activeContract.id, raw)
          }
          onRemove={() => handleRemove(activeContract.id)}
          onAddArea={(companions) => handleAddArea(activeContract.id, companions)}
          onSetCompanions={(companions) =>
            handleSetCompanions(activeContract.id, companions)
          }
          onSetAreaTaxa={(taxaDiferente) =>
            handleSetAreaTaxa(activeContract.id, taxaDiferente)
          }
          onRemoveArea={() => handleRemoveArea(activeContract.id)}
          onAddEquipment={() => handleAddEquipment(activeContract.id)}
          onSetEquipmentTaxa={(taxaDiferente) =>
            handleSetEquipmentTaxa(activeContract.id, taxaDiferente)
          }
          onRemoveEquipment={() => handleRemoveEquipment(activeContract.id)}
          onSetConnection={(hasConnection) =>
            handleSetConnection(activeContract.id, hasConnection)
          }
          onNatureChange={(nature) =>
            handleNatureChange(activeContract.id, nature)
          }
          onValueChange={(id, raw) =>
            updateComponent(activeContract.id, id, raw)
          }
          onOrigemChange={(id, raw) =>
            setComponentOrigens((current) => ({
              ...current,
              [activeContract.id]: {
                ...current[activeContract.id],
                [id]: raw,
              },
            }))
          }
          onJustificationChange={(id, raw) =>
            handleJustificationChange(activeContract.id, id, raw)
          }
          onRestoreContract={(id) =>
            handleRestoreContract(activeContract.id, id)
          }
        />
      ) : null}

      <section className="actions" aria-label="Persistência e exportação">
        <input
          ref={fileInputRef}
          type="file"
          accept={`.${SNAPSHOT_EXTENSION}`}
          hidden
          onChange={(event) => void handleFileSelected(event)}
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy !== null}
        >
          {busy === "save" ? "A guardar…" : "Guardar"}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={handleLoad}
          disabled={busy !== null}
        >
          {busy === "load" ? "A carregar…" : "Carregar"}
        </button>
        <button
          type="button"
          className="accent"
          onClick={() => void handleExcel("component")}
          disabled={busy !== null || contracts.length === 0}
        >
          {busy === "excel-component"
            ? "A exportar…"
            : "Excel por componente"}
        </button>
        <button
          type="button"
          className="accent"
          onClick={() => void handleExcel("nature")}
          disabled={busy !== null || contracts.length === 0}
        >
          {busy === "excel-nature" ? "A exportar…" : "Excel por natureza"}
        </button>
        <button
          type="button"
          className="accent"
          onClick={() => void handlePdf("simplificado")}
          disabled={busy !== null || contracts.length === 0}
        >
          {busy === "simplificado" ? "A exportar…" : "PDF simplificado"}
        </button>
        <button
          type="button"
          className="accent"
          onClick={() => void handlePdf("completo")}
          disabled={busy !== null || contracts.length === 0}
        >
          {busy === "completo" ? "A exportar…" : "PDF completo"}
        </button>
      </section>

      {message ? <p className="flash">{message}</p> : null}

      <RegisterComponent
        open={registerOpen}
        contracts={contracts}
        onClose={() => setRegisterOpen(false)}
        onCreate={handleCreate}
        onClone={handleClone}
      />
        </>
      )}

      <div className="report-capture" aria-hidden="true">
        <div ref={reportRef}>
          <ReportView
            kind={pdfKind}
            airportName={airportName}
            airport={airport}
            capturedAt={new Date()}
            registry={registry}
            contracts={contracts}
            evaluations={evaluations}
            componentOrigens={componentOrigens}
          />
        </div>
      </div>
    </div>
  );
}

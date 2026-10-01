import type { AirportSource } from "./airports";
import {
  createCirculation,
  circulationWidths,
  type HorizontalCirculation,
} from "./circulation";
import {
  origensFromRegistry,
  paramsFromRegistry,
  resolveContracts,
} from "./contracts/catalog";
import { isSizingParam, isTsecParam } from "./contracts/fields";
import { entryFlowParams, tsecTargets } from "./contracts/flowParams";
import { beltTermValue } from "./contracts/formulas";
import { pmdValueFor, resolvedSources, standardTsecForParam } from "./pmd";
import {
  defaultTitleFor,
  exampleOperatingValues,
  instantiateOrgan,
  instantiableOrgans,
  naturesForTemplate,
  organAllowsEquipment,
  PMD_LINE_ORGANS,
  requirementsFromPreset,
  type OrganKind,
  type OrganNature,
  type OrganTemplate,
} from "./templates/organs";
import {
  natureOfEntry,
  type ComponentId,
  type ComponentJustificativas,
  type ComponentParamId,
  type ComponentParams,
  type ComponentRequirements,
  type RegistryEntry,
  type SizingParamId,
} from "./types";

export interface ExampleStudy {
  registry: RegistryEntry[];
  components: Record<ComponentId, ComponentParams>;
  componentOrigens: Record<
    ComponentId,
    Record<ComponentParamId, string>
  >;
  justificativas: Record<ComponentId, ComponentJustificativas>;
  circulations: HorizontalCirculation[];
}

const AREA_TU = 85;
const EQUIPMENT_TU = 90;

const EXTRA_INSTANCES: ReadonlyArray<{
  kind: OrganKind;
  nature: OrganNature;
}> = [
  { kind: "saguao-embarque", nature: "misto" },
  { kind: "saguao-desembarque", nature: "misto" },
  { kind: "checkin-bagagens", nature: "misto" },
  { kind: "sala-desembarque", nature: "misto" },
  { kind: "saguao-embarque-desembarque", nature: "domestico" },
  { kind: "saguao-embarque-desembarque", nature: "misto" },
];

const PROCESS_CODE: Record<string, string> = {
  "saguao-embarque:domestico": "EX-014",
  "saguao-embarque:misto": "EX-015",
  "saguao-desembarque:domestico": "EX-016",
  "saguao-desembarque:misto": "EX-017",
  "saguao-embarque-desembarque:domestico": "EX-018",
  "saguao-embarque-desembarque:misto": "EX-019",
  "checkin-bagagens:domestico": "EX-020",
  "checkin-bagagens:misto": "EX-021",
  "inspecao:domestico": "EX-022",
  "emigracao:internacional": "EX-023",
  "imigracao:internacional": "EX-024",
  "aduana:internacional": "EX-025",
  "sala-embarque-pontes:domestico": "EX-026",
  "sala-embarque-remotas:domestico": "EX-027",
  "sala-embarque-pontes-sentado:domestico": "EX-026",
  "sala-embarque-remotas-sentado:domestico": "EX-027",
  "salas-embarque:domestico": "EX-028",
  "sala-desembarque:domestico": "EX-029",
  "sala-desembarque:misto": "EX-030",
};

/** Estudo ilustrativo do aeroporto selecionado. Não é a semente de migração. */
export function exampleStudy(source: AirportSource): ExampleStudy {
  const registry = exampleRegistry(source);
  const components = paramsFromRegistry(registry, source);
  const componentOrigens = origensFromRegistry(registry, source);
  const justificativas: Record<ComponentId, ComponentJustificativas> = {};

  for (const entry of registry) {
    const params = components[entry.id];
    if (!params) continue;
    const just: ComponentJustificativas = {};
    fillOperations(entry, params);
    deviateSizing(entry, params, just, source);
    applyTsec(entry, params, just);
    applyBelt(entry, params, just);
    if (Object.keys(just).length > 0) justificativas[entry.id] = just;
  }

  return {
    registry,
    components,
    componentOrigens,
    justificativas,
    circulations: exampleCirculations(registry),
  };
}

function exampleRegistry(source: AirportSource): RegistryEntry[] {
  const available = new Map(
    instantiableOrgans(source).map((template) => [template.kind, template]),
  );
  const lineIds = new Set(PMD_LINE_ORGANS.map((template) => template.kind));
  const planned: Array<{ template: OrganTemplate; nature: OrganNature }> = [];

  for (const template of instantiableOrgans(source)) {
    if (!lineIds.has(template.kind)) continue;
    const nature = naturesForTemplate(template)[0];
    if (nature) planned.push({ template, nature });
  }
  for (const extra of EXTRA_INSTANCES) {
    const template = available.get(extra.kind);
    if (!template) continue;
    if (!naturesForTemplate(template).includes(extra.nature)) continue;
    planned.push({ template, nature: extra.nature });
  }

  const registry: RegistryEntry[] = [];
  for (const { template, nature } of planned) {
    const created = instantiateOrgan(
      template,
      nature,
      defaultTitleFor(template, nature),
      registry.map((entry) => entry.id),
    );
    const note = observation(template.kind, nature);
    registry.push({
      ...created,
      requirements: exampleRequirements(template),
      ...(note ? { observacoes: note } : {}),
      ...(exampleConnection(template.kind, nature)
        ? { hasConnection: true }
        : {}),
    });
  }
  return registry;
}

function exampleRequirements(template: OrganTemplate): ComponentRequirements {
  const requirements = requirementsFromPreset(template.preset);
  if (requirements.area && template.preset === "areaCompanions") {
    requirements.area = { companions: true, taxaDiferente: true };
  }
  if (organAllowsEquipment({ kind: template.kind })) {
    requirements.equipment = { taxaDiferente: true };
  }
  if (template.kind === "sala-desembarque") {
    requirements.esteira = {};
  }
  return requirements;
}

function exampleConnection(kind: OrganKind, nature: OrganNature): boolean {
  if (kind === "saguao-embarque" || kind === "saguao-embarque-desembarque") {
    return true;
  }
  return kind === "saguao-desembarque" && nature === "misto";
}

function processCode(entry: RegistryEntry): string {
  const nature = natureOfEntry(entry) ?? "";
  return PROCESS_CODE[`${entry.kind}:${nature}`] ?? "EX-000";
}

const COMPONENT_NOTES: Record<string, string> = {
  "saguao-embarque:domestico": "Apenas piso superior",
  "saguao-embarque:misto": "Visualizado fora do horário pico",
  "saguao-desembarque:domestico": "Foi considerado sem conexão",
  "checkin-bagagens:domestico": "Visualizado fora do horário pico",
  "inspecao:domestico": "Apenas piso superior",
  "emigracao:internacional": "Foi considerado sem conexão",
  "aduana:internacional": "Visualizado fora do horário pico",
  "sala-embarque-pontes:domestico": "Apenas piso superior",
  "sala-embarque-pontes-sentado:domestico": "Apenas piso superior",
  "salas-embarque:domestico": "Foi considerado sem conexão",
  "sala-desembarque:misto": "Visualizado fora do horário pico",
  "saguao-embarque-desembarque:domestico": "Apenas piso superior",
};

function alteration(code: string): string {
  return `Alteração em virtude processo ${code}.`;
}

function observation(kind: string, nature: OrganNature): string | undefined {
  const note = COMPONENT_NOTES[`${kind}:${nature}`]?.trim();
  return note ? note : undefined;
}

function fillOperations(entry: RegistryEntry, params: ComponentParams): void {
  const contract = resolveContracts([entry])[0];
  const kind = entry.kind ?? "";
  for (const field of contract.params) {
    if (field.id.startsWith("demandaPico")) {
      params[field.id] = demandValue(kind, field.id);
    }
    if (field.id === "areaMedida") params.areaMedida = areaValue(entry);
    if (field.id === "quantidadeEquipamentos") {
      params.quantidadeEquipamentos = equipmentQuantity(entry);
    }
    if (field.id === "taxaDeUsoArea") params.taxaDeUsoArea = AREA_TU;
    if (field.id === "taxaDeUsoAreaDomestico") {
      params.taxaDeUsoAreaDomestico = AREA_TU;
    }
    if (field.id === "taxaDeUsoAreaInternacional") {
      params.taxaDeUsoAreaInternacional = 75;
    }
    if (field.id === "taxaDeUsoEquipamento") {
      params.taxaDeUsoEquipamento = EQUIPMENT_TU;
    }
    if (field.id === "taxaDeUsoEquipamentoDomestico") {
      params.taxaDeUsoEquipamentoDomestico = EQUIPMENT_TU;
    }
    if (field.id === "taxaDeUsoEquipamentoInternacional") {
      params.taxaDeUsoEquipamentoInternacional = 80;
    }
  }
}

function demandValue(kind: string, id: ComponentParamId): number {
  const base = exampleOperatingValues(kind)?.demandaPico ?? 400;
  if (id.includes("Conexao")) {
    if (id.includes("Internacional")) return Math.round(base * 0.15);
    if (id.includes("Domestico")) return Math.round(base * 0.2);
    return Math.round(base * 0.25);
  }
  if (id.includes("Internacional")) return Math.round(base * 0.55);
  if (id.includes("Desembarque")) return Math.round(base * 0.85);
  return base;
}

function areaValue(entry: RegistryEntry): number {
  const kind = entry.kind ?? "";
  const base = exampleOperatingValues(kind)?.areaMedida ?? 800;
  const nature = natureOfEntry(entry);
  if (kind === "saguao-embarque-desembarque") {
    return nature === "misto" ? Math.round(base * 2.2) : Math.round(base * 1.6);
  }
  if (nature === "misto") return Math.round(base * 1.5);
  return base;
}

function equipmentQuantity(entry: RegistryEntry): number {
  const kind = entry.kind ?? "";
  if (kind === "checkin-bagagens" && natureOfEntry(entry) === "misto") return 8;
  const listed = exampleOperatingValues(kind)?.quantidadeEquipamentos;
  if (listed != null) return listed;
  if (kind === "emigracao") return 3;
  if (kind === "imigracao") return 2;
  return 4;
}

function preference(kind: string | undefined): SizingParamId[] {
  if (
    kind === "sala-embarque-pontes" ||
    kind === "sala-embarque-pontes-sentado" ||
    kind === "sala-embarque-remotas-sentado"
  ) {
    return ["percentualMinimoAssentos"];
  }
  return [];
}

function deviateSizing(
  entry: RegistryEntry,
  params: ComponentParams,
  just: ComponentJustificativas,
  source: AirportSource,
): void {
  const contract = resolveContracts([entry])[0];
  const present = new Set(contract.params.map((field) => field.id));
  const sources = resolvedSources(entry);
  const id = preference(entry.kind).find((candidate) => {
    if (candidate.startsWith("tempoDeOcupacao")) return false;
    if (!present.has(candidate) || !isSizingParam(candidate)) return false;
    const ref = sources[candidate];
    return ref != null && pmdValueFor(ref, candidate, source) != null;
  });
  if (!id || !isSizingParam(id)) return;
  const next = bump(id, params[id]);
  if (next === params[id]) return;
  params[id] = next;
  just[id] = alteration(processCode(entry));
}

function bump(id: SizingParamId, value: number): number {
  if (id === "percentualMinimoAssentos" || id === "percentualOcupacaoMaxima") {
    return Math.max(1, Math.round((value - 10) * 100) / 100);
  }
  if (id.startsWith("tempoDeOcupacao")) return value + 5;
  return Math.round((value + 0.2) * 100) / 100;
}

function applyTsec(
  entry: RegistryEntry,
  params: ComponentParams,
  just: ComponentJustificativas,
): void {
  if (entry.kind === "aduana") {
    params.tsec = exampleOperatingValues(entry.kind)?.tsec ?? 45;
    return;
  }
  const mixed = natureOfEntry(entry) === "misto";
  for (const target of tsecTargets(entry)) {
    if (!isTsecParam(target.id)) continue;
    const standard = standardTsecForParam(entry, target.id);
    if (standard == null) continue;
    const next = exampleTsecValue(entry.kind, mixed, target.nature);
    if (next == null || next === standard) continue;
    params[target.id] = next;
    just[target.id] = alteration(processCode(entry));
  }
}

function exampleTsecValue(
  kind: string | undefined,
  mixed: boolean,
  nature: "domestico" | "internacional",
): number | null {
  if (kind === "checkin-bagagens") {
    if (mixed) return nature === "internacional" ? 200 : 170;
    return 180;
  }
  if (kind === "inspecao") return 40;
  if (kind === "emigracao" || kind === "imigracao") return 90;
  return null;
}

function applyBelt(
  entry: RegistryEntry,
  params: ComponentParams,
  just: ComponentJustificativas,
): void {
  if (entry.kind !== "sala-desembarque") return;
  const meets = natureOfEntry(entry) !== "misto";
  const comment = alteration(processCode(entry));
  if (meets) {
    params.taxaRetiradaBagagem = 40;
    just.taxaRetiradaBagagem = comment;
  } else {
    params.comprimentoLinearPassageiro = 1.1;
    just.comprimentoLinearPassageiro = comment;
  }
  const required = beltRequired(entry, params);
  params.comprimentoEsteiras = meets
    ? Math.ceil(required + 15)
    : Math.max(0, Math.floor(required * 0.4));
}

function beltRequired(entry: RegistryEntry, params: ComponentParams): number {
  const flows = entryFlowParams(entry);
  if (flows.length === 0) {
    return beltTermValue(params, "demandaPico", "tempoDeOcupacao");
  }
  return flows.reduce(
    (sum, flow) => sum + beltTermValue(params, flow.demanda, flow.toi),
    0,
  );
}

function exampleCirculations(
  registry: RegistryEntry[],
): HorizontalCirculation[] {
  const checkin = findBase(registry, "checkin-bagagens");
  const boarding = findBase(registry, "saguao-embarque");
  const security = findBase(registry, "inspecao");
  const arrivalsHall = findBase(registry, "sala-desembarque");
  const mixedArrivals = findEntry(registry, "saguao-desembarque", "misto");
  const items: HorizontalCirculation[] = [];

  if (checkin) {
    items.push(
      sized(
        {
          ...createCirculation("circ-checkin", "Check-in"),
          kind: "interna",
          componentId: checkin.id,
          dhp: 240,
          pmm: 20,
          efeitoBorda: true,
          eb: 0.5,
          observacoes:
            "Corredor interno do check-in no exemplo fictício, com efeito de borda no padrão do manual.",
        },
        "meet",
      ),
    );
  }
  if (boarding && security) {
    items.push(
      sized(
        {
          ...createCirculation("circ-transicao", "Embarque para inspeção"),
          kind: "transicao",
          fromId: boarding.id,
          toId: security.id,
          dhp: 900,
          pmm: 16,
          pmmJustificativa: alteration("EX-031"),
          efeitoBorda: true,
          eb: 0.5,
          efeitoContrafluxo: true,
          ec: 0.7,
          ecJustificativa: alteration("EX-031"),
          observacoes:
            "Transição do saguão de embarque para a inspeção, com os dois efeitos marcados.",
        },
        "fail",
      ),
    );
  }
  if (arrivalsHall) {
    items.push(
      sized(
        {
          ...createCirculation("circ-sala", "Sala de desembarque"),
          kind: "interna",
          componentId: arrivalsHall.id,
          dhp: 180,
          pmm: 20,
          observacoes:
            "Largura ainda não medida neste trecho fictício da sala de desembarque.",
        },
        "open",
      ),
    );
  }
  if (mixedArrivals) {
    items.push(
      sized(
        {
          ...createCirculation("circ-desembarque", "Saguão de desembarque"),
          kind: "interna",
          componentId: mixedArrivals.id,
          dhp: 300,
          pmm: 20,
          efeitoBorda: true,
          eb: 0.5,
          observacoes:
            "Circulação interna do saguão de desembarque misto, só com efeito de borda.",
        },
        "meet",
      ),
    );
  }
  return items;
}

function findBase(
  registry: RegistryEntry[],
  kind: OrganKind,
): RegistryEntry | undefined {
  return registry.find(
    (entry) => entry.kind === kind && natureOfEntry(entry) !== "misto",
  );
}

function findEntry(
  registry: RegistryEntry[],
  kind: OrganKind,
  nature: OrganNature,
): RegistryEntry | undefined {
  return registry.find(
    (entry) => entry.kind === kind && natureOfEntry(entry) === nature,
  );
}

function sized(
  item: HorizontalCirculation,
  mode: "meet" | "fail" | "open",
): HorizontalCirculation {
  if (mode === "open") return { ...item, larguraMedida: null };
  const lt = circulationWidths({ ...item, larguraMedida: null }).lt;
  if (!Number.isFinite(lt)) return { ...item, larguraMedida: null };
  if (mode === "meet") {
    return { ...item, larguraMedida: Math.ceil((lt + 0.5) * 10) / 10 };
  }
  const below = Math.round((lt - 0.4) * 10) / 10;
  return { ...item, larguraMedida: below > 0 ? below : 0 };
}

import { slugify } from "../contracts/factory";
import { identityParamIds } from "../contracts/flowParams";
import type { AirportSource } from "../airports";
import {
  applyPmdRequirements,
  natureHasValues,
  normalizePmdBinding,
  pmdById,
  pmdRows,
} from "../pmd";
import {
  natureOfEntry,
  type ComponentId,
  type ComponentParamId,
  type ComponentParams,
  type ComponentRequirements,
  type PeakNature,
  type PmdBinding,
  type RegistryEntry,
  type RegistryFlow,
} from "../types";

/** Natureza da instância — independente das colunas do PMD. */
export type OrganNature = PeakNature | "misto";

export type OrganKind =
  | "generic"
  | "special"
  | "saguao-embarque"
  | "saguao-desembarque"
  | "saguao-embarque-desembarque"
  | "checkin-bagagens"
  | "inspecao"
  | "emigracao"
  | "imigracao"
  | "aduana"
  | "sala-embarque-pontes"
  | "sala-embarque-remotas"
  | "salas-embarque"
  | "sala-desembarque"
  | "sala-embarque-desembarque";

export type OrganRequirementPreset = "area" | "areaCompanions" | "areaSeats" | "areaAndEquipment";

export interface OrganFlow {
  role: "embarque" | "desembarque" | "unico";
  nature: PeakNature;
  pmd: PmdBinding;
}

export interface OrganTemplate {
  kind: OrganKind;
  title: string;
  natures: readonly OrganNature[];
  preset: OrganRequirementPreset | "none" | "special";
  /** Uma ligação PMD por fluxo. Misto duplica cada fluxo em doméstico e internacional. */
  flows: ReadonlyArray<{
    role: OrganFlow["role"];
    rowId: string;
  }>;
  detail: string;
}

export const PREDEFINED_ORGANS: OrganTemplate[] = [
  {
    kind: "saguao-embarque",
    title: "Saguão de embarque",
    natures: ["domestico", "internacional", "misto"],
    preset: "areaCompanions",
    flows: [{ role: "embarque", rowId: "saguao-embarque" }],
    detail:
      "Público antes do processamento, Emp por ocupante e v.a. Natureza mista: dois DHp. Conexão opcional: DHp extra de embarque via conexão (no misto, agregada).",
  },
  {
    kind: "saguao-desembarque",
    title: "Saguão de desembarque",
    natures: ["domestico", "internacional", "misto"],
    preset: "areaCompanions",
    flows: [{ role: "desembarque", rowId: "saguao-desembarque" }],
    detail:
      "Público após o desembarque. Toi internacional maior que o doméstico. Natureza mista: dois DHp; Ad = Ad_d,dom + Ad_d,int. Conexão opcional no misto: DOM/INT na conta doméstica e INT/DOM + INT/INT na internacional, sem acompanhante.",
  },
  {
    kind: "saguao-embarque-desembarque",
    title: "Saguão de embarque e desembarque",
    natures: ["domestico", "internacional", "misto"],
    preset: "areaCompanions",
    flows: [
      { role: "embarque", rowId: "saguao-embarque" },
      { role: "desembarque", rowId: "saguao-desembarque" },
    ],
    detail:
      "Um componente operacional, duas funções de saguão. DHp por função; misto também por natureza. Conexão opcional só no embarque (no misto, agregada).",
  },
  {
    kind: "checkin-bagagens",
    title: "Check-in e despacho de bagagens",
    natures: ["domestico", "internacional", "misto"],
    preset: "areaAndEquipment",
    flows: [{ role: "unico", rowId: "checkin-bagagens" }],
    detail:
      "Área de fila (PMD) e equipamentos de atendimento. Natureza mista: dois DHp; Ad = Ad_dom + Ad_int.",
  },
  {
    kind: "inspecao",
    title: "Inspeção de segurança",
    natures: ["domestico", "internacional"],
    preset: "areaAndEquipment",
    flows: [{ role: "unico", rowId: "inspecao" }],
    detail: "Área de fila (PMD) e equipamentos de inspeção.",
  },
  {
    kind: "emigracao",
    title: "Emigração",
    natures: ["internacional"],
    preset: "area",
    flows: [{ role: "unico", rowId: "emigracao" }],
    detail: "Só há PMD na coluna internacional.",
  },
  {
    kind: "imigracao",
    title: "Imigração",
    natures: ["internacional"],
    preset: "area",
    flows: [{ role: "unico", rowId: "imigracao" }],
    detail: "Só há PMD na coluna internacional.",
  },
  {
    kind: "aduana",
    title: "Aduana",
    natures: ["internacional"],
    preset: "areaAndEquipment",
    flows: [{ role: "unico", rowId: "aduana" }],
    detail: "Só há PMD na coluna internacional. Emp 1,7 m²/pax.",
  },
  {
    kind: "sala-embarque-pontes",
    title:
      "Sala de embarque de atendimento em posições próximas (pontes de embarque)",
    natures: ["domestico", "internacional"],
    preset: "areaSeats",
    flows: [{ role: "embarque", rowId: "sala-embarque-pontes" }],
    detail: "Espera em pontes. Emp 2,3; Toi 40/60; 70% de assentos.",
  },
  {
    kind: "sala-embarque-remotas",
    title: "Sala de embarque de atendimento em posições remotas",
    natures: ["domestico", "internacional"],
    preset: "areaSeats",
    flows: [{ role: "embarque", rowId: "sala-embarque-remotas" }],
    detail: "Espera em posições remotas. Mesmos números de pontes nesta rodada.",
  },
  {
    kind: "salas-embarque",
    title: "Salas de embarque",
    natures: ["domestico", "internacional"],
    preset: "areaSeats",
    flows: [{ role: "embarque", rowId: "salas-embarque" }],
    detail:
      "Contrato com sentado e em pé. Ocup_max, Pa, Emp_s, Toi_s, Emp_p e Toi_p. Sem contagem separada de assentos.",
  },
  {
    kind: "sala-desembarque",
    title: "Sala de desembarque",
    natures: ["domestico", "internacional", "misto"],
    preset: "area",
    flows: [{ role: "desembarque", rowId: "sala-desembarque" }],
    detail:
      "Desembarque da aeronave. Toi vem da tabela do aeroporto. Natureza mista: dois DHp; Ad = Ad_d,dom + Ad_d,int. Sem acompanhante e sem N. O requisito opcional é o comprimento mínimo de esteira.",
  },
];

export const GENERIC_ORGAN: OrganTemplate = {
  kind: "generic",
  title: "Componente genérico",
  natures: [],
  preset: "none",
  flows: [],
  detail: "Instância zerada. Requisitos e PMD entram depois.",
};

export const SPECIAL_CURB: OrganTemplate = {
  kind: "special",
  title: "Meio-fio",
  natures: [],
  preset: "special",
  flows: [],
  detail: "Sem linha de PMD. Contas próprias; não modelar agora.",
};

/** Tipos que batem 1:1 com uma linha do PMD. Combinações (saguão misto) ficam fora. */
export const PMD_LINE_ORGANS: OrganTemplate[] = PREDEFINED_ORGANS.filter(
  (template) => template.flows.length === 1,
);

/** Lista de cadastro: linhas do PMD + saguão de embarque e desembarque (dois fluxos). */
export const INSTANTIABLE_ORGANS: OrganTemplate[] = PREDEFINED_ORGANS.filter(
  (template) =>
    template.flows.length === 1 ||
    template.kind === "saguao-embarque-desembarque",
);

/** Tipos cuja linha existe na tabela PMD do aeroporto. */
export function instantiableOrgans(source: AirportSource): OrganTemplate[] {
  const rows = new Set(pmdRows(source).map((row) => row.id));
  return INSTANTIABLE_ORGANS.filter((template) =>
    template.flows.every((flow) => rows.has(flow.rowId)),
  );
}

/** Ordem da jornada no Resumo: embarque e, em seguida, desembarque. */
export const JOURNEY_ORDER: readonly {
  kind: OrganKind;
  leg: "embarque" | "desembarque";
}[] = [
  { kind: "saguao-embarque", leg: "embarque" },
  { kind: "saguao-embarque-desembarque", leg: "embarque" },
  { kind: "checkin-bagagens", leg: "embarque" },
  { kind: "inspecao", leg: "embarque" },
  { kind: "emigracao", leg: "embarque" },
  { kind: "sala-embarque-pontes", leg: "embarque" },
  { kind: "sala-embarque-remotas", leg: "embarque" },
  { kind: "salas-embarque", leg: "embarque" },
  { kind: "sala-desembarque", leg: "desembarque" },
  { kind: "imigracao", leg: "desembarque" },
  { kind: "aduana", leg: "desembarque" },
  { kind: "saguao-desembarque", leg: "desembarque" },
];

const JOURNEY_RANK = new Map(
  JOURNEY_ORDER.map((step, index) => [step.kind, index]),
);

const JOURNEY_LEG = new Map(JOURNEY_ORDER.map((step) => [step.kind, step.leg]));

export function journeyRank(kind: string | undefined): number {
  if (!kind) return Number.MAX_SAFE_INTEGER;
  return JOURNEY_RANK.get(kind as OrganKind) ?? Number.MAX_SAFE_INTEGER;
}

export function journeyLeg(
  kind: string | undefined,
): "embarque" | "desembarque" | undefined {
  if (!kind) return undefined;
  return JOURNEY_LEG.get(kind as OrganKind);
}

export function templateByKind(kind: string): OrganTemplate | undefined {
  return INSTANTIABLE_ORGANS.find((template) => template.kind === kind);
}

export function templateForEntry(entry: RegistryEntry): OrganTemplate | undefined {
  if (entry.kind) return templateByKind(entry.kind);
  const rowId = entry.pmd?.rowId;
  if (!rowId) return undefined;
  return PMD_LINE_ORGANS.find((template) => template.flows[0]?.rowId === rowId);
}

export function naturesForTemplate(template: OrganTemplate): OrganNature[] {
  const peaks = (["domestico", "internacional"] as const).filter((nature) =>
    template.flows.every((flow) => {
      const row = pmdById(flow.rowId);
      return row != null && natureHasValues(row, nature);
    }),
  );
  const next: OrganNature[] = [...peaks];
  if (
    template.natures.includes("misto") &&
    peaks.includes("domestico") &&
    peaks.includes("internacional")
  ) {
    next.push("misto");
  }
  return next;
}

export function organNatureLabel(nature: OrganNature): string {
  if (nature === "misto") return "misto";
  return nature === "internacional" ? "internacional" : "doméstico";
}

export { natureOfEntry };

function bindOrganPmd(
  template: OrganTemplate,
  nature: OrganNature,
): Pick<RegistryEntry, "pmd" | "flows"> {
  if (nature !== "misto" && template.flows.length === 1) {
    const rowId = template.flows[0]?.rowId;
    if (!rowId) {
      throw new Error(`Tipo “${template.kind}” sem linha de PMD.`);
    }
    const binding = normalizePmdBinding({ rowId, nature });
    if (!binding) {
      throw new Error(
        `Tipo “${template.title}” sem valores de PMD nessa natureza.`,
      );
    }
    return { pmd: binding };
  }

  const flows: RegistryFlow[] = [];
  for (const flow of expandFlows(template, nature)) {
    if (
      flow.role !== "embarque" &&
      flow.role !== "desembarque" &&
      flow.role !== "unico"
    ) {
      continue;
    }
    const pmd = normalizePmdBinding(flow.pmd);
    if (!pmd) {
      throw new Error(
        `Tipo “${template.title}” sem valores de PMD nessa natureza (${flow.role}).`,
      );
    }
    flows.push({ role: flow.role, pmd });
  }
  if (flows.length < 2) {
    throw new Error(
      nature === "misto"
        ? `Tipo “${template.title}” não admite natureza mista.`
        : `Tipo “${template.kind}” precisa de dois fluxos de PMD.`,
    );
  }
  const embarque = flows.find((flow) => flow.role === "embarque");
  const domestico = flows.find((flow) => flow.pmd.nature === "domestico");
  return { pmd: embarque?.pmd ?? domestico?.pmd ?? flows[0].pmd, flows };
}

export function rebindOrganNature(
  entry: RegistryEntry,
  nature: OrganNature,
): RegistryEntry {
  const template = templateForEntry(entry);
  if (!template) return entry;
  if (!naturesForTemplate(template).includes(nature)) return entry;
  if (natureOfEntry(entry) === nature) return entry;
  const bound = bindOrganPmd(template, nature);
  return applyPmdRequirements({
    id: entry.id,
    title: entry.title,
    kind: template.kind,
    requirements: entry.requirements,
    observacoes: entry.observacoes,
    hasConnection: entry.hasConnection,
    pmd: bound.pmd,
    ...(bound.flows ? { flows: bound.flows } : {}),
  });
}

type DemandaRole = "unico" | "embarque" | "desembarque";

const DEMANDA_SLOTS: Partial<
  Record<ComponentParamId, { role: DemandaRole; nature?: PeakNature }>
> = {
  demandaPico: { role: "unico" },
  demandaPicoEmbarque: { role: "embarque" },
  demandaPicoDesembarque: { role: "desembarque" },
  demandaPicoEmbarqueDomestico: { role: "embarque", nature: "domestico" },
  demandaPicoEmbarqueInternacional: {
    role: "embarque",
    nature: "internacional",
  },
  demandaPicoDesembarqueDomestico: { role: "desembarque", nature: "domestico" },
  demandaPicoDesembarqueInternacional: {
    role: "desembarque",
    nature: "internacional",
  },
  demandaPicoDomestico: { role: "unico", nature: "domestico" },
  demandaPicoInternacional: { role: "unico", nature: "internacional" },
};

function peakOfEntry(entry: RegistryEntry): PeakNature | undefined {
  const nature = natureOfEntry(entry);
  if (nature == null || nature === "misto") return undefined;
  return nature;
}

function demandaSlotKey(role: DemandaRole, nature: PeakNature): string {
  return `${role}::${nature}`;
}

function lookupDemanda(
  map: Map<string, number>,
  role: DemandaRole,
  nature: PeakNature,
): number {
  const exact = map.get(demandaSlotKey(role, nature));
  if (exact != null) return exact;
  if (role === "unico") {
    return (
      map.get(demandaSlotKey("embarque", nature)) ??
      map.get(demandaSlotKey("desembarque", nature)) ??
      0
    );
  }
  return map.get(demandaSlotKey("unico", nature)) ?? 0;
}

/** Copia DHp entre desenhos de campo ao trocar a natureza. */
export function remapDemandaOnNatureChange(
  from: RegistryEntry,
  to: RegistryEntry,
  params: ComponentParams,
): Partial<Record<ComponentParamId, number>> {
  const fromIds = new Set(identityParamIds(from));
  const fromPeak = peakOfEntry(from);
  const map = new Map<string, number>();
  for (const id of identityParamIds(from)) {
    if (id.startsWith("demandaPicoConexao")) continue;
    const slot = DEMANDA_SLOTS[id];
    if (!slot) continue;
    const nature = slot.nature ?? fromPeak;
    if (!nature) continue;
    map.set(demandaSlotKey(slot.role, nature), params[id] ?? 0);
  }

  const toPeak = peakOfEntry(to);
  const next: Partial<Record<ComponentParamId, number>> = {};
  for (const id of identityParamIds(to)) {
    if (id.startsWith("demandaPicoConexao")) {
      if (fromIds.has(id)) next[id] = params[id] ?? 0;
      continue;
    }
    if (fromIds.has(id)) {
      next[id] = params[id] ?? 0;
      continue;
    }
    const slot = DEMANDA_SLOTS[id];
    if (!slot) continue;
    const nature = slot.nature ?? toPeak;
    next[id] = nature ? lookupDemanda(map, slot.role, nature) : 0;
  }
  return next;
}

export function requirementsFromPreset(
  preset: OrganTemplate["preset"],
): ComponentRequirements {
  switch (preset) {
    case "areaCompanions":
      return { area: { companions: true } };
    case "areaSeats":
    case "area":
      return { area: { companions: false } };
    case "areaAndEquipment":
      return { area: { companions: false }, equipment: {} };
    default:
      return {};
  }
}

export function defaultTitleFor(
  template: OrganTemplate,
  nature: OrganNature,
): string {
  const natures = naturesForTemplate(template);
  if (natures.length <= 1) return template.title;
  return `${template.title} ${organNatureLabel(nature)}`;
}

export function instantiateOrgan(
  template: OrganTemplate,
  nature: OrganNature,
  title: string,
  existingIds: ComponentId[],
): RegistryEntry {
  const bound = bindOrganPmd(template, nature);
  return applyPmdRequirements({
    id: slugify(template.kind, existingIds),
    title: title.trim() ? title : defaultTitleFor(template, nature),
    kind: template.kind,
    requirements: {},
    pmd: bound.pmd,
    ...(bound.flows ? { flows: bound.flows } : {}),
  });
}

const COMPANION_PRESET = "areaCompanions";

/** Com ou sem acompanhante só nos saguões (preset `areaCompanions`). */
export function organAllowsCompanions(entry: RegistryEntry): boolean {
  return templateForEntry(entry)?.preset === COMPANION_PRESET;
}

const EQUIPMENT_KINDS = new Set<OrganKind>([
  "checkin-bagagens",
  "inspecao",
  "emigracao",
  "imigracao",
  "aduana",
]);

/** Requisito de equipamentos só nos processadores. Saguões e salas são só área. */
export function organAllowsEquipment(entry: { kind?: string }): boolean {
  return EQUIPMENT_KINDS.has(entry.kind as OrganKind);
}

export function suggestedCompanions(
  template: OrganTemplate | undefined,
): boolean {
  return template?.preset === COMPANION_PRESET;
}

export interface ExampleOperatingValues {
  demandaPico: number;
  areaMedida: number;
  quantidadeEquipamentos?: number;
  tsec?: number;
}

/** Números ilustrativos do “Carregar exemplo fictício”, não valores de contrato. */
export function exampleOperatingValues(
  kind: string | undefined,
): ExampleOperatingValues | undefined {
  switch (kind) {
    case "saguao-embarque":
      return { demandaPico: 450, areaMedida: 650 };
    case "saguao-desembarque":
      return { demandaPico: 400, areaMedida: 400 };
    case "checkin-bagagens":
      return {
        demandaPico: 400,
        areaMedida: 120,
        quantidadeEquipamentos: 12,
      };
    case "inspecao":
      return {
        demandaPico: 380,
        areaMedida: 90,
        quantidadeEquipamentos: 4,
      };
    case "emigracao":
      return { demandaPico: 180, areaMedida: 80 };
    case "imigracao":
      return { demandaPico: 180, areaMedida: 80 };
    case "aduana":
      return {
        demandaPico: 120,
        areaMedida: 140,
        quantidadeEquipamentos: 4,
        tsec: 45,
      };
    case "sala-embarque-pontes":
      return { demandaPico: 350, areaMedida: 380 };
    case "sala-embarque-remotas":
      return { demandaPico: 200, areaMedida: 280 };
    case "salas-embarque":
      return { demandaPico: 350, areaMedida: 380 };
    case "sala-desembarque":
      return { demandaPico: 400, areaMedida: 260 };
    default:
      return undefined;
  }
}

export function expandFlows(
  template: OrganTemplate,
  nature: OrganNature,
): OrganFlow[] {
  const natures: PeakNature[] =
    nature === "misto" ? ["domestico", "internacional"] : [nature];
  const flows: OrganFlow[] = [];
  for (const flow of template.flows) {
    for (const item of natures) {
      flows.push({
        role: flow.role,
        nature: item,
        pmd: { rowId: flow.rowId, nature: item },
      });
    }
  }
  return flows;
}

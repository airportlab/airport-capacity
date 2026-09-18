import { slugify } from "../contracts/factory";
import {
  applyPmdRequirements,
  natureHasValues,
  normalizePmdBinding,
  pmdById,
} from "../pmd";
import type {
  ComponentId,
  ComponentRequirements,
  PeakNature,
  PmdBinding,
  RegistryEntry,
  RegistryFlow,
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
      "Público antes do processamento, Emp por ocupante e v.a. Natureza mista: dois DHp.",
  },
  {
    kind: "saguao-desembarque",
    title: "Saguão de desembarque",
    natures: ["domestico", "internacional"],
    preset: "areaCompanions",
    flows: [{ role: "unico", rowId: "saguao-desembarque" }],
    detail: "Público após o desembarque. Toi internacional maior que o doméstico.",
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
    detail: "Um componente operacional, duas funções de saguão. DHp por função; misto também por natureza.",
  },
  {
    kind: "checkin-bagagens",
    title: "Check-in e despacho de bagagens",
    natures: ["domestico", "internacional"],
    preset: "areaAndEquipment",
    flows: [{ role: "unico", rowId: "checkin-bagagens" }],
    detail: "Área de fila (PMD) e equipamentos de atendimento.",
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
    kind: "sala-desembarque",
    title: "Sala de desembarque",
    natures: ["domestico", "internacional"],
    preset: "area",
    flows: [{ role: "desembarque", rowId: "sala-desembarque" }],
    detail: "Desembarque da aeronave. Toi 20 doméstico, 45 internacional.",
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
  if (nature === "misto" || template.flows.length > 1) {
    const flows: RegistryFlow[] = [];
    for (const flow of expandFlows(template, nature)) {
      if (flow.role !== "embarque" && flow.role !== "desembarque") continue;
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
    return applyPmdRequirements({
      id: slugify(template.kind, existingIds),
      title: title.trim() ? title : defaultTitleFor(template, nature),
      kind: template.kind,
      requirements: {},
      pmd: embarque?.pmd ?? flows[0].pmd,
      flows,
    });
  }

  const rowId = template.flows[0]?.rowId;
  if (!rowId) {
    throw new Error(`Tipo “${template.kind}” sem linha de PMD.`);
  }
  const binding = normalizePmdBinding({ rowId, nature });
  if (!binding) {
    throw new Error(`Tipo “${template.title}” sem valores de PMD nessa natureza.`);
  }
  return applyPmdRequirements({
    id: slugify(template.kind, existingIds),
    title: title.trim() ? title : defaultTitleFor(template, binding.nature),
    kind: template.kind,
    requirements: {},
    pmd: binding,
  });
}

export function suggestedCompanions(
  template: OrganTemplate | undefined,
): boolean {
  return template?.preset === "areaCompanions";
}

export interface ExampleOperatingValues {
  demandaPico: number;
  areaMedida: number;
  quantidadeEquipamentos?: number;
  tsec?: number;
  tempoOcupacaoEquipamento?: number;
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
        tsec: 90,
        tempoOcupacaoEquipamento: 0,
      };
    case "inspecao":
      return {
        demandaPico: 380,
        areaMedida: 90,
        quantidadeEquipamentos: 4,
        tsec: 22,
        tempoOcupacaoEquipamento: 0,
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
        tempoOcupacaoEquipamento: 0,
      };
    case "sala-embarque-pontes":
      return { demandaPico: 350, areaMedida: 380 };
    case "sala-embarque-remotas":
      return { demandaPico: 200, areaMedida: 280 };
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

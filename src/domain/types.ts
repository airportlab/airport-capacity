export type PeakNature = "domestico" | "internacional";

export type ComponentId = string;

export interface AreaRequirement {
  companions: boolean;
  taxaDiferente?: boolean;
}

export interface EquipmentRequirement {
  taxaDiferente?: boolean;
}

export interface ComponentRequirements {
  area?: AreaRequirement;
  equipment?: EquipmentRequirement;
}

export function hasEquipment(
  requirements: ComponentRequirements,
): boolean {
  return requirements.equipment != null;
}

export function usesAreaTaxa(requirements: ComponentRequirements): boolean {
  return requirements.area?.taxaDiferente === true;
}

export function usesEquipmentTaxa(
  requirements: ComponentRequirements,
): boolean {
  return requirements.equipment?.taxaDiferente === true;
}

export interface PmdBinding {
  rowId: string;
  nature: PeakNature;
}

export const COMPONENT_PARAM_IDS = [
  "demandaPico",
  "demandaPicoEmbarque",
  "demandaPicoDesembarque",
  "demandaPicoEmbarqueDomestico",
  "demandaPicoEmbarqueInternacional",
  "demandaPicoDesembarqueDomestico",
  "demandaPicoDesembarqueInternacional",
  "taxaDeUsoArea",
  "taxaDeUsoEquipamento",
  "areaMedida",
  "espacoMinimoPorPassageiro",
  "espacoMinimoPorPassageiroEmbarque",
  "espacoMinimoPorPassageiroDesembarque",
  "espacoMinimoPorPassageiroEmbarqueDomestico",
  "espacoMinimoPorPassageiroEmbarqueInternacional",
  "espacoMinimoPorPassageiroDesembarqueDomestico",
  "espacoMinimoPorPassageiroDesembarqueInternacional",
  "tempoDeOcupacao",
  "tempoDeOcupacaoEmbarque",
  "tempoDeOcupacaoDesembarque",
  "tempoDeOcupacaoEmbarqueDomestico",
  "tempoDeOcupacaoEmbarqueInternacional",
  "tempoDeOcupacaoDesembarqueDomestico",
  "tempoDeOcupacaoDesembarqueInternacional",
  "va",
  "vaEmbarque",
  "vaDesembarque",
  "vaEmbarqueDomestico",
  "vaEmbarqueInternacional",
  "vaDesembarqueDomestico",
  "vaDesembarqueInternacional",
  "percentualMinimoAssentos",
  "quantidadeEquipamentos",
  "tsec",
  "tempoOcupacaoEquipamento",
] as const;
export type ComponentParamId = (typeof COMPONENT_PARAM_IDS)[number];

export const SIZING_PARAM_IDS = [
  "espacoMinimoPorPassageiro",
  "espacoMinimoPorPassageiroEmbarque",
  "espacoMinimoPorPassageiroDesembarque",
  "espacoMinimoPorPassageiroEmbarqueDomestico",
  "espacoMinimoPorPassageiroEmbarqueInternacional",
  "espacoMinimoPorPassageiroDesembarqueDomestico",
  "espacoMinimoPorPassageiroDesembarqueInternacional",
  "tempoDeOcupacao",
  "tempoDeOcupacaoEmbarque",
  "tempoDeOcupacaoDesembarque",
  "tempoDeOcupacaoEmbarqueDomestico",
  "tempoDeOcupacaoEmbarqueInternacional",
  "tempoDeOcupacaoDesembarqueDomestico",
  "tempoDeOcupacaoDesembarqueInternacional",
  "va",
  "vaEmbarque",
  "vaDesembarque",
  "vaEmbarqueDomestico",
  "vaEmbarqueInternacional",
  "vaDesembarqueDomestico",
  "vaDesembarqueInternacional",
  "percentualMinimoAssentos",
] as const;
export type SizingParamId = (typeof SIZING_PARAM_IDS)[number];

export type SizingSources = Partial<Record<SizingParamId, PmdBinding>>;

export type OrganFunctionRole = "embarque" | "desembarque";

export interface RegistryFlow {
  role: OrganFunctionRole;
  pmd: PmdBinding;
}

export interface RegistryEntry {
  id: ComponentId;
  title: string;
  kind?: string;
  requirements: ComponentRequirements;
  pmd?: PmdBinding;
  flows?: RegistryFlow[];
  sizingSources?: SizingSources;
}

export function isDualFunction(entry: RegistryEntry): boolean {
  const roles = new Set(entry.flows?.map((flow) => flow.role) ?? []);
  return roles.has("embarque") && roles.has("desembarque");
}

export function isMixedNature(entry: RegistryEntry): boolean {
  const natures = new Set(entry.flows?.map((flow) => flow.pmd.nature) ?? []);
  return natures.has("domestico") && natures.has("internacional");
}

export type FieldKind = "attribute" | "sizing";

export type InputId = ComponentParamId;

export type ResultId =
  | "usoReal"
  | "areaMinimaEmbarque"
  | "areaMinimaDesembarque"
  | "areaMinimaEmbarqueDomestico"
  | "areaMinimaEmbarqueInternacional"
  | "areaMinimaDesembarqueDomestico"
  | "areaMinimaDesembarqueInternacional"
  | "areaMinima"
  | "assentosMinimos"
  | "numeroMinimoEquipamentos";

export type ComponentParams = Record<ComponentParamId, number>;
export type ResolvedInputs = ComponentParams;
export type ComponentResults = Partial<Record<ResultId, number>>;
export type ComponentJustificativas = Partial<Record<SizingParamId, string>>;

export interface ParamField<Id extends string = string> {
  id: Id;
  kind: FieldKind;
  label: string;
  unit: string;
  defaultValue: number;
  origem: string;
  origemEditavel?: boolean;
}

export interface ExcelCellMap {
  inputs: Partial<Record<InputId, string>>;
  results: Partial<Record<ResultId, string>>;
}

export interface ContractFormula {
  id: ResultId;
  label: string;
  unit: string;
  origem: string;
  expression: string;
  evaluate: (inputs: ResolvedInputs) => number;
  toExcel: (cells: ExcelCellMap["inputs"]) => string;
}

export interface ComponentContract {
  id: ComponentId;
  title: string;
  sheetName: string;
  subtitle: string;
  requirements: ComponentRequirements;
  params: ParamField<ComponentParamId>[];
  formulas: ContractFormula[];
}

export interface RequirementCheckResult {
  atende: boolean;
  demanda: number;
  capacidade: number;
  saturacao: number;
  label: string;
}

export interface Evaluation {
  inputs: ResolvedInputs;
  results: ComponentResults;
  areaCheck: RequirementCheckResult | null;
  equipmentCheck: RequirementCheckResult | null;
}

export type PdfKind = "simplificado" | "completo";

export type ExcelKind = "component" | "nature";

export type EditorTab = "summary" | "params" | "about" | ComponentId;

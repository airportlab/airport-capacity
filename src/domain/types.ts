export type PeakNature = "domestico" | "internacional";

export type ComponentId = string;

export interface AreaRequirement {
  companions: boolean;
}

export interface EquipmentRequirement {
  taxaDiferente?: boolean;
}

/** Comprimento mínimo de esteira. Só na sala de desembarque. */
export interface EsteiraRequirement {
  taxaDiferente?: boolean;
}

export interface ComponentRequirements {
  area?: AreaRequirement;
  equipment?: EquipmentRequirement;
  esteira?: EsteiraRequirement;
}

export function hasEquipment(
  requirements: ComponentRequirements,
): boolean {
  return requirements.equipment != null;
}

export function hasEsteira(
  requirements: ComponentRequirements,
): boolean {
  return requirements.esteira != null;
}

export function usesEquipmentTaxa(
  requirements: ComponentRequirements,
): boolean {
  return requirements.equipment?.taxaDiferente === true;
}

export function usesEsteiraTaxa(
  requirements: ComponentRequirements,
): boolean {
  return requirements.esteira?.taxaDiferente === true;
}

export interface PmdBinding {
  rowId: string;
  nature: PeakNature;
}

export const TSEC_PARAM_IDS = [
  "tsec",
  "tsecDomestico",
  "tsecInternacional",
  "tsecEmbarque",
  "tsecDesembarque",
  "tsecEmbarqueDomestico",
  "tsecEmbarqueInternacional",
  "tsecDesembarqueDomestico",
  "tsecDesembarqueInternacional",
] as const;

export const COMPONENT_PARAM_IDS = [
  "demandaPico",
  "demandaPicoEmbarque",
  "demandaPicoDesembarque",
  "demandaPicoEmbarqueDomestico",
  "demandaPicoEmbarqueInternacional",
  "demandaPicoDesembarqueDomestico",
  "demandaPicoDesembarqueInternacional",
  "demandaPicoDomestico",
  "demandaPicoInternacional",
  "demandaPicoConexao",
  "demandaPicoConexaoDomDom",
  "demandaPicoConexaoIntDom",
  "demandaPicoConexaoDomInt",
  "demandaPicoConexaoIntInt",
  "demandaPicoConexaoDesembarqueDomDom",
  "demandaPicoConexaoDesembarqueDomInt",
  "demandaPicoConexaoDesembarqueIntDom",
  "demandaPicoConexaoDesembarqueIntInt",
  "taxaDeUsoEquipamento",
  "taxaDeUsoEquipamentoDomestico",
  "taxaDeUsoEquipamentoInternacional",
  "taxaDeUsoEsteira",
  "areaMedida",
  "espacoMinimoPorPassageiro",
  "espacoMinimoPorPassageiroEmbarque",
  "espacoMinimoPorPassageiroDesembarque",
  "espacoMinimoPorPassageiroEmbarqueDomestico",
  "espacoMinimoPorPassageiroEmbarqueInternacional",
  "espacoMinimoPorPassageiroDesembarqueDomestico",
  "espacoMinimoPorPassageiroDesembarqueInternacional",
  "espacoMinimoPorPassageiroDomestico",
  "espacoMinimoPorPassageiroInternacional",
  "tempoDeOcupacao",
  "tempoDeOcupacaoEmbarque",
  "tempoDeOcupacaoDesembarque",
  "tempoDeOcupacaoEmbarqueDomestico",
  "tempoDeOcupacaoEmbarqueInternacional",
  "tempoDeOcupacaoDesembarqueDomestico",
  "tempoDeOcupacaoDesembarqueInternacional",
  "tempoDeOcupacaoDomestico",
  "tempoDeOcupacaoInternacional",
  "va",
  "vaEmbarque",
  "vaDesembarque",
  "vaEmbarqueDomestico",
  "vaEmbarqueInternacional",
  "vaDesembarqueDomestico",
  "vaDesembarqueInternacional",
  "vaDomestico",
  "vaInternacional",
  "percentualMinimoAssentos",
  "percentualOcupacaoMaxima",
  "espacoMinimoEmPe",
  "tempoDeOcupacaoEmPe",
  "quantidadeEquipamentos",
  "taxaRetiradaBagagem",
  "comprimentoLinearPassageiro",
  "comprimentoEsteiras",
  ...TSEC_PARAM_IDS,
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
  "espacoMinimoPorPassageiroDomestico",
  "espacoMinimoPorPassageiroInternacional",
  "tempoDeOcupacao",
  "tempoDeOcupacaoEmbarque",
  "tempoDeOcupacaoDesembarque",
  "tempoDeOcupacaoEmbarqueDomestico",
  "tempoDeOcupacaoEmbarqueInternacional",
  "tempoDeOcupacaoDesembarqueDomestico",
  "tempoDeOcupacaoDesembarqueInternacional",
  "tempoDeOcupacaoDomestico",
  "tempoDeOcupacaoInternacional",
  "va",
  "vaEmbarque",
  "vaDesembarque",
  "vaEmbarqueDomestico",
  "vaEmbarqueInternacional",
  "vaDesembarqueDomestico",
  "vaDesembarqueInternacional",
  "vaDomestico",
  "vaInternacional",
  "percentualMinimoAssentos",
  "percentualOcupacaoMaxima",
  "espacoMinimoEmPe",
  "tempoDeOcupacaoEmPe",
] as const;
export type SizingParamId = (typeof SIZING_PARAM_IDS)[number];

export const BELT_MANUAL_PARAM_IDS = [
  "taxaRetiradaBagagem",
  "comprimentoLinearPassageiro",
] as const;

export const JUSTIFICATIVA_IDS = [
  ...SIZING_PARAM_IDS,
  ...TSEC_PARAM_IDS,
  ...BELT_MANUAL_PARAM_IDS,
] as const;
export type JustificativaId = (typeof JUSTIFICATIVA_IDS)[number];

export type SizingSources = Partial<Record<SizingParamId, PmdBinding>>;

export type OrganFunctionRole = "embarque" | "desembarque" | "unico";

export interface RegistryFlow {
  role: OrganFunctionRole;
  pmd: PmdBinding;
}

/** Par de embarque via conexão. A ordem é a da conta. */
export type BoardingConnectionPair = "domDom" | "intDom" | "domInt" | "intInt";

/** Par ausente ou falso fica fora da conta. Sem o objeto, todos os pares possíveis ficam ligados. */
export type BoardingConnections = Partial<Record<BoardingConnectionPair, boolean>>;

export interface RegistryEntry {
  id: ComponentId;
  title: string;
  kind?: string;
  requirements: ComponentRequirements;
  pmd?: PmdBinding;
  flows?: RegistryFlow[];
  sizingSources?: SizingSources;
  observacoes?: string;
  /** Embarque via conexão. No componente só de desembarque, é a conexão desse lado. */
  hasConnection?: boolean;
  conexoes?: BoardingConnections;
  /** Desembarque via conexão no saguão combinado, independente do embarque. */
  hasDesembarqueConnection?: boolean;
  conexoesDesembarque?: BoardingConnections;
}

const BOARDING_CONNECTION_KINDS = new Set([
  "saguao-embarque",
  "saguao-embarque-desembarque",
  "checkin-bagagens",
  "inspecao",
  "emigracao",
  "sala-embarque-pontes",
  "sala-embarque-remotas",
  "sala-embarque-pontes-sentado",
  "sala-embarque-remotas-sentado",
  "salas-embarque",
]);

const ARRIVALS_CONNECTION_KINDS = new Set([
  "saguao-desembarque",
  "sala-desembarque",
  "imigracao",
  "aduana",
  "saguao-embarque-desembarque",
]);

export function allowsBoardingConnection(entry: RegistryEntry): boolean {
  return BOARDING_CONNECTION_KINDS.has(entry.kind ?? "");
}

export function hasBoardingConnection(entry: RegistryEntry): boolean {
  return allowsBoardingConnection(entry) && entry.hasConnection === true;
}

export function allowsArrivalsConnection(entry: RegistryEntry): boolean {
  return ARRIVALS_CONNECTION_KINDS.has(entry.kind ?? "");
}

export function hasArrivalsConnection(entry: RegistryEntry): boolean {
  if (!allowsArrivalsConnection(entry)) return false;
  if (entry.kind === "saguao-embarque-desembarque") {
    return entry.hasDesembarqueConnection === true;
  }
  return entry.hasConnection === true;
}

export function arrivalsConnectionMap(
  entry: RegistryEntry,
): BoardingConnections | undefined {
  if (entry.kind === "saguao-embarque-desembarque") {
    return entry.conexoesDesembarque;
  }
  return entry.conexoes;
}

/** Fluxos de desembarque via conexão. A primeira letra é o voo. */
export type ArrivalsConnectionPair = BoardingConnectionPair;

/** Doméstico: DOM-DOM e DOM-INT. Internacional: INT-DOM e INT-INT. Misto: os quatro. */
export function arrivalsConnectionPairsForNature(
  nature: PeakNature | "misto" | undefined,
): ArrivalsConnectionPair[] {
  if (nature === "internacional") return ["intDom", "intInt"];
  if (nature === "misto") return ["domDom", "domInt", "intDom", "intInt"];
  return ["domDom", "domInt"];
}

export function arrivalsConnectionPairsFor(
  entry: RegistryEntry,
): ArrivalsConnectionPair[] {
  if (entry.kind === "imigracao" || entry.kind === "aduana") {
    return ["intDom", "intInt"];
  }
  return arrivalsConnectionPairsForNature(natureOfEntry(entry));
}

export function arrivalsConnectionsAllOn(
  entry: RegistryEntry,
): BoardingConnections {
  return Object.fromEntries(
    arrivalsConnectionPairsFor(entry).map((pair) => [pair, true]),
  );
}

/** Fluxos ligados. Sem o mapa, os pares nascem ligados. Ausente no mapa também. */
export function enabledArrivalsConnections(
  entry: RegistryEntry,
): ArrivalsConnectionPair[] {
  if (!hasArrivalsConnection(entry)) return [];
  const possible = arrivalsConnectionPairsFor(entry);
  const stored = arrivalsConnectionMap(entry);
  if (!stored) return possible;
  return possible.filter((pair) => stored[pair] !== false);
}

/** Troca de natureza: par ausente nasce ligado; par que saiu da natureza sai do registro. */
export function reconcileArrivalsConnections(
  entry: RegistryEntry,
  nature: PeakNature | "misto",
): BoardingConnections | undefined {
  if (!hasArrivalsConnection(entry)) return undefined;
  const stored = arrivalsConnectionMap(entry);
  if (!stored) return undefined;
  const possible =
    entry.kind === "imigracao" || entry.kind === "aduana"
      ? arrivalsConnectionPairsFor(entry)
      : arrivalsConnectionPairsForNature(nature);
  const next: BoardingConnections = {};
  for (const pair of possible) next[pair] = stored[pair] !== false;
  return next;
}

/** Embarque: a segunda letra é o voo. DOM-DOM e INT-DOM são a coluna doméstica. */
export function boardingConnectionColumn(
  pair: BoardingConnectionPair,
): PeakNature {
  return pair === "domDom" || pair === "intDom" ? "domestico" : "internacional";
}

/** Desembarque: a primeira letra é o voo. DOM-DOM e DOM-INT são a coluna doméstica. */
export function arrivalsConnectionColumn(
  pair: ArrivalsConnectionPair,
): PeakNature {
  return pair === "domDom" || pair === "domInt" ? "domestico" : "internacional";
}

export function isDualFunction(entry: RegistryEntry): boolean {
  const roles = new Set(entry.flows?.map((flow) => flow.role) ?? []);
  return roles.has("embarque") && roles.has("desembarque");
}

export function isMixedNature(entry: RegistryEntry): boolean {
  const natures = new Set(entry.flows?.map((flow) => flow.pmd.nature) ?? []);
  return natures.has("domestico") && natures.has("internacional");
}

/** Natureza da instância: misto se há as duas colunas; senão a do PMD. */
export function natureOfEntry(
  entry: RegistryEntry,
): PeakNature | "misto" | undefined {
  if (isMixedNature(entry)) return "misto";
  return entry.pmd?.nature ?? entry.flows?.[0]?.pmd.nature;
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
  | "areaMinimaDomestico"
  | "areaMinimaInternacional"
  | "areaMinimaConexao"
  | "areaMinimaConexaoDomDom"
  | "areaMinimaConexaoIntDom"
  | "areaMinimaConexaoDomInt"
  | "areaMinimaConexaoIntInt"
  | "areaMinimaConexaoDesembarqueDomDom"
  | "areaMinimaConexaoDesembarqueDomInt"
  | "areaMinimaConexaoDesembarqueIntDom"
  | "areaMinimaConexaoDesembarqueIntInt"
  | "areaMinima"
  | "assentosMinimos"
  | "numeroMinimoEquipamentos"
  | "numeroMinimoEquipamentosDomestico"
  | "numeroMinimoEquipamentosInternacional"
  | "comprimentoMinimoDesembarqueDomestico"
  | "comprimentoMinimoDesembarqueInternacional"
  | "comprimentoMinimoDesembarque"
  | "comprimentoMinimoConexaoDesembarqueDomDom"
  | "comprimentoMinimoConexaoDesembarqueDomInt"
  | "comprimentoMinimoConexaoDesembarqueIntDom"
  | "comprimentoMinimoConexaoDesembarqueIntInt"
  | "comprimentoMinimoEsteira";

export const BOARDING_CONNECTION_CATALOG: readonly {
  pair: BoardingConnectionPair;
  demanda: ComponentParamId;
  area: ResultId;
  label: string;
  dhpSymbol: string;
  areaSymbol: string;
}[] = [
  {
    pair: "domDom",
    demanda: "demandaPicoConexaoDomDom",
    area: "areaMinimaConexaoDomDom",
    label: "DOM-DOM",
    dhpSymbol: "DHp_c,DomDom",
    areaSymbol: "Ad_c,DomDom",
  },
  {
    pair: "intDom",
    demanda: "demandaPicoConexaoIntDom",
    area: "areaMinimaConexaoIntDom",
    label: "INT-DOM",
    dhpSymbol: "DHp_c,IntDom",
    areaSymbol: "Ad_c,IntDom",
  },
  {
    pair: "domInt",
    demanda: "demandaPicoConexaoDomInt",
    area: "areaMinimaConexaoDomInt",
    label: "DOM-INT",
    dhpSymbol: "DHp_c,DomInt",
    areaSymbol: "Ad_c,DomInt",
  },
  {
    pair: "intInt",
    demanda: "demandaPicoConexaoIntInt",
    area: "areaMinimaConexaoIntInt",
    label: "INT-INT",
    dhpSymbol: "DHp_c,IntInt",
    areaSymbol: "Ad_c,IntInt",
  },
];

export function boardingConnectionSpec(
  pair: BoardingConnectionPair,
): (typeof BOARDING_CONNECTION_CATALOG)[number] {
  const spec = BOARDING_CONNECTION_CATALOG.find((item) => item.pair === pair);
  if (!spec) return BOARDING_CONNECTION_CATALOG[0];
  return spec;
}

/** Um DHp e uma área por par. No misto, a coluna é a do voo (primeira letra). */
export const ARRIVALS_CONNECTION_CATALOG: readonly {
  pair: ArrivalsConnectionPair;
  demanda: ComponentParamId;
  area: ResultId;
  label: string;
  dhpSymbol: string;
  areaSymbol: string;
  empSuffix: "_d,dom" | "_d,int";
  emp: ComponentParamId;
  toi: ComponentParamId;
}[] = [
  {
    pair: "domDom",
    demanda: "demandaPicoConexaoDesembarqueDomDom",
    area: "areaMinimaConexaoDesembarqueDomDom",
    label: "DOM-DOM",
    dhpSymbol: "DHp_c,DomDom",
    areaSymbol: "Ad_c,DomDom",
    empSuffix: "_d,dom",
    emp: "espacoMinimoPorPassageiroDesembarqueDomestico",
    toi: "tempoDeOcupacaoDesembarqueDomestico",
  },
  {
    pair: "domInt",
    demanda: "demandaPicoConexaoDesembarqueDomInt",
    area: "areaMinimaConexaoDesembarqueDomInt",
    label: "DOM-INT",
    dhpSymbol: "DHp_c,DomInt",
    areaSymbol: "Ad_c,DomInt",
    empSuffix: "_d,dom",
    emp: "espacoMinimoPorPassageiroDesembarqueDomestico",
    toi: "tempoDeOcupacaoDesembarqueDomestico",
  },
  {
    pair: "intDom",
    demanda: "demandaPicoConexaoDesembarqueIntDom",
    area: "areaMinimaConexaoDesembarqueIntDom",
    label: "INT-DOM",
    dhpSymbol: "DHp_c,IntDom",
    areaSymbol: "Ad_c,IntDom",
    empSuffix: "_d,int",
    emp: "espacoMinimoPorPassageiroDesembarqueInternacional",
    toi: "tempoDeOcupacaoDesembarqueInternacional",
  },
  {
    pair: "intInt",
    demanda: "demandaPicoConexaoDesembarqueIntInt",
    area: "areaMinimaConexaoDesembarqueIntInt",
    label: "INT-INT",
    dhpSymbol: "DHp_c,IntInt",
    areaSymbol: "Ad_c,IntInt",
    empSuffix: "_d,int",
    emp: "espacoMinimoPorPassageiroDesembarqueInternacional",
    toi: "tempoDeOcupacaoDesembarqueInternacional",
  },
];

export const ARRIVALS_CONNECTION_LABEL: Record<ArrivalsConnectionPair, string> =
  Object.fromEntries(
    ARRIVALS_CONNECTION_CATALOG.map((item) => [item.pair, item.label]),
  ) as Record<ArrivalsConnectionPair, string>;

export function salaBeltPartialId(pair: ArrivalsConnectionPair): ResultId {
  switch (pair) {
    case "domDom":
      return "comprimentoMinimoConexaoDesembarqueDomDom";
    case "domInt":
      return "comprimentoMinimoConexaoDesembarqueDomInt";
    case "intDom":
      return "comprimentoMinimoConexaoDesembarqueIntDom";
    case "intInt":
      return "comprimentoMinimoConexaoDesembarqueIntInt";
  }
}

export function arrivalsConnectionSpec(
  pair: ArrivalsConnectionPair,
): (typeof ARRIVALS_CONNECTION_CATALOG)[number] {
  const spec = ARRIVALS_CONNECTION_CATALOG.find((item) => item.pair === pair);
  if (!spec) return ARRIVALS_CONNECTION_CATALOG[0];
  return spec;
}

/** Doméstico: pares que embarcam em voo doméstico. Internacional: os que embarcam em voo internacional. */
export function boardingConnectionPairsForNature(
  nature: PeakNature | "misto" | undefined,
): BoardingConnectionPair[] {
  if (nature === "internacional") return ["domInt", "intInt"];
  if (nature === "misto") return ["domDom", "intDom", "domInt", "intInt"];
  return ["domDom", "intDom"];
}

export function boardingConnectionPairsFor(
  entry: RegistryEntry,
): BoardingConnectionPair[] {
  return boardingConnectionPairsForNature(natureOfEntry(entry));
}

export function boardingConnectionsAllOn(
  nature: PeakNature | "misto",
): BoardingConnections {
  return Object.fromEntries(
    boardingConnectionPairsForNature(nature).map((pair) => [pair, true]),
  );
}

/** Pares que entram na conta. Sem `conexoes`, o arquivo antigo liga todos os possíveis. */
export function enabledBoardingConnections(
  entry: RegistryEntry,
): BoardingConnectionPair[] {
  if (!hasBoardingConnection(entry)) return [];
  const possible = boardingConnectionPairsFor(entry);
  if (!entry.conexoes) return possible;
  return possible.filter((pair) => entry.conexoes?.[pair] === true);
}

/** Troca de natureza: par novo nasce ligado; par que saiu da natureza sai do registro. */
export function reconcileBoardingConnections(
  entry: RegistryEntry,
  nature: PeakNature | "misto",
): BoardingConnections | undefined {
  if (entry.hasConnection !== true || !allowsBoardingConnection(entry)) {
    return undefined;
  }
  if (!entry.conexoes) return undefined;
  const possible = boardingConnectionPairsForNature(nature);
  const previous = new Set(boardingConnectionPairsFor(entry));
  const next: BoardingConnections = {};
  for (const pair of possible) {
    if (entry.conexoes[pair] === false) next[pair] = false;
    else if (entry.conexoes[pair] === true || !previous.has(pair)) {
      next[pair] = true;
    }
  }
  return next;
}

export type ComponentParams = Record<ComponentParamId, number>;
export type ResolvedInputs = ComponentParams;
export type ComponentResults = Partial<Record<ResultId, number>>;
export type ComponentJustificativas = Partial<Record<JustificativaId, string>>;

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

export interface EquipmentTerm {
  demandIds: ComponentParamId[];
  toi: ComponentParamId;
  tsec: ComponentParamId;
  /** Taxa deste fluxo no check-in misto, quando a marcação está ligada. */
  taxa?: ComponentParamId;
}

export interface ComponentContract {
  id: ComponentId;
  title: string;
  sheetName: string;
  subtitle: string;
  requirements: ComponentRequirements;
  params: ParamField<ComponentParamId>[];
  formulas: ContractFormula[];
  /** Termos de N. Cada um usa o Toi e o tsec daquele fluxo. */
  equipmentTerms?: EquipmentTerm[];
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
  esteiraCheck: RequirementCheckResult | null;
}

export type PdfKind = "simplificado" | "completo";

export type ExcelKind = "component" | "nature" | "modelo";

export type EditorTab =
  | "summary"
  | "params"
  | "about"
  | "circulations"
  | "dhp"
  | ComponentId;

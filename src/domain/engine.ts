import { hasResult } from "./contracts/catalog";
import { equipmentProcessingLoad } from "./contracts/formulas";
import { demandSum } from "./contracts/flowParams";
import type {
  ComponentContract,
  ComponentId,
  ComponentParamId,
  ComponentParams,
  ComponentResults,
  Evaluation,
  RequirementCheckResult,
  ResolvedInputs,
} from "./types";
import { COMPONENT_PARAM_IDS, usesAreaTaxa, usesEquipmentTaxa } from "./types";

export function resolveInputs(local: ComponentParams): ResolvedInputs {
  return Object.fromEntries(
    COMPONENT_PARAM_IDS.map((id) => [id, local[id] ?? 0]),
  ) as ComponentParams;
}

function demandIds(contract: ComponentContract): ComponentParamId[] {
  return contract.params
    .filter((field) => field.id.startsWith("demandaPico"))
    .map((field) => field.id);
}

function taxaFactor(
  inputs: ResolvedInputs,
  taxaId: ComponentParamId | null,
): number {
  if (!taxaId) return 1;
  const value = inputs[taxaId];
  if (!Number.isFinite(value)) return 1;
  return value / 100;
}

function peopleDemand(
  contract: ComponentContract,
  inputs: ResolvedInputs,
  taxaId: ComponentParamId | null,
): number {
  return demandSum(inputs, demandIds(contract)) * taxaFactor(inputs, taxaId);
}

function scaledCapacity(
  demanda: number,
  oferecido: number,
  requerido: number,
): number {
  if (
    !Number.isFinite(demanda) ||
    !Number.isFinite(oferecido) ||
    !Number.isFinite(requerido) ||
    requerido <= 0
  ) {
    return Number.NaN;
  }
  return demanda * (oferecido / requerido);
}

function areaCapacity(
  contract: ComponentContract,
  inputs: ResolvedInputs,
  demanda: number,
  areaMinima: number,
): number {
  const scaled = scaledCapacity(demanda, inputs.areaMedida, areaMinima);
  if (Number.isFinite(scaled)) return scaled;
  const emp = inputs.espacoMinimoPorPassageiro;
  const toi = inputs.tempoDeOcupacao;
  if (emp <= 0 || toi <= 0) return Number.NaN;
  const companions = contract.requirements.area?.companions === true ? 1 + inputs.va : 1;
  return (inputs.areaMedida * 60) / (emp * toi * companions);
}

function saturacaoPercent(demanda: number, capacidade: number): number {
  if (
    !Number.isFinite(demanda) ||
    !Number.isFinite(capacidade) ||
    capacidade <= 0
  ) {
    return Number.NaN;
  }
  return (demanda / capacidade) * 100;
}

function equipmentCapacity(
  contract: ComponentContract,
  inputs: ResolvedInputs,
  demanda: number,
): number {
  const terms =
    contract.equipmentTerms && contract.equipmentTerms.length > 0
      ? contract.equipmentTerms
      : [
          {
            demandIds: demandIds(contract),
            toi: "tempoDeOcupacao" as const,
            tsec: "tsec" as const,
          },
        ];
  if (terms.some((term) => inputs[term.tsec] === 0)) return Number.NaN;
  const taxaId = usesEquipmentTaxa(contract.requirements)
    ? "taxaDeUsoEquipamento"
    : null;
  const load = equipmentProcessingLoad(inputs, terms, taxaId);
  return scaledCapacity(demanda, inputs.quantidadeEquipamentos, load);
}

export function evaluateComponent(
  contract: ComponentContract,
  local: ComponentParams,
): Evaluation {
  const inputs = resolveInputs(local);
  const results: ComponentResults = {};

  for (const formula of contract.formulas) {
    results[formula.id] = formula.evaluate(inputs);
  }

  return {
    inputs,
    results,
    areaCheck: hasResult(contract, "areaMinima")
      ? evaluateAreaCheck(contract, inputs, results)
      : null,
    equipmentCheck: hasResult(contract, "numeroMinimoEquipamentos")
      ? evaluateEquipmentCheck(contract, inputs, results)
      : null,
    esteiraCheck: hasResult(contract, "comprimentoMinimoEsteira")
      ? evaluateBeltCheck(contract, inputs, results)
      : null,
  };
}

export function evaluateAreaCheck(
  contract: ComponentContract,
  inputs: ResolvedInputs,
  results: ComponentResults,
): RequirementCheckResult {
  const areaMinima = results.areaMinima ?? Number.NaN;
  const demanda = peopleDemand(
    contract,
    inputs,
    usesAreaTaxa(contract.requirements) ? "taxaDeUsoArea" : null,
  );
  const capacidade = areaCapacity(contract, inputs, demanda, areaMinima);
  const atende =
    inputs.areaMedida >= areaMinima && Number.isFinite(areaMinima);

  return {
    atende,
    demanda,
    capacidade,
    saturacao: saturacaoPercent(demanda, capacidade),
    label: atende ? "Atende" : "Não atende",
  };
}

export function evaluateEquipmentCheck(
  contract: ComponentContract,
  inputs: ResolvedInputs,
  results: ComponentResults,
): RequirementCheckResult {
  const minimo = results.numeroMinimoEquipamentos ?? Number.NaN;
  const demanda = peopleDemand(
    contract,
    inputs,
    usesEquipmentTaxa(contract.requirements) ? "taxaDeUsoEquipamento" : null,
  );
  const capacidade = equipmentCapacity(contract, inputs, demanda);
  const atende =
    inputs.quantidadeEquipamentos >= minimo && Number.isFinite(minimo);

  return {
    atende,
    demanda,
    capacidade,
    saturacao: saturacaoPercent(demanda, capacidade),
    label: atende ? "Atende" : "Não atende",
  };
}

export function evaluateBeltCheck(
  contract: ComponentContract,
  inputs: ResolvedInputs,
  results: ComponentResults,
): RequirementCheckResult {
  const minimo = results.comprimentoMinimoEsteira ?? Number.NaN;
  const demanda = peopleDemand(contract, inputs, null);
  const capacidade = scaledCapacity(demanda, inputs.comprimentoEsteiras, minimo);
  const atende =
    inputs.comprimentoEsteiras >= minimo && Number.isFinite(minimo);

  return {
    atende,
    demanda,
    capacidade,
    saturacao: saturacaoPercent(demanda, capacidade),
    label: atende ? "Atende" : "Não atende",
  };
}

export function evaluateAll(
  contracts: ComponentContract[],
  locals: Record<ComponentId, ComponentParams>,
): Record<ComponentId, Evaluation> {
  return Object.fromEntries(
    contracts.map((contract) => [
      contract.id,
      evaluateComponent(
        contract,
        locals[contract.id] ??
          (Object.fromEntries(
            contract.params.map((field) => [field.id, field.defaultValue]),
          ) as ComponentParams),
      ),
    ]),
  ) as Record<ComponentId, Evaluation>;
}

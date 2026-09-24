import type {
  ComponentContract,
  ComponentId,
  ComponentJustificativas,
  ComponentParamId,
  ComponentParams,
  RegistryEntry,
  ResultId,
} from "../types";
import { COMPONENT_PARAM_IDS } from "../types";
import { arrivalsContract } from "./arrivals";
import { boardingContract } from "./boarding";
import { boardingRemoteContract } from "./boardingRemote";
import { checkinContract } from "./checkin";
import { customsContract } from "./customs";
import { emigrationContract } from "./emigration";
import { resolveContracts } from "./factory";
import { hallContract } from "./hall";
import { hallArrivalsContract } from "./hallArrivals";
import { immigrationContract } from "./immigration";
import { securityContract } from "./security";
import { defaultAirport, type AirportSource } from "../airports";
import { overlaySizingSources } from "../pmd";
import {
  PMD_LINE_ORGANS,
  exampleOperatingValues,
  instantiateOrgan,
  instantiableOrgans,
  naturesForTemplate,
  requirementsFromPreset,
} from "../templates/organs";

/** Contratos da semente antiga (sem meio-fio). Overlay de valores se o id ainda existir. */
export const SEED_CONTRACTS: ComponentContract[] = [
  hallContract,
  hallArrivalsContract,
  checkinContract,
  securityContract,
  emigrationContract,
  immigrationContract,
  customsContract,
  boardingContract,
  boardingRemoteContract,
  arrivalsContract,
];

/** Um componente operacional por tipo do PMD, natureza padrão da linha. Meio-fio fica de fora. */
export function seedRegistry(source: AirportSource = defaultAirport()): RegistryEntry[] {
  const lineIds = new Set(PMD_LINE_ORGANS.map((template) => template.kind));
  const templates = instantiableOrgans(source).filter((template) =>
    lineIds.has(template.kind),
  );
  const registry: RegistryEntry[] = [];
  for (const template of templates) {
    const nature = naturesForTemplate(template)[0];
    if (!nature) continue;
    registry.push({
      ...instantiateOrgan(
        template,
        nature,
        template.title,
        registry.map((entry) => entry.id),
      ),
      requirements: requirementsFromPreset(template.preset),
    });
  }
  return registry;
}

export function contractById(
  contracts: ComponentContract[],
  id: ComponentId,
): ComponentContract {
  const contract = contracts.find((item) => item.id === id);
  if (!contract) {
    throw new Error(`Componente desconhecido: ${id}`);
  }
  return contract;
}

export function hasResult(contract: ComponentContract, id: ResultId): boolean {
  return contract.formulas.some((formula) => formula.id === id);
}

export function defaultComponentParams(
  contract: ComponentContract,
): ComponentParams {
  const filled = Object.fromEntries(
    COMPONENT_PARAM_IDS.map((id) => [id, 0]),
  ) as ComponentParams;
  for (const field of contract.params) {
    filled[field.id] = field.defaultValue;
  }
  return filled;
}

export function defaultComponentOrigens(
  contract: ComponentContract,
): Record<ComponentParamId, string> {
  const filled = Object.fromEntries(
    COMPONENT_PARAM_IDS.map((id) => [id, ""]),
  ) as Record<ComponentParamId, string>;
  for (const field of contract.params) {
    filled[field.id] = field.origem;
  }
  return filled;
}

export function emptyJustificativas(): Record<ComponentId, ComponentJustificativas> {
  return {};
}

export function paramsFromRegistry(
  registry: RegistryEntry[],
  source: AirportSource = defaultAirport(),
): Record<ComponentId, ComponentParams> {
  const seedParams = Object.fromEntries(
    SEED_CONTRACTS.map((contract) => [
      contract.id,
      defaultComponentParams(contract),
    ]),
  ) as Record<ComponentId, ComponentParams>;

  return Object.fromEntries(
    resolveContracts(registry).map((contract) => {
      const entry = registry.find((item) => item.id === contract.id);
      const base =
        seedParams[contract.id] ?? defaultComponentParams(contract);
      return [
        contract.id,
        overlaySizingSources(
          entry ?? {
            id: contract.id,
            title: contract.title,
            requirements: contract.requirements,
          },
          base,
          defaultComponentOrigens(contract),
          source,
        ).params,
      ];
    }),
  ) as Record<ComponentId, ComponentParams>;
}

export function origensFromRegistry(
  registry: RegistryEntry[],
  source: AirportSource = defaultAirport(),
): Record<ComponentId, Record<ComponentParamId, string>> {
  const seedOrigens = Object.fromEntries(
    SEED_CONTRACTS.map((contract) => [
      contract.id,
      defaultComponentOrigens(contract),
    ]),
  ) as Record<ComponentId, Record<ComponentParamId, string>>;

  return Object.fromEntries(
    resolveContracts(registry).map((contract) => {
      const entry = registry.find((item) => item.id === contract.id);
      const base =
        seedOrigens[contract.id] ?? defaultComponentOrigens(contract);
      return [
        contract.id,
        overlaySizingSources(
          entry ?? {
            id: contract.id,
            title: contract.title,
            requirements: contract.requirements,
          },
          defaultComponentParams(contract),
          base,
          source,
        ).origens,
      ];
    }),
  ) as Record<ComponentId, Record<ComponentParamId, string>>;
}

export function emptyAirportDefaults(source: AirportSource = defaultAirport()) {
  const registry = seedRegistry(source);
  const components = paramsFromRegistry(registry, source);
  const componentOrigens = origensFromRegistry(registry, source);
  overlayExampleOperatingValues(registry, components);
  return {
    airportId: source.id,
    roundId: source.roundId,
    registry,
    components,
    componentOrigens,
    justificativas: emptyJustificativas(),
  };
}

function overlayExampleOperatingValues(
  registry: RegistryEntry[],
  components: Record<ComponentId, ComponentParams>,
) {
  for (const entry of registry) {
    const spec = exampleOperatingValues(entry.kind);
    if (!spec) continue;
    const params = components[entry.id];
    if (!params) continue;
    const contract = resolveContracts([entry])[0];
    for (const field of contract.params) {
      if (field.id.startsWith("demandaPico")) {
        params[field.id] = spec.demandaPico;
      }
      if (field.id === "areaMedida") {
        params.areaMedida = spec.areaMedida;
      }
      if (
        field.id === "quantidadeEquipamentos" &&
        spec.quantidadeEquipamentos != null
      ) {
        params.quantidadeEquipamentos = spec.quantidadeEquipamentos;
      }
      if (field.id === "tsec" && spec.tsec != null) {
        params.tsec = spec.tsec;
      }
    }
  }
}

export { resolveContracts };

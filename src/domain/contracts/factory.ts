import type {
  ComponentContract,
  ComponentId,
  ComponentParamId,
  ComponentRequirements,
  ParamField,
  RegistryEntry,
} from "../types";
import {
  hasEquipment,
  hasEsteira,
  isDualFunction,
  isMixedNature,
  natureOfEntry,
  usesAreaTaxa,
  usesEquipmentTaxa,
} from "../types";
import {
  AREA_BODY_IDS,
  AREA_BODY_WITH_COMPANIONS_IDS,
  pickFields,
} from "./fields";
import {
  areaBodyIdsFromFlows,
  connectionAreaParams,
  connectionFlows,
  entryFlowParams,
  equipmentTerms,
  identityParamIds,
  isArrivalsOnlyMixed,
} from "./flowParams";
import { capacityFormulas } from "./formulas";
import {
  areaFormulaDisplay,
  splitLoungeFormulaDisplay,
  dualAreaFormulaDisplay,
  mixedAreaFormulaDisplay,
  simpleConnectionFormulaDisplay,
  singleFunctionMixedFormulaDisplay,
} from "./notations";
import {
  empLabelFor,
  empUnitFor,
  empUnitForFlow,
  isSplitLoungeEntry,
  roundHasSeats,
  standardTsecForParam,
  TSEC_MANUAL_CITATION,
} from "../pmd";
import { organAllowsCompanions, organAllowsEquipment } from "../templates/organs";

export function emptyRequirements(): ComponentRequirements {
  return {};
}

export function requirementsFromLegacyTemplate(
  template: "area" | "areaAndEquipment",
): ComponentRequirements {
  return {
    area: { companions: false },
    ...(template === "areaAndEquipment" ? { equipment: {} } : {}),
  };
}

export function slugify(title: string, existing: ComponentId[]): ComponentId {
  const base =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "componente";
  let id = base;
  let suffix = 2;
  while (existing.includes(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

export function isDualContract(contract: ComponentContract): boolean {
  return contract.params.some(
    (field) =>
      field.id === "demandaPicoEmbarque" ||
      field.id === "demandaPicoEmbarqueDomestico",
  );
}

export function isMixedNatureContract(contract: ComponentContract): boolean {
  return contract.params.some(
    (field) =>
      field.id === "demandaPicoEmbarqueDomestico" ||
      field.id === "demandaPicoDesembarqueDomestico" ||
      field.id === "demandaPicoDomestico",
  );
}

export function isSingleFunctionMixedContract(
  contract: ComponentContract,
): boolean {
  return contract.params.some((field) => field.id === "demandaPicoDomestico");
}

export function contractHasConnection(contract: ComponentContract): boolean {
  return contract.params.some(
    (field) =>
      field.id === "demandaPicoConexao" ||
      field.id === "demandaPicoConexaoDesembarqueDomestico" ||
      field.id === "demandaPicoConexaoDesembarqueInternacional",
  );
}

/** Emp, Toi e tsec da conexão vêm do embarque: no misto e no doméstico, da coluna doméstica. */
export function connectionDemandOrigem(entry: RegistryEntry): string {
  const nature = natureOfEntry(entry);
  if (nature === "misto") {
    return "Demanda agregada das conexões. Emp, Toi e Tsec usados nesta conta são os do embarque doméstico.";
  }
  if (nature === "internacional") {
    return "Emp, Toi e Tsec usados nesta conta são os do embarque internacional.";
  }
  return "Emp, Toi e Tsec usados nesta conta são os do embarque doméstico.";
}

export function makeContract(entry: RegistryEntry): ComponentContract {
  const title = entry.title.trim() ? entry.title : "Componente";
  const stored = entry.requirements ?? emptyRequirements();
  const storedArea = stored.area;
  const companions =
    storedArea?.companions === true && organAllowsCompanions(entry);
  const area = storedArea ? { ...storedArea, companions } : undefined;
  const requirements: ComponentRequirements = {
    ...(area ? { ...stored, area } : stored),
  };
  if (!organAllowsEquipment(entry)) delete requirements.equipment;
  if (entry.kind !== "sala-desembarque") delete requirements.esteira;
  const equipment = hasEquipment(requirements);
  const belt = hasEsteira(requirements);
  const includeAreaTaxa = usesAreaTaxa(requirements);
  const includeEquipmentTaxa = usesEquipmentTaxa(requirements);
  const splitLounge = Boolean(area) && isSplitLoungeEntry(entry);
  const seats = Boolean(area) && !splitLounge && roundHasSeats(entry);
  const dualFlows = isDualFunction(entry);
  const mixedNature = isMixedNature(entry);
  const internationalHall = natureOfEntry(entry) === "internacional";
  const demandIds = identityParamIds(entry);
  const flows = entryFlowParams(entry);
  const singleFunctionMixed =
    flows.length > 0 &&
    flows.every(
      (flow) =>
        flow.area === "areaMinimaDomestico" ||
        flow.area === "areaMinimaInternacional",
    );
  const arrivalsOnly = isArrivalsOnlyMixed(flows);
  const connection = connectionAreaParams(entry);
  const connections = connectionFlows(entry);
  const terms = equipmentTerms(entry);
  const equipmentToiIds = [
    ...new Set(terms.map((term) => term.toi)),
  ];
  const tsecIds = [...new Set(terms.map((term) => term.tsec))];
  const tsecPatch: Partial<
    Record<ComponentParamId, Partial<ParamField<ComponentParamId>>>
  > = {};
  for (const id of tsecIds) {
    const standard = standardTsecForParam(entry, id);
    if (standard != null) {
      tsecPatch[id] = {
        defaultValue: standard,
        origem: TSEC_MANUAL_CITATION,
      };
    }
  }
  const empUnit = empUnitFor(entry, companions);
  const empUnitEmbarque = empUnitForFlow(entry, "embarque", companions);
  const empUnitDesembarque = empUnitForFlow(entry, "desembarque", companions);

  const areaIds: ComponentParamId[] = !area
    ? []
    : flows.length > 0
      ? [
          ...areaBodyIdsFromFlows(flows, companions),
          ...(seats && !mixedNature
            ? (["percentualMinimoAssentos"] as const)
            : []),
        ]
      : [
          ...(companions ? AREA_BODY_WITH_COMPANIONS_IDS : AREA_BODY_IDS),
          ...(seats ? (["percentualMinimoAssentos"] as const) : []),
          ...(splitLounge
            ? ([
                "percentualMinimoAssentos",
                "percentualOcupacaoMaxima",
                "espacoMinimoEmPe",
                "tempoDeOcupacaoEmPe",
              ] as const)
            : []),
        ];

  const paramIds: ComponentParamId[] = [
    ...demandIds,
    ...(area
      ? [
          ...(includeAreaTaxa ? (["taxaDeUsoArea"] as const) : []),
          ...areaIds,
        ]
      : []),
    ...(equipment
      ? [
          ...(includeEquipmentTaxa
            ? (["taxaDeUsoEquipamento"] as const)
            : []),
          "quantidadeEquipamentos" as const,
          ...tsecIds,
          ...(area ? [] : equipmentToiIds),
        ]
      : []),
    ...(belt
      ? [
          "taxaRetiradaBagagem" as const,
          "comprimentoLinearPassageiro" as const,
          "comprimentoEsteiras" as const,
          ...(area
            ? []
            : flows.length > 0
              ? [...new Set(flows.map((flow) => flow.toi))]
              : (["tempoDeOcupacao"] as const)),
        ]
      : []),
  ];

  const areaCopy = splitLounge
    ? splitLoungeFormulaDisplay(includeAreaTaxa)
    : singleFunctionMixed
    ? singleFunctionMixedFormulaDisplay(companions, includeAreaTaxa)
    : mixedNature
      ? mixedAreaFormulaDisplay(
          companions,
          flows.length,
          includeAreaTaxa,
          connections.length > 0,
          arrivalsOnly,
        )
    : dualFlows
      ? dualAreaFormulaDisplay(companions, includeAreaTaxa, Boolean(connection))
      : connection
        ? simpleConnectionFormulaDisplay(companions, includeAreaTaxa)
        : areaFormulaDisplay(companions, includeAreaTaxa);

  let subtitle = "Componente sem requisitos. Cadastre área ou outros depois.";
  if (area && equipment && seats) {
    subtitle = `Requisito de área ${areaCopy}, assentos e equipamentos.`;
  } else if (area && seats) {
    subtitle = `Requisito de área ${areaCopy} e percentual mínimo de assentos.`;
  } else if (area && splitLounge) {
    subtitle = `Requisito de área: ${areaCopy}.`;
  } else if (area && belt) {
    subtitle = `Requisito de área ${areaCopy} e tamanho mínimo de esteira.`;
  } else if (area && equipment) {
    subtitle = `Requisito de área ${areaCopy} e equipamentos.`;
  } else if (area) {
    subtitle = `Requisito de área: ${areaCopy}.`;
  } else if (belt) {
    subtitle = "Requisito de tamanho mínimo de esteira.";
  } else if (equipment) {
    subtitle =
      terms.length > 1
        ? "Requisito de equipamentos. Cada fluxo usa o seu Toi e o seu Tsec; N é o teto da soma."
        : "Requisito de equipamentos de processamento.";
  }

  return {
    id: entry.id,
    title,
    sheetName: title.slice(0, 31),
    requirements,
    subtitle,
    params: pickFields(paramIds, {
      espacoMinimoPorPassageiro: {
        unit: empUnit,
        label: splitLounge
          ? "Área necessária para passageiros sentados (Emp_s)"
          : empLabelFor(empUnit),
      },
      espacoMinimoPorPassageiroEmbarque: {
        unit: empUnitEmbarque,
        label: `${empLabelFor(empUnitEmbarque)} · embarque`,
      },
      espacoMinimoPorPassageiroDesembarque: {
        unit: empUnitDesembarque,
        label: `${empLabelFor(empUnitDesembarque)} · desembarque`,
      },
      espacoMinimoPorPassageiroEmbarqueDomestico: {
        unit: empUnitEmbarque,
      },
      espacoMinimoPorPassageiroEmbarqueInternacional: {
        unit: empUnitEmbarque,
      },
      espacoMinimoPorPassageiroDesembarqueDomestico: {
        unit: empUnitDesembarque,
      },
      espacoMinimoPorPassageiroDesembarqueInternacional: {
        unit: empUnitDesembarque,
      },
      espacoMinimoPorPassageiroDomestico: {
        unit: empUnit,
      },
      espacoMinimoPorPassageiroInternacional: {
        unit: empUnit,
      },
      ...(splitLounge
        ? {
            tempoDeOcupacao: {
              label: "Tempo médio de ocupação para passageiros sentados (Toi_s)",
            },
            percentualMinimoAssentos: {
              label: "Acesso a assentos na sala de embarque (Pa)",
            },
          }
        : {}),
      ...(dualFlows && !mixedNature
        ? {
            demandaPicoEmbarque: {
              label: internationalHall
                ? "DHp (Origem Internacional)"
                : "DHp (Origem Doméstico)",
              origem: internationalHall
                ? "Atributo do fluxo de origem internacional."
                : "Atributo do fluxo de origem doméstico.",
            },
            demandaPicoDesembarque: {
              label: internationalHall
                ? "DHp (Destino Internacional)"
                : "DHp (Destino Doméstico)",
              origem: internationalHall
                ? "Atributo do fluxo de destino internacional."
                : "Atributo do fluxo de destino doméstico.",
            },
          }
        : {}),
      ...(dualFlows && seats
        ? {
            percentualMinimoAssentos: {
              label: "Percentual mínimo de assentos · embarque",
            },
          }
        : {}),
      ...(connection
        ? {
            demandaPicoConexao: {
              label: mixedNature
                ? "DHp conexões (agregado)"
                : "DHp embarque via conexão",
              origem: connectionDemandOrigem(entry),
            },
          }
        : {}),
      ...tsecPatch,
    }),
    formulas: capacityFormulas({
      includeArea: Boolean(area),
      includeEquipment: equipment,
      includeSeats: seats && !mixedNature,
      includeSplitLounge: splitLounge,
      includeAreaTaxa,
      includeEquipmentTaxa,
      includeBelt: belt,
      companions,
      flows: flows.length > 1 ? flows : [],
      demandIds,
      connection,
      connections,
      equipmentTerms: terms,
    }),
    equipmentTerms: equipment ? terms : undefined,
  };
}

export function resolveContracts(
  registry: RegistryEntry[],
): ComponentContract[] {
  return registry.map(makeContract);
}

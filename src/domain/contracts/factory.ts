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
  entryFlowParams,
  equipmentTerms,
  identityParamIds,
} from "./flowParams";
import { capacityFormulas } from "./formulas";
import {
  areaFormulaDisplay,
  dualAreaFormulaDisplay,
  mixedAreaFormulaDisplay,
  simpleConnectionFormulaDisplay,
  singleFunctionMixedFormulaDisplay,
} from "./notations";
import {
  empLabelFor,
  empUnitFor,
  empUnitForFlow,
  roundHasSeats,
  standardTsecForParam,
  TSEC_MANUAL_CITATION,
} from "../pmd";
import { organAllowsCompanions } from "../templates/organs";

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
      field.id === "demandaPicoDomestico",
  );
}

export function isSingleFunctionMixedContract(
  contract: ComponentContract,
): boolean {
  return contract.params.some((field) => field.id === "demandaPicoDomestico");
}

export function contractHasConnection(contract: ComponentContract): boolean {
  return contract.params.some((field) => field.id === "demandaPicoConexao");
}

export function makeContract(entry: RegistryEntry): ComponentContract {
  const title = entry.title.trim() ? entry.title : "Componente";
  const stored = entry.requirements ?? emptyRequirements();
  const storedArea = stored.area;
  const companions =
    storedArea?.companions === true && organAllowsCompanions(entry);
  const area = storedArea ? { ...storedArea, companions } : undefined;
  const requirements: ComponentRequirements = area
    ? { ...stored, area }
    : stored;
  const equipment = hasEquipment(requirements);
  const includeAreaTaxa = usesAreaTaxa(requirements);
  const includeEquipmentTaxa = usesEquipmentTaxa(requirements);
  const seats = Boolean(area) && roundHasSeats(entry);
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
  const connection = connectionAreaParams(entry);
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
  ];

  const areaCopy = singleFunctionMixed
    ? singleFunctionMixedFormulaDisplay(companions, includeAreaTaxa)
    : mixedNature
      ? mixedAreaFormulaDisplay(
          companions,
          flows.length,
          includeAreaTaxa,
          Boolean(connection),
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
  } else if (area && equipment) {
    subtitle = `Requisito de área ${areaCopy} e equipamentos.`;
  } else if (area) {
    subtitle = `Requisito de área: ${areaCopy}.`;
  } else if (equipment) {
    subtitle =
      terms.length > 1
        ? "Requisito de equipamentos. Cada fluxo usa o seu Toi e o seu tsec; N é o teto da soma."
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
        label: empLabelFor(empUnit),
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
            },
          }
        : {}),
      ...tsecPatch,
    }),
    formulas: capacityFormulas({
      includeArea: Boolean(area),
      includeEquipment: equipment,
      includeSeats: seats && !mixedNature,
      includeAreaTaxa,
      includeEquipmentTaxa,
      companions,
      flows: flows.length > 1 ? flows : [],
      demandIds,
      connection,
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

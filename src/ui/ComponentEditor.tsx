import { isSizingParam, isTsecParam } from "../domain/contracts/fields";
import {
  beltManualStandard,
  isBeltManualParam,
} from "../domain/contracts/formulas";
import {
  isDualContract,
  isMixedNatureContract,
  isSingleFunctionMixedContract,
} from "../domain/contracts/factory";
import { identityParamIds } from "../domain/contracts/flowParams";
import {
  peakNatureLabel,
  pmdById,
  pmdValueFor,
  resolvedSources,
  standardTsecForParam,
  TSEC_MANUAL_CITATION,
} from "../domain/pmd";
import {
  natureOfEntry,
  naturesForTemplate,
  organAllowsCompanions,
  organAllowsEquipment,
  organNatureLabel,
  suggestedCompanions,
  templateForEntry,
  type OrganNature,
} from "../domain/templates/organs";
import type {
  ComponentContract,
  ComponentJustificativas,
  ComponentParamId,
  Evaluation,
  JustificativaId,
  PmdBinding,
  RegistryEntry,
  SizingParamId,
} from "../domain/types";
import {
  allowsArrivalsConnection,
  allowsBoardingConnection,
  hasArrivalsConnection,
  hasBoardingConnection,
  hasEquipment,
  hasEsteira,
  isDualFunction,
  isMixedNature,
  usesAreaTaxa,
  usesEquipmentTaxa,
} from "../domain/types";
import { formatEditable, formatNumber, parseLocaleNumber, sameNumber } from "./format";
import {
  BeltFormulaCard,
  DualAreaFormulaCard,
  EquipmentFormulaCard,
  FormulaCard,
  MixedNatureAreaFormulaCard,
} from "./FormulaCard";
import { NumberField } from "./NumberField";
import { AreaResults, EquipmentResults, EsteiraResults } from "./ResultPanel";

const MIXED_GROUPS = [
  ["Embarque doméstico", "EmbarqueDomestico"],
  ["Embarque internacional", "EmbarqueInternacional"],
  ["Desembarque doméstico", "DesembarqueDomestico"],
  ["Desembarque internacional", "DesembarqueInternacional"],
] as const;

function FieldList({
  fields,
  drafts,
  origens,
  onValueChange,
  onOrigemChange,
}: {
  fields: ComponentContract["params"];
  drafts: Record<ComponentParamId, string>;
  origens: Record<ComponentParamId, string>;
  onValueChange: (id: ComponentParamId, raw: string) => void;
  onOrigemChange: (id: ComponentParamId, raw: string) => void;
}) {
  return (
    <div className="fields">
      {fields.map((field) => (
        <NumberField
          key={field.id}
          field={field}
          draft={drafts[field.id]}
          origem={
            field.id.startsWith("demandaPicoConexao")
              ? field.origem
              : (origens[field.id] ?? field.origem)
          }
          onValueChange={(raw) => onValueChange(field.id, raw)}
          onOrigemChange={
            field.origemEditavel
              ? (raw) => onOrigemChange(field.id, raw)
              : undefined
          }
        />
      ))}
    </div>
  );
}

function SizingParamControl({
  field,
  draft,
  source,
  justification,
  onValueChange,
  onJustificationChange,
  onRestore,
}: {
  field: ComponentContract["params"][number];
  draft: string;
  source: PmdBinding | undefined;
  justification: string;
  onValueChange: (raw: string) => void;
  onJustificationChange: (raw: string) => void;
  onRestore: () => void;
}) {
  const sizingId = field.id as SizingParamId;
  const parsed = parseLocaleNumber(draft);
  const pmdValue = source ? pmdValueFor(source, sizingId) : null;
  const fromPmd = source != null && pmdValue != null;
  const altered =
    fromPmd && parsed !== null && !sameNumber(parsed, pmdValue);
  const needsJustification = altered;
  const rowTitle = source ? pmdById(source.rowId)?.title : undefined;
  const origem = fromPmd
    ? `PMD: ${rowTitle ?? source?.rowId} · ${peakNatureLabel(source!.nature)}`
    : "Sem valor neste PMD.";

  return (
    <div className={needsJustification ? "sizing-field altered" : "sizing-field"}>
      <NumberField
        field={field}
        draft={draft}
        origem={origem}
        onValueChange={onValueChange}
      />
      {needsJustification ? (
        <>
          <label className="field">
            <span className="field-label">Justificativa</span>
            <textarea
              className="origem-edit"
              rows={2}
              value={justification}
              onChange={(event) => onJustificationChange(event.target.value)}
            />
          </label>
          {justification.trim() === "" ? (
            <p className="justificativa-warn">
              Informe por que o valor difere de {formatNumber(pmdValue ?? Number.NaN)}{" "}
              {field.unit}.
            </p>
          ) : null}
          <button type="button" className="ghost" onClick={onRestore}>
            Voltar ao valor do PMD
          </button>
        </>
      ) : null}
    </div>
  );
}

function TsecParamControl({
  field,
  draft,
  standard,
  origem,
  justification,
  onValueChange,
  onJustificationChange,
  onRestore,
}: {
  field: ComponentContract["params"][number];
  draft: string;
  standard: number | null;
  origem: string;
  justification: string;
  onValueChange: (raw: string) => void;
  onJustificationChange: (raw: string) => void;
  onRestore: () => void;
}) {
  const parsed = parseLocaleNumber(draft);
  const altered =
    standard != null && parsed !== null && !sameNumber(parsed, standard);
  return (
    <div className={altered ? "sizing-field altered" : "sizing-field"}>
      <NumberField
        field={field}
        draft={draft}
        origem={standard != null ? TSEC_MANUAL_CITATION : origem}
        onValueChange={onValueChange}
      />
      {altered ? (
        <>
          <label className="field">
            <span className="field-label">Justificativa</span>
            <textarea
              className="origem-edit"
              rows={2}
              value={justification}
              onChange={(event) => onJustificationChange(event.target.value)}
            />
          </label>
          {justification.trim() === "" ? (
            <p className="justificativa-warn">
              Informe por que o valor difere de {formatNumber(standard ?? Number.NaN)} s.
            </p>
          ) : null}
          <button type="button" className="ghost" onClick={onRestore}>
            Voltar ao valor do Manual de Anteprojeto
          </button>
        </>
      ) : null}
    </div>
  );
}

function BeltManualControl({
  field,
  draft,
  justification,
  onValueChange,
  onJustificationChange,
  onRestore,
}: {
  field: ComponentContract["params"][number];
  draft: string;
  justification: string;
  onValueChange: (raw: string) => void;
  onJustificationChange: (raw: string) => void;
  onRestore: () => void;
}) {
  if (!isBeltManualParam(field.id)) return null;
  const standard = beltManualStandard(field.id);
  const parsed = parseLocaleNumber(draft);
  const altered = parsed !== null && !sameNumber(parsed, standard);
  return (
    <div className={altered ? "sizing-field altered" : "sizing-field"}>
      <NumberField
        field={field}
        draft={draft}
        origem={field.origem}
        onValueChange={onValueChange}
        onBlur={() => {
          if (parsed !== null && parsed < standard) {
            onValueChange(formatEditable(standard));
          }
        }}
      />
      {altered ? (
        <>
          <label className="field">
            <span className="field-label">Justificativa</span>
            <textarea
              className="origem-edit"
              rows={2}
              value={justification}
              onChange={(event) => onJustificationChange(event.target.value)}
            />
          </label>
          {justification.trim() === "" ? (
            <p className="justificativa-warn">
              Informe por que o valor difere de {formatNumber(standard)} {field.unit}.
            </p>
          ) : null}
          <button type="button" className="ghost" onClick={onRestore}>
            Voltar ao valor do Manual de Anteprojeto
          </button>
        </>
      ) : null}
    </div>
  );
}

interface ComponentEditorProps {
  contract: ComponentContract;
  entry: RegistryEntry;
  drafts: Record<ComponentParamId, string>;
  origens: Record<ComponentParamId, string>;
  justificativas: ComponentJustificativas;
  evaluation: Evaluation;
  canRemove: boolean;
  onTitleChange: (title: string) => void;
  onObservacoesChange: (raw: string) => void;
  onRemove: () => void;
  onAddArea: (companions: boolean) => void;
  onSetCompanions: (companions: boolean) => void;
  onSetAreaTaxa: (taxaDiferente: boolean) => void;
  onRemoveArea: () => void;
  onAddEquipment: () => void;
  onSetEquipmentTaxa: (taxaDiferente: boolean) => void;
  onRemoveEquipment: () => void;
  onAddEsteira: () => void;
  onRemoveEsteira: () => void;
  onSetConnection: (hasConnection: boolean) => void;
  onNatureChange: (nature: OrganNature) => void;
  onValueChange: (id: ComponentParamId, raw: string) => void;
  onOrigemChange: (id: ComponentParamId, raw: string) => void;
  onJustificationChange: (id: JustificativaId, raw: string) => void;
  onRestoreContract: (id: JustificativaId) => void;
}

export function ComponentEditor({
  contract,
  entry,
  drafts,
  origens,
  justificativas,
  evaluation,
  canRemove,
  onTitleChange,
  onObservacoesChange,
  onRemove,
  onAddArea,
  onSetCompanions,
  onSetAreaTaxa,
  onRemoveArea,
  onAddEquipment,
  onSetEquipmentTaxa,
  onRemoveEquipment,
  onAddEsteira,
  onRemoveEsteira,
  onSetConnection,
  onNatureChange,
  onValueChange,
  onOrigemChange,
  onJustificationChange,
  onRestoreContract,
}: ComponentEditorProps) {
  const area = contract.requirements.area;
  const arrivalsHall = entry.kind === "sala-desembarque";
  const allowsEquipment = organAllowsEquipment(entry);
  const equipment = allowsEquipment && hasEquipment(contract.requirements);
  const esteira = hasEsteira(contract.requirements);
  const areaTaxa = usesAreaTaxa(contract.requirements);
  const equipmentTaxa = usesEquipmentTaxa(contract.requirements);
  const identityIds = identityParamIds(entry);
  const identityIdSet = new Set(identityIds);
  const identityFields = contract.params.filter((field) =>
    identityIdSet.has(field.id),
  );
  const connectionFields = identityFields.filter((field) =>
    field.id.startsWith("demandaPicoConexao"),
  );
  const boardingIdentityFields = identityFields.filter(
    (field) => !field.id.startsWith("demandaPicoConexao"),
  );
  const areaTaxaFields = contract.params.filter(
    (field) => field.id === "taxaDeUsoArea",
  );
  const equipmentTaxaFields = contract.params.filter(
    (field) => field.id === "taxaDeUsoEquipamento",
  );
  const areaMeasureFields = contract.params.filter(
    (field) => field.id === "areaMedida",
  );
  const equipmentFields = contract.params.filter(
    (field) =>
      field.id === "quantidadeEquipamentos" || isTsecParam(field.id),
  );
  const beltFields = contract.params.filter(
    (field) =>
      field.id === "taxaRetiradaBagagem" ||
      field.id === "comprimentoLinearPassageiro" ||
      field.id === "comprimentoEsteiras",
  );
  const sizingFields = contract.params.filter((field) => isSizingParam(field.id));
  const mixed = isMixedNature(entry) || isMixedNatureContract(contract);
  const singleFunctionMixed = isSingleFunctionMixedContract(contract);
  const mixedGroups = singleFunctionMixed
    ? ([
        ["Doméstico", "Domestico"],
        ["Internacional", "Internacional"],
      ] as const)
    : MIXED_GROUPS;
  const dual = isDualFunction(entry) || isDualContract(contract);
  const sources = resolvedSources(entry);
  const template = templateForEntry(entry);
  const availableNatures = template ? naturesForTemplate(template) : [];
  const currentNature = natureOfEntry(entry);
  const natureEditable = availableNatures.length > 1;
  const flowMeta =
    entry.flows && entry.flows.length > 0
      ? entry.flows
      : entry.pmd
        ? [{ role: "unico" as const, pmd: entry.pmd }]
        : [];
  const typeMeta = natureEditable
    ? flowMeta.filter(
        (flow, index) =>
          flowMeta.findIndex(
            (item) =>
              item.role === flow.role && item.pmd.rowId === flow.pmd.rowId,
          ) === index,
      )
    : flowMeta;
  const empty = !area && !equipment && !esteira;

  function renderSizing(fields: ComponentContract["params"]) {
    return fields.map((field) => {
      const sizingId = field.id as SizingParamId;
      return (
        <SizingParamControl
          key={field.id}
          field={field}
          draft={drafts[field.id] ?? formatEditable(0)}
          source={sources[sizingId]}
          justification={justificativas[sizingId] ?? ""}
          onValueChange={(raw) => onValueChange(field.id, raw)}
          onJustificationChange={(raw) => onJustificationChange(sizingId, raw)}
          onRestore={() => onRestoreContract(sizingId)}
        />
      );
    });
  }

  return (
    <div className="layout">
      <section className="panel balloon" aria-labelledby={`${contract.id}-entradas`}>
        <h2 id={`${contract.id}-entradas`}>Entradas do componente</h2>
        {typeMeta.length > 0 ? (
          <p className="round-meta">
            {typeMeta.map((flow, index) => {
              const row = pmdById(flow.pmd.rowId);
              const role =
                flow.role === "embarque"
                  ? "Embarque"
                  : flow.role === "desembarque"
                    ? "Desembarque"
                    : "Tipo PMD";
              return (
                <span key={`${flow.role}-${flow.pmd.rowId}`}>
                  {index > 0 ? " · " : null}
                  {dual || mixed ? `${role}: ` : "Tipo PMD: "}
                  <strong>{row?.title ?? flow.pmd.rowId}</strong>
                  {natureEditable ? null : (
                    <>
                      {" "}
                      · hora-pico {peakNatureLabel(flow.pmd.nature)}
                    </>
                  )}
                </span>
              );
            })}
          </p>
        ) : null}
        {natureEditable ? (
          <fieldset className="field nature-fieldset">
            <legend className="field-label">Natureza</legend>
            <div className="nature-options">
              {availableNatures.map((item) => (
                <label key={item} className="choice">
                  <input
                    type="radio"
                    name={`natureza-${entry.id}`}
                    checked={currentNature === item}
                    onChange={() => onNatureChange(item)}
                    />
                  <span>{organNatureLabel(item)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <label className="field">
          <span className="field-label">Nome do componente</span>
          <input
            type="text"
            autoComplete="off"
            value={contract.title}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Observações</span>
          <textarea
            className="origem-edit"
            rows={3}
            value={entry.observacoes ?? ""}
            onChange={(event) => onObservacoesChange(event.target.value)}
          />
        </label>
        {boardingIdentityFields.length > 0 ? (
          mixed ? (
            mixedGroups.map(([label, needle]) => {
              const fields = boardingIdentityFields.filter((field) =>
                field.id.includes(needle),
              );
              if (fields.length === 0) return null;
              return (
                <div key={needle}>
                  <h3 className="field-label">{label}</h3>
                  <FieldList
                    fields={fields}
                    drafts={drafts}
                    origens={origens}
                    onValueChange={onValueChange}
                    onOrigemChange={onOrigemChange}
                  />
                </div>
              );
            })
          ) : dual ? (
            <>
              <h3 className="field-label">Fluxo de embarque</h3>
              <FieldList
                fields={boardingIdentityFields.filter((field) =>
                  field.id.includes("Embarque"),
                )}
                drafts={drafts}
                origens={origens}
                onValueChange={onValueChange}
                onOrigemChange={onOrigemChange}
              />
              <h3 className="field-label">Fluxo de desembarque</h3>
              <FieldList
                fields={boardingIdentityFields.filter((field) =>
                  field.id.includes("Desembarque"),
                )}
                drafts={drafts}
                origens={origens}
                onValueChange={onValueChange}
                onOrigemChange={onOrigemChange}
              />
            </>
          ) : (
            <FieldList
              fields={boardingIdentityFields}
              drafts={drafts}
              origens={origens}
              onValueChange={onValueChange}
              onOrigemChange={onOrigemChange}
            />
          )
        ) : null}
        {allowsBoardingConnection(entry) ? (
          <label className="choice">
            <input
              type="checkbox"
              checked={hasBoardingConnection(entry)}
              onChange={(event) => onSetConnection(event.target.checked)}
            />
            Há embarque via conexão
          </label>
        ) : null}
        {allowsArrivalsConnection(entry) ? (
          <label className="choice">
            <input
              type="checkbox"
              checked={hasArrivalsConnection(entry)}
              onChange={(event) => onSetConnection(event.target.checked)}
            />
            Há desembarque via conexão
          </label>
        ) : null}
        {connectionFields.length > 0 ? (
          <>
            <h3 className="field-label">
              {allowsArrivalsConnection(entry)
                ? "Desembarque via conexão"
                : "Embarque via conexão"}
            </h3>
            <FieldList
              fields={connectionFields}
              drafts={drafts}
              origens={origens}
              onValueChange={onValueChange}
              onOrigemChange={onOrigemChange}
            />
          </>
        ) : null}
        <div className="actions">
          <button
            type="button"
            className="ghost"
            disabled={!canRemove}
            onClick={onRemove}
          >
            Remover componente
          </button>
        </div>
        {empty ? (
          <p className="panel-lead">
            {arrivalsHall
              ? "Área e tamanho mínimo de esteira são opcionais. Adicione o que este componente operacional precisa."
              : allowsEquipment
                ? "Área e equipamentos são opcionais. Adicione o que este componente operacional precisa."
                : "Área é opcional. Adicione o que este componente operacional precisa."}
          </p>
        ) : null}
        {!area || (arrivalsHall ? !esteira : allowsEquipment && !equipment) ? (
          <div className="requirement-add">
            {!area ? (
              <button
                type="button"
                className="accent"
                onClick={() => onAddArea(suggestedCompanions(template))}
              >
                Adicionar requisito de área
              </button>
            ) : null}
            {arrivalsHall && !esteira ? (
              <button type="button" className="accent" onClick={onAddEsteira}>
                Adicionar requisito de tamanho mínimo de esteira
              </button>
            ) : null}
            {allowsEquipment && !equipment ? (
              <button
                type="button"
                className="accent"
                onClick={onAddEquipment}
              >
                Adicionar requisito de equipamentos
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {area ? (
        <section
          className="panel balloon"
          aria-labelledby={`${contract.id}-area`}
        >
          <h2 id={`${contract.id}-area`}>Área</h2>
          {mixed ? (
            <MixedNatureAreaFormulaCard
              companions={area.companions}
              includeTaxa={areaTaxa}
              flowCount={entry.flows?.length ?? 0}
              singleFunction={singleFunctionMixed}
              arrivalsOnly={
                (entry.flows?.length ?? 0) > 0 &&
                (entry.flows?.every((flow) => flow.role === "desembarque") ??
                  false)
              }
              hasConnection={
                hasBoardingConnection(entry) || hasArrivalsConnection(entry)
              }
              afterEquation={
                <AreaResults contract={contract} evaluation={evaluation} />
              }
            />
          ) : dual ? (
            <DualAreaFormulaCard
              companions={area.companions}
              includeTaxa={areaTaxa}
              hasConnection={hasBoardingConnection(entry)}
              afterEquation={
                <AreaResults contract={contract} evaluation={evaluation} />
              }
            />
          ) : (
            <FormulaCard
              companions={area.companions}
              includeTaxa={areaTaxa}
              hasConnection={hasBoardingConnection(entry)}
              afterEquation={
                <AreaResults contract={contract} evaluation={evaluation} />
              }
            />
          )}
          {organAllowsCompanions(entry) ? (
            <label className="choice">
              <input
                type="checkbox"
                checked={area.companions}
                onChange={(event) => onSetCompanions(event.target.checked)}
              />
              Com acompanhante
            </label>
          ) : null}
          <label className="choice">
            <input
              type="checkbox"
              checked={areaTaxa}
              onChange={(event) => onSetAreaTaxa(event.target.checked)}
            />
            Taxa de utilização diferente de 100%
          </label>
          {areaTaxa && areaTaxaFields.length > 0 ? (
            <FieldList
              fields={areaTaxaFields}
              drafts={drafts}
              origens={origens}
              onValueChange={onValueChange}
              onOrigemChange={onOrigemChange}
            />
          ) : null}
          {areaMeasureFields.length > 0 ? (
            <FieldList
              fields={areaMeasureFields}
              drafts={drafts}
              origens={origens}
              onValueChange={onValueChange}
              onOrigemChange={onOrigemChange}
            />
          ) : null}
          {mixed ? (
            mixedGroups.map(([label, needle]) => {
              const fields = sizingFields.filter((field) =>
                field.id.includes(needle),
              );
              if (fields.length === 0) return null;
              return (
                <div key={needle}>
                  <h3 className="field-label">{label}</h3>
                  {renderSizing(fields)}
                </div>
              );
            })
          ) : dual ? (
            <>
              <h3 className="field-label">Fluxo de embarque</h3>
              {renderSizing(
                sizingFields.filter(
                  (field) =>
                    field.id.includes("Embarque") ||
                    field.id === "percentualMinimoAssentos",
                ),
              )}
              <h3 className="field-label">Fluxo de desembarque</h3>
              {renderSizing(
                sizingFields.filter((field) => field.id.includes("Desembarque")),
              )}
            </>
          ) : (
            renderSizing(sizingFields)
          )}
          <div className="actions">
            <button type="button" className="ghost" onClick={onRemoveArea}>
              Remover área
            </button>
          </div>
        </section>
      ) : null}

      {equipment ? (
        <section
          className="panel balloon"
          aria-labelledby={`${contract.id}-equip`}
        >
          <h2 id={`${contract.id}-equip`}>Equipamentos</h2>
          <EquipmentFormulaCard
            terms={contract.equipmentTerms}
            includeTaxa={equipmentTaxa}
            afterEquation={
              <EquipmentResults contract={contract} evaluation={evaluation} />
            }
          />
          <label className="choice">
            <input
              type="checkbox"
              checked={equipmentTaxa}
              onChange={(event) => onSetEquipmentTaxa(event.target.checked)}
            />
            Taxa de utilização diferente de 100%
          </label>
          {equipmentTaxa && equipmentTaxaFields.length > 0 ? (
            <FieldList
              fields={equipmentTaxaFields}
              drafts={drafts}
              origens={origens}
              onValueChange={onValueChange}
              onOrigemChange={onOrigemChange}
            />
          ) : null}
          {!area && sizingFields.length > 0 ? (
            mixed ? (
              mixedGroups.map(([label, needle]) => {
                const fields = sizingFields.filter((field) =>
                  field.id.includes(needle),
                );
                if (fields.length === 0) return null;
                return (
                  <div key={needle}>
                    <h3 className="field-label">{label}</h3>
                    {renderSizing(fields)}
                  </div>
                );
              })
            ) : dual ? (
              <>
                <h3 className="field-label">Fluxo de embarque</h3>
                {renderSizing(
                  sizingFields.filter((field) => field.id.includes("Embarque")),
                )}
                <h3 className="field-label">Fluxo de desembarque</h3>
                {renderSizing(
                  sizingFields.filter((field) =>
                    field.id.includes("Desembarque"),
                  ),
                )}
              </>
            ) : (
              renderSizing(sizingFields)
            )
          ) : null}
          <div className="fields">
            {equipmentFields.map((field) => {
              if (isTsecParam(field.id)) {
                const id = field.id;
                return (
                  <TsecParamControl
                    key={id}
                    field={field}
                    draft={drafts[id] ?? formatEditable(0)}
                    standard={standardTsecForParam(entry, id)}
                    origem={origens[id] ?? field.origem}
                    justification={justificativas[id] ?? ""}
                    onValueChange={(raw) => onValueChange(id, raw)}
                    onJustificationChange={(raw) =>
                      onJustificationChange(id, raw)
                    }
                    onRestore={() => onRestoreContract(id)}
                  />
                );
              }
              return (
                <NumberField
                  key={field.id}
                  field={field}
                  draft={drafts[field.id]}
                  origem={origens[field.id] ?? field.origem}
                  onValueChange={(raw) => onValueChange(field.id, raw)}
                  onOrigemChange={
                    field.origemEditavel
                      ? (raw) => onOrigemChange(field.id, raw)
                      : undefined
                  }
                />
              );
            })}
          </div>
          <div className="actions">
            <button
              type="button"
              className="ghost"
              onClick={onRemoveEquipment}
            >
              Remover equipamentos
            </button>
          </div>
        </section>
      ) : null}

      {esteira ? (
        <section
          className="panel balloon"
          aria-labelledby={`${contract.id}-esteira`}
        >
          <h2 id={`${contract.id}-esteira`}>Tamanho mínimo de esteira</h2>
          <BeltFormulaCard
            mixed={mixed}
            afterEquation={
              <EsteiraResults contract={contract} evaluation={evaluation} />
            }
          />
          <div className="fields">
            {beltFields
              .filter((field) => isBeltManualParam(field.id))
              .map((field) => {
                const id = field.id;
                if (!isBeltManualParam(id)) return null;
                return (
                  <BeltManualControl
                    key={id}
                    field={field}
                    draft={drafts[id] ?? formatEditable(beltManualStandard(id))}
                    justification={justificativas[id] ?? ""}
                    onValueChange={(raw) => onValueChange(id, raw)}
                    onJustificationChange={(raw) =>
                      onJustificationChange(id, raw)
                    }
                    onRestore={() => onRestoreContract(id)}
                  />
                );
              })}
          </div>
          {!area && sizingFields.length > 0 ? (
            mixed ? (
              mixedGroups.map(([label, needle]) => {
                const fields = sizingFields.filter((field) =>
                  field.id.includes(needle),
                );
                if (fields.length === 0) return null;
                return (
                  <div key={needle}>
                    <h3 className="field-label">{label}</h3>
                    {renderSizing(fields)}
                  </div>
                );
              })
            ) : (
              renderSizing(sizingFields)
            )
          ) : null}
          <div className="fields">
            {beltFields
              .filter((field) => field.id === "comprimentoEsteiras")
              .map((field) => (
                <NumberField
                  key={field.id}
                  field={field}
                  draft={drafts[field.id]}
                  origem={origens[field.id] ?? field.origem}
                  onValueChange={(raw) => onValueChange(field.id, raw)}
                />
              ))}
          </div>
          <div className="actions">
            <button type="button" className="ghost" onClick={onRemoveEsteira}>
              Remover esteira
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

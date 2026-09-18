import { isSizingParam } from "../domain/contracts/fields";
import { isDualContract, isMixedNatureContract } from "../domain/contracts/factory";
import { identityParamIds } from "../domain/contracts/flowParams";
import {
  peakNatureLabel,
  pmdById,
  pmdValueFor,
  resolvedSources,
} from "../domain/pmd";
import { suggestedCompanions, templateForEntry } from "../domain/templates/organs";
import type {
  ComponentContract,
  ComponentJustificativas,
  ComponentParamId,
  Evaluation,
  PmdBinding,
  RegistryEntry,
  SizingParamId,
} from "../domain/types";
import {
  hasEquipment,
  isDualFunction,
  isMixedNature,
  usesAreaTaxa,
  usesEquipmentTaxa,
} from "../domain/types";
import { formatEditable, formatNumber, parseLocaleNumber, sameNumber } from "./format";
import {
  DualAreaFormulaCard,
  EquipmentFormulaCard,
  FormulaCard,
  MixedNatureAreaFormulaCard,
} from "./FormulaCard";
import { NumberField } from "./NumberField";
import { AreaResults, EquipmentResults } from "./ResultPanel";

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
          origem={origens[field.id] ?? field.origem}
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

interface ComponentEditorProps {
  contract: ComponentContract;
  entry: RegistryEntry;
  drafts: Record<ComponentParamId, string>;
  origens: Record<ComponentParamId, string>;
  justificativas: ComponentJustificativas;
  evaluation: Evaluation;
  canRemove: boolean;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
  onAddArea: (companions: boolean) => void;
  onSetCompanions: (companions: boolean) => void;
  onSetAreaTaxa: (taxaDiferente: boolean) => void;
  onRemoveArea: () => void;
  onAddEquipment: () => void;
  onSetEquipmentTaxa: (taxaDiferente: boolean) => void;
  onRemoveEquipment: () => void;
  onValueChange: (id: ComponentParamId, raw: string) => void;
  onOrigemChange: (id: ComponentParamId, raw: string) => void;
  onJustificationChange: (id: SizingParamId, raw: string) => void;
  onRestoreContract: (id: SizingParamId) => void;
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
  onRemove,
  onAddArea,
  onSetCompanions,
  onSetAreaTaxa,
  onRemoveArea,
  onAddEquipment,
  onSetEquipmentTaxa,
  onRemoveEquipment,
  onValueChange,
  onOrigemChange,
  onJustificationChange,
  onRestoreContract,
}: ComponentEditorProps) {
  const area = contract.requirements.area;
  const equipment = hasEquipment(contract.requirements);
  const areaTaxa = usesAreaTaxa(contract.requirements);
  const equipmentTaxa = usesEquipmentTaxa(contract.requirements);
  const identityIds = new Set(identityParamIds(entry));
  const identityFields = contract.params.filter((field) =>
    identityIds.has(field.id),
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
      field.id === "quantidadeEquipamentos" ||
      field.id === "tsec" ||
      field.id === "tempoOcupacaoEquipamento",
  );
  const sizingFields = contract.params.filter((field) => isSizingParam(field.id));
  const mixed = isMixedNature(entry) || isMixedNatureContract(contract);
  const dual = isDualFunction(entry) || isDualContract(contract);
  const sources = resolvedSources(entry);
  const template = templateForEntry(entry);
  const flowMeta =
    entry.flows && entry.flows.length > 0
      ? entry.flows
      : entry.pmd
        ? [{ role: "unico" as const, pmd: entry.pmd }]
        : [];
  const empty = !area && !equipment;

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
        <p className="panel-lead">{contract.subtitle}</p>
        {flowMeta.length > 0 ? (
          <p className="round-meta">
            {flowMeta.map((flow, index) => {
              const row = pmdById(flow.pmd.rowId);
              const role =
                flow.role === "embarque"
                  ? "Embarque"
                  : flow.role === "desembarque"
                    ? "Desembarque"
                    : "Tipo PMD";
              return (
                <span key={`${flow.role}-${flow.pmd.rowId}-${flow.pmd.nature}`}>
                  {index > 0 ? " · " : null}
                  {dual || mixed ? `${role}: ` : "Tipo PMD: "}
                  <strong>{row?.title ?? flow.pmd.rowId}</strong> · hora-pico{" "}
                  {peakNatureLabel(flow.pmd.nature)}
                </span>
              );
            })}
          </p>
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
        {identityFields.length > 0 ? (
          mixed ? (
            MIXED_GROUPS.map(([label, needle]) => {
              const fields = identityFields.filter((field) =>
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
                fields={identityFields.filter((field) =>
                  field.id.includes("Embarque"),
                )}
                drafts={drafts}
                origens={origens}
                onValueChange={onValueChange}
                onOrigemChange={onOrigemChange}
              />
              <h3 className="field-label">Fluxo de desembarque</h3>
              <FieldList
                fields={identityFields.filter((field) =>
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
              fields={identityFields}
              drafts={drafts}
              origens={origens}
              onValueChange={onValueChange}
              onOrigemChange={onOrigemChange}
            />
          )
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
            Área e equipamentos são opcionais. Adicione o que este componente
            operacional precisa.
          </p>
        ) : null}
        {!area || !equipment ? (
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
            {!equipment ? (
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
              flowCount={identityIds.size}
              afterEquation={
                <AreaResults contract={contract} evaluation={evaluation} />
              }
            />
          ) : dual ? (
            <DualAreaFormulaCard
              companions={area.companions}
              includeTaxa={areaTaxa}
              afterEquation={
                <AreaResults contract={contract} evaluation={evaluation} />
              }
            />
          ) : (
            <FormulaCard
              companions={area.companions}
              includeTaxa={areaTaxa}
              afterEquation={
                <AreaResults contract={contract} evaluation={evaluation} />
              }
            />
          )}
          <label className="choice">
            <input
              type="checkbox"
              checked={area.companions}
              onChange={(event) => onSetCompanions(event.target.checked)}
            />
            Com acompanhante
          </label>
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
            MIXED_GROUPS.map(([label, needle]) => {
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
            demandCount={identityIds.size}
            mixedNature={mixed}
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
          <FieldList
            fields={equipmentFields}
            drafts={drafts}
            origens={origens}
            onValueChange={onValueChange}
            onOrigemChange={onOrigemChange}
          />
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
    </div>
  );
}

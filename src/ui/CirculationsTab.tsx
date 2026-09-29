import { Fragment, useState } from "react";
import {
  EFFECT_MINIMUM_M,
  PMM_STANDARD,
  WIDTH_FLOOR_M,
  circulationWidths,
  createCirculation,
  effectNeedsJustification,
  pmmNeedsJustification,
  type CirculationKind,
  type HorizontalCirculation,
} from "../domain/circulation";
import { slugify } from "../domain/contracts/factory";
import type { ParamField, RegistryEntry } from "../domain/types";
import { CirculationFormulas } from "./FormulaCard";
import { formatEditable, formatNumber, parseLocaleNumber } from "./format";
import { NumberField } from "./NumberField";

interface CirculationsTabProps {
  items: HorizontalCirculation[];
  registry: RegistryEntry[];
  onChange: (items: HorizontalCirculation[]) => void;
}

function componentTitle(registry: RegistryEntry[], id: string): string {
  if (!id) return "—";
  return registry.find((entry) => entry.id === id)?.title ?? "—";
}

function stretchLabel(item: HorizontalCirculation, registry: RegistryEntry[]): string {
  if (item.kind === "interna") return componentTitle(registry, item.componentId);
  const from = componentTitle(registry, item.fromId);
  const to = componentTitle(registry, item.toId);
  if (from === "—" && to === "—") return "—";
  return `${from} → ${to}`;
}

export function CirculationsTab({
  items,
  registry,
  onChange,
}: CirculationsTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = items.find((item) => item.id === editingId) ?? null;

  function add() {
    const id = slugify(
      "circ-circulacao",
      items.map((item) => item.id),
    );
    onChange([...items, createCirculation(id, "Circulação")]);
    setEditingId(id);
  }

  function update(next: HorizontalCirculation) {
    onChange(items.map((item) => (item.id === next.id ? next : item)));
  }

  function remove(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    if (!window.confirm("Remover esta circulação?")) return;
    onChange(items.filter((entry) => entry.id !== id));
    setEditingId(null);
  }

  return (
    <>
      <section className="panel">
        <h2>Circulações horizontais</h2>
        <p className="panel-lead">
          Cada circulação tem o próprio DHp. O componente só identifica o
          trecho: um, se for interna, ou dois, se for a transição de um para o
          outro.
        </p>
        <CirculationFormulas />
        <div className="actions">
          <button type="button" onClick={add}>
            Nova circulação
          </button>
        </div>
        {items.length === 0 ? (
          <p className="panel-lead">Nenhuma circulação cadastrada.</p>
        ) : (
          <div className="summary-table-wrap">
            <table className="summary-table circulation-table">
              <thead>
                <tr>
                  <th>Trecho</th>
                  <th>Tipo</th>
                  <th>Largura Total</th>
                  <th>Largura efetiva</th>
                  <th>CHp (pax/h)</th>
                  <th>DHp (pax/h)</th>
                  <th>Borda</th>
                  <th>Contrafluxo</th>
                  <th>Atendimento</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const widths = circulationWidths(item);
                  const note = item.observacoes.trim();
                  const status =
                    widths.atende === null
                      ? "—"
                      : widths.atende
                        ? "Atende"
                        : "Não atende";
                  return (
                    <Fragment key={item.id}>
                      <tr className={note ? "circ-has-note" : undefined}>
                        <td>{stretchLabel(item, registry)}</td>
                        <td>{item.kind === "interna" ? "Interna" : "Transição"}</td>
                        <td>{formatNumber(widths.lt)} m</td>
                        <td>{formatNumber(widths.le)} m</td>
                        <td>
                          {widths.chp == null ? "—" : formatNumber(widths.chp)}
                        </td>
                        <td>{formatNumber(item.dhp)}</td>
                        <td>{effectLabel(item.efeitoBorda, item.eb)}</td>
                        <td>{effectLabel(item.efeitoContrafluxo, item.ec)}</td>
                        <td
                          className={
                            widths.atende === null
                              ? undefined
                              : widths.atende
                                ? "ok"
                                : "fail"
                          }
                        >
                          {status}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => setEditingId(item.id)}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                      {note ? (
                        <tr className="circ-note-row">
                          <td colSpan={10}>{note}</td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setEditingId(null)}
        >
          <div
            className="panel modal modal-cadastrar modal-circulacao"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`circ-${editing.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            <CirculationCard
              item={editing}
              registry={registry}
              onChange={update}
              onRemove={() => remove(editing.id)}
              onClose={() => setEditingId(null)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function effectLabel(marked: boolean, meters: number): string {
  return marked ? `${formatNumber(meters)} m` : "—";
}

function field(id: string, label: string, unit: string): ParamField {
  return {
    id,
    kind: "attribute",
    label,
    unit,
    defaultValue: 0,
    origem: "",
  };
}

function CirculationCard({
  item,
  registry,
  onChange,
  onRemove,
  onClose,
}: {
  item: HorizontalCirculation;
  registry: RegistryEntry[];
  onChange: (item: HorizontalCirculation) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [dhp, setDhp] = useState(formatEditable(item.dhp));
  const [pmm, setPmm] = useState(formatEditable(item.pmm));
  const [eb, setEb] = useState(formatEditable(item.eb));
  const [ec, setEc] = useState(formatEditable(item.ec));
  const [largura, setLargura] = useState(
    item.larguraMedida == null ? "" : formatEditable(item.larguraMedida),
  );
  const widths = circulationWidths(item);
  const pmmAltered = pmmNeedsJustification(item.pmm);
  const ebAltered = item.efeitoBorda && effectNeedsJustification(item.eb);
  const ecAltered =
    item.efeitoContrafluxo && effectNeedsJustification(item.ec);

  function setKind(kind: CirculationKind) {
    onChange({
      ...item,
      kind,
      componentId: kind === "interna" ? item.componentId : "",
      fromId: kind === "transicao" ? item.fromId : "",
      toId: kind === "transicao" ? item.toId : "",
    });
  }

  function commitDhp(raw: string) {
    setDhp(raw);
    const parsed = parseLocaleNumber(raw);
    if (parsed === null || parsed < 0) return;
    onChange({ ...item, dhp: parsed });
  }

  function blurDhp() {
    const parsed = parseLocaleNumber(dhp);
    if (parsed === null || parsed < 0) {
      setDhp(formatEditable(item.dhp));
      return;
    }
    setDhp(formatEditable(parsed));
  }

  function commitPmm(raw: string) {
    setPmm(raw);
    const parsed = parseLocaleNumber(raw);
    if (parsed === null || parsed <= 0) return;
    onChange({
      ...item,
      pmm: parsed,
      pmmJustificativa: pmmNeedsJustification(parsed) ? item.pmmJustificativa : "",
    });
  }

  function blurPmm() {
    const parsed = parseLocaleNumber(pmm);
    if (parsed === null || parsed <= 0) {
      setPmm(formatEditable(PMM_STANDARD));
      onChange({ ...item, pmm: PMM_STANDARD, pmmJustificativa: "" });
      return;
    }
    setPmm(formatEditable(parsed));
  }

  function commitEffect(
    raw: string,
    setDraft: (value: string) => void,
    key: "eb" | "ec",
    justKey: "ebJustificativa" | "ecJustificativa",
  ) {
    setDraft(raw);
    const parsed = parseLocaleNumber(raw);
    if (parsed === null) return;
    onChange({
      ...item,
      [key]: parsed,
      [justKey]: effectNeedsJustification(parsed) ? item[justKey] : "",
    });
  }

  function blurEffect(
    draft: string,
    setDraft: (value: string) => void,
    key: "eb" | "ec",
    justKey: "ebJustificativa" | "ecJustificativa",
  ) {
    const parsed = parseLocaleNumber(draft);
    if (parsed === null) {
      setDraft(formatEditable(EFFECT_MINIMUM_M));
      onChange({ ...item, [key]: EFFECT_MINIMUM_M, [justKey]: "" });
      return;
    }
    setDraft(formatEditable(parsed));
  }

  function commitLargura(raw: string) {
    setLargura(raw);
    if (raw.trim() === "") {
      onChange({ ...item, larguraMedida: null });
      return;
    }
    const parsed = parseLocaleNumber(raw);
    if (parsed === null || parsed < 0) return;
    onChange({ ...item, larguraMedida: parsed });
  }

  function blurLargura() {
    if (largura.trim() === "") {
      setLargura("");
      onChange({ ...item, larguraMedida: null });
      return;
    }
    const parsed = parseLocaleNumber(largura);
    if (parsed === null || parsed < 0) {
      setLargura(
        item.larguraMedida == null ? "" : formatEditable(item.larguraMedida),
      );
      return;
    }
    setLargura(formatEditable(parsed));
  }

  return (
    <>
      <h2 id={`circ-${item.id}`}>Circulação</h2>
      <div className="circ-assoc">
        <label className="field">
          <span className="field-label">Tipo</span>
          <select
            value={item.kind}
            onChange={(event) => setKind(event.target.value as CirculationKind)}
          >
            <option value="interna">Interna</option>
            <option value="transicao">Transição</option>
          </select>
        </label>
      </div>
      {item.kind === "interna" ? (
        <div className="circ-assoc">
          <ComponentSelect
            label="Componente"
            value={item.componentId}
            registry={registry}
            onChange={(componentId) => onChange({ ...item, componentId })}
          />
        </div>
      ) : (
        <div className="circ-pair">
          <ComponentSelect
            label="De"
            value={item.fromId}
            registry={registry}
            onChange={(fromId) => onChange({ ...item, fromId })}
          />
          <ComponentSelect
            label="Para"
            value={item.toId}
            registry={registry}
            onChange={(toId) => onChange({ ...item, toId })}
          />
        </div>
      )}
      <NumberField
        field={field("largura", "Largura medida", "m")}
        draft={largura}
        origem="Vazio deixa o atendimento em aberto."
        onValueChange={commitLargura}
        onBlur={blurLargura}
      />
      <NumberField
        field={field("dhp", "DHp", "pax/h")}
        draft={dhp}
        origem="Demanda da hora-pico desta circulação."
        onValueChange={commitDhp}
        onBlur={blurDhp}
      />
      <div className={pmmAltered ? "sizing-field altered" : "sizing-field"}>
        <NumberField
          field={field("pmm", "PMM", "pax/(m·min)")}
          draft={pmm}
          origem="Manual de Anteprojeto. Padrão 20."
          onValueChange={commitPmm}
          onBlur={blurPmm}
        />
        {pmmAltered ? (
          <Justification
            value={item.pmmJustificativa}
            warn={`Informe por que o PMM difere de ${formatNumber(PMM_STANDARD)}.`}
            onChange={(pmmJustificativa) => onChange({ ...item, pmmJustificativa })}
            onRestore={() => {
              setPmm(formatEditable(PMM_STANDARD));
              onChange({ ...item, pmm: PMM_STANDARD, pmmJustificativa: "" });
            }}
          />
        ) : null}
      </div>
      <EffectRow
        label="Efeito borda"
        checked={item.efeitoBorda}
        onChecked={(efeitoBorda) => onChange({ ...item, efeitoBorda })}
        draft={eb}
        altered={ebAltered}
        origem="Nos dois lados. Manual de Anteprojeto. Padrão 0,5 m por lado."
        justification={item.ebJustificativa}
        warn={`Informe por que o efeito de borda difere de ${formatNumber(EFFECT_MINIMUM_M)} m do Manual de Anteprojeto.`}
        onValueChange={(raw) => commitEffect(raw, setEb, "eb", "ebJustificativa")}
        onBlur={() => blurEffect(eb, setEb, "eb", "ebJustificativa")}
        onJustification={(ebJustificativa) => onChange({ ...item, ebJustificativa })}
        onRestore={() => {
          setEb(formatEditable(EFFECT_MINIMUM_M));
          onChange({ ...item, eb: EFFECT_MINIMUM_M, ebJustificativa: "" });
        }}
      />
      <EffectRow
        label="Efeito contrafluxo"
        checked={item.efeitoContrafluxo}
        onChecked={(efeitoContrafluxo) => onChange({ ...item, efeitoContrafluxo })}
        draft={ec}
        altered={ecAltered}
        origem="Manual de Anteprojeto. Padrão 0,5 m."
        justification={item.ecJustificativa}
        warn={`Informe por que o efeito de contrafluxo difere de ${formatNumber(EFFECT_MINIMUM_M)} m do Manual de Anteprojeto.`}
        onValueChange={(raw) => commitEffect(raw, setEc, "ec", "ecJustificativa")}
        onBlur={() => blurEffect(ec, setEc, "ec", "ecJustificativa")}
        onJustification={(ecJustificativa) => onChange({ ...item, ecJustificativa })}
        onRestore={() => {
          setEc(formatEditable(EFFECT_MINIMUM_M));
          onChange({ ...item, ec: EFFECT_MINIMUM_M, ecJustificativa: "" });
        }}
      />
      <label className="field circ-notes">
        <span className="field-label">Observações</span>
        <textarea
          className="origem-edit"
          rows={3}
          value={item.observacoes}
          onChange={(event) =>
            onChange({ ...item, observacoes: event.target.value })
          }
        />
      </label>
      <div className="circ-summary">
        <div>
          <span className="circ-summary-label">Lt</span>
          <strong>{formatNumber(widths.lt)} m</strong>
        </div>
        <div>
          <span className="circ-summary-label">Le</span>
          <strong>{formatNumber(widths.le)} m</strong>
        </div>
        <div>
          <span className="circ-summary-label">CHp</span>
          <strong>
            {widths.chp == null ? "—" : `${formatNumber(widths.chp)} pax/h`}
          </strong>
        </div>
        <div>
          <span className="circ-summary-label">DHp</span>
          <strong>{formatNumber(item.dhp)} pax/h</strong>
        </div>
        <div
          className={
            widths.atende === null ? undefined : widths.atende ? "ok" : "fail"
          }
        >
          <span className="circ-summary-label">Atende</span>
          <strong>
            {widths.atende === null
              ? "—"
              : widths.atende
                ? "Atende"
                : "Não atende"}
          </strong>
        </div>
      </div>
      {widths.raised ? (
        <p className="origem">
          A conta deu menos de {formatNumber(WIDTH_FLOOR_M)} m. A largura
          adotada é {formatNumber(WIDTH_FLOOR_M)} m.
        </p>
      ) : null}
      <div className="actions modal-actions">
        <button type="button" className="ghost" onClick={onRemove}>
          Remover circulação
        </button>
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </div>
    </>
  );
}

function EffectRow({
  label,
  checked,
  onChecked,
  draft,
  altered,
  origem,
  justification,
  warn,
  onValueChange,
  onBlur,
  onJustification,
  onRestore,
}: {
  label: string;
  checked: boolean;
  onChecked: (value: boolean) => void;
  draft: string;
  altered: boolean;
  origem: string;
  justification: string;
  warn: string;
  onValueChange: (raw: string) => void;
  onBlur: () => void;
  onJustification: (value: string) => void;
  onRestore: () => void;
}) {
  return (
    <div className={altered ? "sizing-field altered" : "sizing-field"}>
      <div className="field field-inline">
        <span className="field-copy">
          <label className="effect-mark">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => onChecked(event.target.checked)}
            />
            {label}
          </label>
          {checked ? <span className="origem">{origem}</span> : null}
        </span>
        {checked ? (
          <span className="field-value">
            <span className="unit">[m]</span>
            <input
              inputMode="decimal"
              value={draft}
              onChange={(event) => onValueChange(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.currentTarget.select()}
              onMouseUp={(event) => event.preventDefault()}
              onBlur={onBlur}
            />
          </span>
        ) : (
          <span />
        )}
      </div>
      {altered ? (
        <Justification
          value={justification}
          warn={warn}
          onChange={onJustification}
          onRestore={onRestore}
        />
      ) : null}
    </div>
  );
}

function ComponentSelect({
  label,
  value,
  registry,
  onChange,
}: {
  label: string;
  value: string;
  registry: RegistryEntry[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecione</option>
        {registry.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function Justification({
  value,
  warn,
  onChange,
  onRestore,
}: {
  value: string;
  warn: string;
  onChange: (value: string) => void;
  onRestore: () => void;
}) {
  return (
    <>
      <label className="field">
        <span className="field-label">Justificativa</span>
        <textarea
          className="origem-edit"
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {value.trim() === "" ? <p className="justificativa-warn">{warn}</p> : null}
      <button type="button" className="ghost" onClick={onRestore}>
        Voltar ao valor do manual
      </button>
    </>
  );
}

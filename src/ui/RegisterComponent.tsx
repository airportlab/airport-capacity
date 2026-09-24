import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AirportSource } from "../domain/airports";
import { pmdById, pmdSideLines } from "../domain/pmd";
import type { ComponentContract } from "../domain/types";
import {
  defaultTitleFor,
  instantiableOrgans,
  naturesForTemplate,
  organNatureLabel,
  templateByKind,
  type OrganKind,
  type OrganNature,
} from "../domain/templates/organs";
import { formatNumber } from "./format";
import { TexText } from "./FormulaCard";

interface RegisterComponentProps {
  open: boolean;
  airport: AirportSource;
  contracts: ComponentContract[];
  onClose: () => void;
  onCreate: (kind: OrganKind, nature: OrganNature, title: string) => void;
  onClone: (sourceId: string, title: string) => void;
}

export function RegisterComponent({
  open,
  airport,
  contracts,
  onClose,
  onCreate,
  onClone,
}: RegisterComponentProps) {
  const catalog = instantiableOrgans(airport);
  const firstKind = catalog[0]?.kind ?? "saguao-embarque";
  const [mode, setMode] = useState<"create" | "clone">("create");
  const [kind, setKind] = useState<OrganKind>(firstKind);
  const [nature, setNature] = useState<OrganNature>("domestico");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [sourceId, setSourceId] = useState(contracts[0]?.id ?? "");

  const template = templateByKind(kind) ?? catalog[0];
  const natures = template ? naturesForTemplate(template) : [];
  const resolvedNature = natures.includes(nature)
    ? nature
    : (natures[0] ?? "domestico");
  const suggestedTitle = template
    ? defaultTitleFor(template, resolvedNature)
    : "";
  const absorbed = useMemo(() => {
    if (!template) return [];
    const natures: Array<"domestico" | "internacional"> =
      resolvedNature === "misto"
        ? ["domestico", "internacional"]
        : [resolvedNature];
    return template.flows.flatMap((flow) => {
      const row = pmdById(flow.rowId, airport.pmdTableId);
      if (!row) return [];
      const role =
        flow.role === "embarque"
          ? "Embarque"
          : flow.role === "desembarque"
            ? "Desembarque"
            : "";
      return natures.flatMap((item) =>
        pmdSideLines(row, item).map((line) => ({
          ...line,
          key: `${flow.role}-${item}-${line.key}`,
          label: [role, item === "internacional" ? "int." : natures.length > 1 ? "dom." : "", line.label]
            .filter(Boolean)
            .join(" · "),
        })),
      );
    });
  }, [template, resolvedNature, airport.pmdTableId]);

  useEffect(() => {
    if (!open) return;
    setMode("create");
    setKind(firstKind);
    const start = catalog[0];
    const startNature = start ? naturesForTemplate(start)[0] : "domestico";
    setNature(startNature ?? "domestico");
    setTitle(start ? defaultTitleFor(start, startNature ?? "domestico") : "");
    setTitleTouched(false);
    setSourceId((current) =>
      contracts.some((contract) => contract.id === current)
        ? current
        : (contracts[0]?.id ?? ""),
    );
  }, [open, contracts, firstKind, airport.id]);

  useEffect(() => {
    if (nature === resolvedNature) return;
    setNature(resolvedNature);
  }, [nature, resolvedNature]);

  useEffect(() => {
    if (mode !== "create" || titleTouched || !template) return;
    setTitle(suggestedTitle);
  }, [mode, template, suggestedTitle, titleTouched]);

  if (!open) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = title.trim();
    if (!name) return;
    if (mode === "create") {
      if (!template) return;
      onCreate(template.kind, resolvedNature, name);
    } else if (sourceId) {
      onClone(sourceId, name);
    }
    setTitle("");
    setTitleTouched(false);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="panel modal modal-cadastrar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cadastrar-titulo"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id="cadastrar-titulo">Cadastrar componente</h2>
        <p className="panel-lead">
          O tipo do PMD é o componente operacional. Saguão de embarque,
          saguão de desembarque, sala de desembarque, saguão combinado e
          check-in admitem natureza mista. Emp, Toi, v.a. e assentos
          ficam ligados a essa fonte. Área é opcional e entra depois, no
          editor. Equipamentos, só nos processadores (check-in, inspeção,
          emigração, imigração e aduana).
        </p>
        <div className="mode-toggle" role="tablist">
          <button
            type="button"
            className={mode === "create" ? "tab active" : "tab"}
            onClick={() => setMode("create")}
          >
            Novo
          </button>
          <button
            type="button"
            className={mode === "clone" ? "tab active" : "tab"}
            onClick={() => setMode("clone")}
            disabled={contracts.length === 0}
          >
            Duplicar existente
          </button>
        </div>

        {mode === "create" && template ? (
          <>
            <label className="field">
              <span className="field-label">Tipo de componente operacional</span>
              <select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as OrganKind);
                  setTitleTouched(false);
                }}
              >
                {catalog.map((item) => (
                  <option key={item.kind} value={item.kind}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="field nature-fieldset">
              <legend className="field-label">Natureza</legend>
              <div className="nature-options">
                {natures.map((item) => (
                  <label key={item} className="choice">
                    <input
                      type="radio"
                      name="natureza"
                      checked={resolvedNature === item}
                      onChange={() => {
                        setNature(item);
                        setTitleTouched(false);
                      }}
                    />
                    <span>{organNatureLabel(item)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {absorbed.length > 0 ? (
              <div className="pmd-absorb">
                <p className="field-label">Parâmetros absorvidos</p>
                <dl className="pmd-values">
                  {absorbed.map((line) => (
                    <div key={line.key} className="pmd-value">
                      <dt>
                        <TexText text={line.label} />
                      </dt>
                      <dd>
                        {formatNumber(line.value)}{" "}
                        <span className="unit">{line.unit}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            <p className="origem">{template.detail}</p>
          </>
        ) : null}

        <label className="field">
          <span className="field-label">Nome</span>
          <input
            type="text"
            autoComplete="off"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleTouched(true);
            }}
            placeholder={suggestedTitle || "Nome do componente operacional"}
            required
          />
        </label>

        {mode === "clone" ? (
          <label className="field">
            <span className="field-label">Componente de origem</span>
            <select
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
            >
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="actions modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="accent">
            Cadastrar
          </button>
        </div>
      </form>
    </div>
  );
}

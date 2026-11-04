import { useState, type Dispatch, type SetStateAction } from "react";
import {
  domesticBridgeShare,
  internationalBridgeShare,
  type AirsideDomestic,
  type AirsideInternational,
  type AirsideState,
} from "../domain/airside";
import { formatEditable, formatFixed, parseLocaleNumber } from "./format";

interface AirsideTabProps {
  airside: AirsideState;
  onChange: Dispatch<SetStateAction<AirsideState>>;
}

function formatPercent(ratio: number): string {
  return `${formatFixed(ratio * 100, 2)}%`;
}

function draftOf(value: number | null): string {
  return value === null ? "" : formatEditable(value);
}

function Fraction({
  label,
  numerator,
  denominator,
}: {
  label: string;
  numerator: string;
  denominator: string;
}) {
  return (
    <div className="tex" role="img" aria-label={label}>
      <span className="tex-lhs">
        <span className="tex-sym">
          R<sub>{label.startsWith("R_AD") ? "AD%" : "AI%"}</sub>
        </span>
      </span>
      <span className="tex-eq">=</span>
      <span className="tex-frac">
        <span className="tex-num">
          <span className="tex-sym">{numerator}</span>
        </span>
        <span className="tex-den">
          <span className="tex-sym">{denominator}</span>
        </span>
      </span>
    </div>
  );
}

function CountField({
  symbol,
  definition,
  unit,
  draft,
  onDraft,
}: {
  symbol: string;
  definition: string;
  unit?: string;
  draft: string;
  onDraft: (raw: string) => void;
}) {
  return (
    <label className="field field-inline">
      <span className="field-copy">
        {symbol ? (
          <>
            <span className="field-label">
              <span className="tex-sym">{symbol}</span>
            </span>
            <span className="origem">{definition}</span>
          </>
        ) : (
          <span className="field-label airside-minimum">{definition}</span>
        )}
      </span>
      <span className="field-value">
        {unit ? <span className="unit">[{unit}]</span> : null}
        <input
          className="input-count"
          inputMode="decimal"
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
          onMouseUp={(event) => event.preventDefault()}
        />
      </span>
    </label>
  );
}

function ShareFields({
  title,
  included,
  onIncluded,
  formulaLabel,
  numerator,
  denominator,
  counts,
  resultSymbol,
  result,
}: {
  title: string;
  included: boolean;
  onIncluded: (value: boolean) => void;
  formulaLabel: string;
  numerator: string;
  denominator: string;
  counts: {
    symbol: string;
    definition: string;
    unit?: string;
    draft: string;
    onDraft: (raw: string) => void;
  }[];
  resultSymbol: string;
  result: number | null;
}) {
  return (
    <div className="airside-share">
      <h3 className="manual-single-title airside-title">
        <label>
          <input
            type="checkbox"
            checked={included}
            onChange={(event) => onIncluded(event.target.checked)}
          />
          {title}
        </label>
      </h3>
      {included ? (
        <>
          <div className="formula-card">
            <Fraction
              label={formulaLabel}
              numerator={numerator}
              denominator={denominator}
            />
            <span className="airside-sep" aria-hidden="true">
              ;
            </span>
            <span className="airside-result">
              <span className="tex-sym">
                R<sub>{resultSymbol}</sub>
              </span>
              <span className="tex-eq">=</span>
              <strong>{result === null ? "—" : formatPercent(result)}</strong>
            </span>
          </div>
          <div className="fields">
            {counts.map((count) => (
              <CountField key={count.symbol || count.definition} {...count} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function AirsideTab({ airside, onChange }: AirsideTabProps) {
  const [drafts, setDrafts] = useState(() => ({
    pd: draftOf(airside.domestic.pd),
    td: draftOf(airside.domestic.td),
    ted: draftOf(airside.domestic.ted),
    minimoDom: draftOf(airside.domestic.minimo),
    pi: draftOf(airside.international.pi),
    ti: draftOf(airside.international.ti),
    tei: draftOf(airside.international.tei),
    minimoInt: draftOf(airside.international.minimo),
  }));

  function setDomestic(patch: Partial<AirsideDomestic>) {
    onChange((current) => ({
      ...current,
      domestic: { ...current.domestic, ...patch },
    }));
  }

  function setInternational(patch: Partial<AirsideInternational>) {
    onChange((current) => ({
      ...current,
      international: { ...current.international, ...patch },
    }));
  }

  function editDomestic(
    key: "pd" | "td" | "ted" | "minimo",
    raw: string,
  ) {
    const draftKey = key === "minimo" ? "minimoDom" : key;
    setDrafts((current) => ({ ...current, [draftKey]: raw }));
    const parsed = raw.trim() === "" ? null : parseLocaleNumber(raw);
    if (raw.trim() !== "" && parsed === null) return;
    setDomestic({ [key]: parsed });
  }

  function editInternational(
    key: "pi" | "ti" | "tei" | "minimo",
    raw: string,
  ) {
    const draftKey = key === "minimo" ? "minimoInt" : key;
    setDrafts((current) => ({ ...current, [draftKey]: raw }));
    const parsed = raw.trim() === "" ? null : parseLocaleNumber(raw);
    if (raw.trim() !== "" && parsed === null) return;
    setInternational({ [key]: parsed });
  }

  return (
    <section className="panel">
      <h2 id="lado-ar-heading">Lado ar</h2>
      <p className="panel-lead">
        Requisitos do lado ar que podem ou não estar no contrato. O interruptor
        fica no título de cada percentual. Ligado, a conta aparece e entra no
        relatório. Desligado, fica só o título. O aeroporto não muda esta conta.
      </p>
      <ShareFields
        title="Percentual de passageiros domésticos processados em ponte de embarque"
        included={airside.domestic.includeInReport}
        onIncluded={(includeInReport) => setDomestic({ includeInReport })}
        formulaLabel="R_AD% = PD / (TD − TED)"
        numerator="PD"
        denominator="TD − TED"
        resultSymbol="AD%"
        result={domesticBridgeShare(airside.domestic)}
        counts={[
          {
            symbol: "TD",
            definition:
              "Número total de passageiros domésticos processados em terminais de passageiros durante determinado período.",
            draft: drafts.td,
            onDraft: (raw) => editDomestic("td", raw),
          },
          {
            symbol: "TED",
            definition:
              "Número total de passageiros domésticos processados em terminais de passageiros durante determinado período que tenham sido transportados em aeronaves cujas características físicas impediam a operação em pontes de embarque comercialmente disponíveis no mercado.",
            draft: drafts.ted,
            onDraft: (raw) => editDomestic("ted", raw),
          },
          {
            symbol: "PD",
            definition:
              "Número de passageiros domésticos processados em pontes de embarque no período.",
            draft: drafts.pd,
            onDraft: (raw) => editDomestic("pd", raw),
          },
          {
            symbol: "",
            definition:
              "Percentual mínimo de passageiros processados em posições próximas",
            unit: "%",
            draft: drafts.minimoDom,
            onDraft: (raw) => editDomestic("minimo", raw),
          },
        ]}
      />
      <ShareFields
        title="Percentual de passageiros internacionais processados em ponte de embarque"
        included={airside.international.includeInReport}
        onIncluded={(includeInReport) => setInternational({ includeInReport })}
        formulaLabel="R_AI% = PI / (TI − TEI)"
        numerator="PI"
        denominator="TI − TEI"
        resultSymbol="AI%"
        result={internationalBridgeShare(airside.international)}
        counts={[
          {
            symbol: "TI",
            definition:
              "Número total de passageiros internacionais processados em terminais de passageiros durante determinado período.",
            draft: drafts.ti,
            onDraft: (raw) => editInternational("ti", raw),
          },
          {
            symbol: "TEI",
            definition:
              "Número total de passageiros internacionais processados em terminais de passageiros durante determinado período que tenham sido transportados em aeronaves cujas características físicas impediam a operação em pontes de embarque comercialmente disponíveis no mercado.",
            draft: drafts.tei,
            onDraft: (raw) => editInternational("tei", raw),
          },
          {
            symbol: "PI",
            definition:
              "Número de passageiros internacionais processados em pontes de embarque no período.",
            draft: drafts.pi,
            onDraft: (raw) => editInternational("pi", raw),
          },
          {
            symbol: "",
            definition:
              "Percentual mínimo de passageiros processados em posições próximas",
            unit: "%",
            draft: drafts.minimoInt,
            onDraft: (raw) => editInternational("minimo", raw),
          },
        ]}
      />
    </section>
  );
}

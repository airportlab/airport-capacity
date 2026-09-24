import type { ParamField } from "../domain/types";
import { TexText } from "./FormulaCard";

interface NumberFieldProps {
  field: ParamField;
  draft: string;
  origem: string;
  onValueChange: (raw: string) => void;
  onOrigemChange?: (raw: string) => void;
  onBlur?: () => void;
  describedBy?: string;
}

export function NumberField({
  field,
  draft,
  origem,
  onValueChange,
  onOrigemChange,
  onBlur,
  describedBy,
}: NumberFieldProps) {
  const origemId = describedBy ?? `${field.id}-origem`;
  const origemEdit = Boolean(field.origemEditavel && onOrigemChange);
  const origemText = origem.trim();
  const origemShown = origemEdit || origemText.length > 0;

  return (
    <label className="field">
      <span className="field-label">
        <span>
          <TexText text={field.label} />
        </span>
        <span className="unit">{field.unit}</span>
      </span>
      <input
        inputMode="decimal"
        value={draft}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={onBlur}
        aria-describedby={origemShown ? origemId : undefined}
      />
      {origemEdit ? (
        <textarea
          id={origemId}
          className="origem-edit"
          value={origem}
          onChange={(event) => onOrigemChange?.(event.target.value)}
          rows={3}
        />
      ) : origemText ? (
        <span id={origemId} className="origem">
          {origemText}
        </span>
      ) : null}
    </label>
  );
}

import type { ParamField } from "../domain/types";

interface NumberFieldProps {
  field: ParamField;
  draft: string;
  origem: string;
  onValueChange: (raw: string) => void;
  onOrigemChange?: (raw: string) => void;
  describedBy?: string;
}

export function NumberField({
  field,
  draft,
  origem,
  onValueChange,
  onOrigemChange,
  describedBy,
}: NumberFieldProps) {
  const origemId = describedBy ?? `${field.id}-origem`;
  const origemEdit = Boolean(field.origemEditavel && onOrigemChange);
  const origemText = origem.trim();
  const origemShown = origemEdit || origemText.length > 0;

  return (
    <label className="field">
      <span className="field-label">
        {field.label}
        <span className="unit">{field.unit}</span>
      </span>
      <input
        inputMode="decimal"
        value={draft}
        onChange={(event) => onValueChange(event.target.value)}
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

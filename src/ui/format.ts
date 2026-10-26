export function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

export function parseLocaleNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed || trimmed === "-" || trimmed === "," || trimmed === ".") {
    return null;
  }

  const hasComma = trimmed.includes(",");
  const normalized = hasComma
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatFixed(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatSaturacao(percent: number): string {
  if (!Number.isFinite(percent)) return "—";
  const text = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(percent);
  return `${text}% de saturação`;
}

export function formatEditable(value: number): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 6,
    useGrouping: false,
  }).format(value);
}

export function formatSavedAt(iso: string | null): string {
  if (!iso) return "ainda não salvo";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatAirportName(name: string): string {
  const trimmed = name.trim();
  return trimmed === "" ? "Aeroporto" : trimmed;
}

export function formatReportDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export const evaluationMonths = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export function formatEvaluationPeriod(
  month: number | null,
  year: number | null,
): string {
  if (
    month == null ||
    year == null ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    year < 1
  ) {
    return "—";
  }
  const start = evaluationMonths[month - 1];
  const end = evaluationMonths[(month - 1 + 11) % 12];
  const endYear = year + Math.floor((month - 1 + 11) / 12);
  if (endYear === year) return `${start} a ${end} de ${year}`;
  return `${start} de ${year} a ${end} de ${endYear}`;
}

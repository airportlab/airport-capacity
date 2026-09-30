function formatSeconds(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

/** Nota quando o Tsec usado difere do padrão do Manual de Anteprojeto. */
export function tsecDeviationNote(
  standard: number,
  used: number,
  comment: string,
): string {
  const sentence = `Não foi usado o Tsec de contrato de ${formatSeconds(standard)} segundos, foi usado ${formatSeconds(used)}.`;
  const text = comment.trim();
  return text ? `${sentence} ${text}` : sentence;
}

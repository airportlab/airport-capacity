export interface AirsideDomestic {
  includeInReport: boolean;
  pd: number | null;
  td: number | null;
  ted: number | null;
  minimo: number | null;
}

export interface AirsideInternational {
  includeInReport: boolean;
  pi: number | null;
  ti: number | null;
  tei: number | null;
  minimo: number | null;
}

export interface AirsideState {
  domestic: AirsideDomestic;
  international: AirsideInternational;
}

export function emptyAirsideDomestic(): AirsideDomestic {
  return {
    includeInReport: false,
    pd: null,
    td: null,
    ted: null,
    minimo: null,
  };
}

export function emptyAirsideInternational(): AirsideInternational {
  return {
    includeInReport: false,
    pi: null,
    ti: null,
    tei: null,
    minimo: null,
  };
}

export function emptyAirside(): AirsideState {
  return {
    domestic: emptyAirsideDomestic(),
    international: emptyAirsideInternational(),
  };
}

/** Quociente da fração. Null se faltar número ou se o denominador não for positivo. */
export function bridgeShareRatio(
  processed: number | null,
  total: number | null,
  excluded: number | null,
): number | null {
  if (
    !isCount(processed) ||
    !isCount(total) ||
    !isCount(excluded)
  ) {
    return null;
  }
  const denominator = total - excluded;
  if (!(denominator > 0)) return null;
  const ratio = processed / denominator;
  return Number.isFinite(ratio) ? ratio : null;
}

export function domesticBridgeShare(share: AirsideDomestic): number | null {
  return bridgeShareRatio(share.pd, share.td, share.ted);
}

export function internationalBridgeShare(
  share: AirsideInternational,
): number | null {
  return bridgeShareRatio(share.pi, share.ti, share.tei);
}

/** True quando o percentual calculado alcança o mínimo. Null se faltar um dos dois. */
export function bridgeMinimumMet(
  ratio: number | null,
  minimo: number | null,
): boolean | null {
  if (ratio === null || !isCount(minimo)) return null;
  return ratio >= minimo / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCount(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function parseAirside(value: unknown): AirsideState {
  if (!isRecord(value)) return emptyAirside();
  const domestic = isRecord(value.domestic) ? value.domestic : {};
  const international = isRecord(value.international) ? value.international : {};
  return {
    domestic: {
      includeInReport: domestic.includeInReport === true,
      pd: parseCount(domestic.pd),
      td: parseCount(domestic.td),
      ted: parseCount(domestic.ted),
      minimo: parseCount(domestic.minimo),
    },
    international: {
      includeInReport: international.includeInReport === true,
      pi: parseCount(international.pi),
      ti: parseCount(international.ti),
      tei: parseCount(international.tei),
      minimo: parseCount(international.minimo),
    },
  };
}

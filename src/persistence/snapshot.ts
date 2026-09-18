import {
  parsePersistedState,
  STATE_VERSION,
  type PersistedAirportState,
} from "./localStore";

export const SNAPSHOT_EXTENSION = "airport";
export const SNAPSHOT_FORMAT = "airport-capacity";

const MAGIC = new TextEncoder().encode("AIR1");

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

interface SnapshotEnvelope {
  format: typeof SNAPSHOT_FORMAT;
  schemaVersion: number;
  payload: PersistedAirportState;
  integrity: { alg: "SHA-256"; hash: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function blobFromBytes(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy]);
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = blobFromBytes(bytes).stream().pipeThrough(
    new CompressionStream("gzip"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = blobFromBytes(bytes).stream().pipeThrough(
    new DecompressionStream("gzip"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function startsWithMagic(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length) return false;
  return MAGIC.every((byte, index) => bytes[index] === byte);
}

export async function packSnapshot(
  payload: PersistedAirportState,
): Promise<Blob> {
  const payloadJson = JSON.stringify(payload);
  const envelope: SnapshotEnvelope = {
    format: SNAPSHOT_FORMAT,
    schemaVersion: STATE_VERSION,
    payload,
    integrity: { alg: "SHA-256", hash: await sha256Hex(payloadJson) },
  };
  const compressed = await gzip(new TextEncoder().encode(JSON.stringify(envelope)));
  return blobFromBytes(concat([MAGIC, compressed]));
}

export async function unpackSnapshot(
  buffer: ArrayBuffer,
): Promise<PersistedAirportState> {
  const bytes = new Uint8Array(buffer);
  if (!startsWithMagic(bytes)) {
    throw new SnapshotError("Arquivo inválido.");
  }

  let json: string;
  try {
    const unzipped = await gunzip(bytes.subarray(MAGIC.length));
    json = new TextDecoder().decode(unzipped);
  } catch {
    throw new SnapshotError("Arquivo inválido ou corrompido.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(json) as unknown;
  } catch {
    throw new SnapshotError("Arquivo inválido ou corrompido.");
  }

  if (
    !isRecord(raw) ||
    raw.format !== SNAPSHOT_FORMAT ||
    !isRecord(raw.integrity) ||
    raw.integrity.alg !== "SHA-256" ||
    typeof raw.integrity.hash !== "string"
  ) {
    throw new SnapshotError("Arquivo inválido.");
  }

  const payloadJson = JSON.stringify(raw.payload);
  const expected = raw.integrity.hash.toLowerCase();
  const actual = await sha256Hex(payloadJson);
  if (actual !== expected) {
    throw new SnapshotError("Arquivo alterado ou corrompido.");
  }

  const parsed = parsePersistedState(raw.payload);
  if (!parsed) {
    throw new SnapshotError("Arquivo inválido.");
  }
  return parsed;
}

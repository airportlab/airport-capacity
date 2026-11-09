import type { OrganKind, OrganNature } from "./templates/organs";

export type PranchaLida = {
  nome: string;
  areaM2: number;
  pagina: number | null;
};

export type PranchaCriada = PranchaLida & {
  kind: OrganKind;
  nature: OrganNature;
  /** Nome do carimbo da reversível, na aba da sala fixa com essa área. */
  com?: string;
};

export type PranchaIgnorada = PranchaLida & {
  motivo: "reversivel" | "desconhecida";
};

export type PlantaSeparada = {
  criar: PranchaCriada[];
  ignoradas: PranchaIgnorada[];
};

const AREA_TITULO = /^(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})\s*m²$/;
const TOKEN =
  /\((?:\\.|[^\\)])*\)|(?:Tm|Tj)|[-+]?(?:\d+\.\d*|\.\d+|\d+)/g;

function unescapePdfLiteral(source: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < source.length; i += 1) {
    const code = source.charCodeAt(i);
    if (code !== 0x5c || i + 1 >= source.length) {
      out.push(code & 0xff);
      continue;
    }
    const next = source.charCodeAt(i + 1);
    if (next === 0x6e) {
      out.push(10);
      i += 1;
      continue;
    }
    if (next === 0x72) {
      out.push(13);
      i += 1;
      continue;
    }
    if (next === 0x74) {
      out.push(9);
      i += 1;
      continue;
    }
    if (next === 0x28 || next === 0x29 || next === 0x5c) {
      out.push(next);
      i += 1;
      continue;
    }
    if (next >= 48 && next <= 55) {
      let end = i + 1;
      let octal = "";
      while (end < source.length && octal.length < 3) {
        const digit = source.charCodeAt(end);
        if (digit < 48 || digit > 55) break;
        octal += String.fromCharCode(digit);
        end += 1;
      }
      out.push(Number.parseInt(octal, 8) & 0xff);
      i = end - 1;
      continue;
    }
    out.push(next);
    i += 1;
  }
  return Uint8Array.from(out);
}

function decodeUtf16Be(bytes: Uint8Array): string | null {
  let start = 0;
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    start = 2;
  } else if (!(bytes.length >= 2 && bytes.length % 2 === 0 && bytes[0] === 0)) {
    return null;
  }
  let text = "";
  for (let i = start; i + 1 < bytes.length; i += 2) {
    text += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  }
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return null;
  let readable = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if ((code >= 32 && code < 0x300) || "²³°ºª".includes(char)) readable += 1;
  }
  if (readable / text.length < 0.85) return null;
  return text;
}

function areaDoTitulo(text: string): number | null {
  const match = AREA_TITULO.exec(text.trim());
  if (!match) return null;
  const value = Number(`${match[1].replaceAll(".", "")}.${match[2]}`);
  return Number.isFinite(value) ? value : null;
}

function pranchaDoFluxo(inflated: Uint8Array): PranchaLida | null {
  const content = new TextDecoder("latin1").decode(inflated);
  if (!content.includes("Tj")) return null;
  let scale = 0;
  const nums: number[] = [];
  let pending: string | null = null;
  let nome = "";
  let nomeScale = 0;
  let areaM2: number | null = null;
  let areaScale = 0;
  TOKEN.lastIndex = 0;
  for (const match of content.matchAll(TOKEN)) {
    const token = match[0];
    if (token.startsWith("(")) {
      pending = decodeUtf16Be(unescapePdfLiteral(token.slice(1, -1)));
      continue;
    }
    if (token === "Tm") {
      if (nums.length >= 6) scale = Math.abs(nums[0]);
      nums.length = 0;
      continue;
    }
    if (token === "Tj") {
      if (pending && scale >= 100) {
        const area = areaDoTitulo(pending);
        if (area != null && scale >= areaScale) {
          areaM2 = area;
          areaScale = scale;
        } else if (
          area == null &&
          scale >= 200 &&
          pending !== "Ref:" &&
          !pending.startsWith("Anexo") &&
          scale >= nomeScale
        ) {
          nome = pending;
          nomeScale = scale;
        }
      }
      pending = null;
      nums.length = 0;
      continue;
    }
    const value = Number(token);
    if (Number.isFinite(value)) {
      nums.push(value);
      if (nums.length > 6) nums.shift();
    }
  }
  if (!nome || areaM2 == null) return null;
  return { nome, areaM2, pagina: null };
}

type FluxoFlate = {
  objeto: number;
  raw: Uint8Array;
};

function paginasPorConteudo(text: string): Map<number, number> {
  const map = new Map<number, number>();
  const kidsMatch =
    /\/Type\s*\/Pages\b[\s\S]{0,800}?\/Kids\s*\[([^\]]*)\]/.exec(text);
  const kids = kidsMatch
    ? [...kidsMatch[1].matchAll(/(\d+)\s+0\s+R/g)].map((item) =>
        Number(item[1]),
      )
    : [];
  const numero = new Map<number, number>();
  kids.forEach((id, index) => numero.set(id, index + 1));
  for (const match of text.matchAll(/(\d+)\s+0\s+obj/g)) {
    const id = Number(match[1]);
    const pagina = numero.get(id);
    if (!pagina) continue;
    const start = match.index ?? 0;
    const body = text.slice(start, start + 800);
    if (!/\/Type\s*\/Page(?!s)/.test(body)) continue;
    const bracket = /\/Contents\s*\[([^\]]*)\]/.exec(body);
    if (bracket) {
      for (const ref of bracket[1].matchAll(/(\d+)\s+0\s+R/g)) {
        map.set(Number(ref[1]), pagina);
      }
      continue;
    }
    const single = /\/Contents\s+(\d+)\s+0\s+R/.exec(body);
    if (single) map.set(Number(single[1]), pagina);
  }
  return map;
}

function fluxosFlate(data: Uint8Array, text: string): FluxoFlate[] {
  const streams: FluxoFlate[] = [];
  const marker = /stream\r?\n/g;
  for (const match of text.matchAll(marker)) {
    const index = match.index ?? 0;
    const start = index + match[0].length;
    const end = text.indexOf("endstream", start);
    if (end < 0) break;
    const head = text.slice(Math.max(0, index - 500), index);
    if (!head.includes("/FlateDecode")) continue;
    const objects = [...head.matchAll(/(\d+)\s+0\s+obj/g)];
    const objeto =
      objects.length > 0 ? Number(objects[objects.length - 1][1]) : 0;
    let rawEnd = end;
    if (text.charCodeAt(rawEnd - 1) === 10) rawEnd -= 1;
    if (text.charCodeAt(rawEnd - 1) === 13) rawEnd -= 1;
    streams.push({ objeto, raw: data.slice(start, rawEnd) });
  }
  return streams;
}

async function inflateZlib(raw: Uint8Array): Promise<Uint8Array | null> {
  try {
    const bytes = new Uint8Array(raw);
    const stream = new Blob([bytes.buffer as ArrayBuffer])
      .stream()
      .pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/** Nome, área do carimbo e página de cada prancha, na ordem do arquivo. */
export async function lerPranchasNivelServico(
  data: ArrayBuffer,
): Promise<PranchaLida[]> {
  const bytes = new Uint8Array(data);
  const text = new TextDecoder("latin1").decode(bytes);
  const paginas = paginasPorConteudo(text);
  const pranchas: PranchaLida[] = [];
  for (const fluxo of fluxosFlate(bytes, text)) {
    const inflated = await inflateZlib(fluxo.raw);
    if (!inflated) continue;
    const prancha = pranchaDoFluxo(inflated);
    if (!prancha) continue;
    prancha.pagina = paginas.get(fluxo.objeto) ?? null;
    const previous = pranchas[pranchas.length - 1];
    if (
      previous &&
      previous.nome === prancha.nome &&
      previous.areaM2 === prancha.areaM2
    ) {
      continue;
    }
    pranchas.push(prancha);
  }
  return pranchas;
}

function rotuloDaPrancha(nome: string): string {
  return nome
    .replace(/\s*\(\s*dom\s+e\s+int\s*\)/gi, " misto")
    .replace(/\s+/g, " ")
    .trim();
}

/** “Dom e Int” no carimbo vira o título misto. Com duas contas, a aba ganha pontes ou remotas. A combinação acrescenta “ com ” e o nome da reversível. */
export function tituloDaPrancha(
  nome: string,
  kind?: OrganKind,
  varias = false,
  com?: string,
): string {
  const titulo = rotuloDaPrancha(nome);
  let base = titulo;
  if (varias && kind) {
    if (kind.includes("remotas")) base = `${titulo} remotas`;
    else if (kind.startsWith("sala-embarque")) base = `${titulo} pontes`;
  }
  const complemento = com ? rotuloDaPrancha(com) : "";
  return complemento ? `${base} com ${complemento}` : base;
}

function fold(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type FamiliaPlanta =
  | "checkin-bagagens"
  | "saguao-desembarque"
  | "saguao-embarque"
  | "inspecao"
  | "emigracao"
  | "imigracao"
  | "aduana"
  | "sala-desembarque"
  | "sala-embarque";

function semReversivel(folded: string): string {
  return folded.replaceAll("reversivel", " ").replace(/\s+/g, " ").trim();
}

/** A função da prancha, na mesma ordem de `classificar`, sem exigir natureza. */
function familiaDaPrancha(folded: string): FamiliaPlanta | null {
  if (folded.includes("check-in") || folded.includes("check in")) {
    return "checkin-bagagens";
  }
  if (folded.includes("saguao") && folded.includes("desembarque")) {
    return "saguao-desembarque";
  }
  if (folded.includes("saguao") && folded.includes("embarque")) {
    return "saguao-embarque";
  }
  if (folded.includes("inspec")) return "inspecao";
  if (folded.includes("emigracao")) return "emigracao";
  if (folded.includes("imigracao")) return "imigracao";
  if (folded.includes("aduana")) return "aduana";
  if (folded.includes("desembarque")) return "sala-desembarque";
  if (folded.includes("embarque")) return "sala-embarque";
  return null;
}

function somarArea(fixa: number, reversivel: number): number {
  return Math.round((fixa + reversivel) * 100) / 100;
}

function naturezaDoNome(folded: string): OrganNature | null {
  const domestico = /\bdom/.test(folded);
  const internacional = /\bint/.test(folded);
  if (domestico && internacional) return "misto";
  if (internacional) return "internacional";
  if (domestico) return "domestico";
  return null;
}

function classificar(
  folded: string,
):
  | { kind: OrganKind; nature: OrganNature }
  | { salaEmbarque: OrganNature }
  | PranchaIgnorada["motivo"] {
  if (folded.includes("reversivel")) return "reversivel";
  if (folded.includes("check-in") || folded.includes("check in")) {
    const nature = naturezaDoNome(folded);
    return nature ? { kind: "checkin-bagagens", nature } : "desconhecida";
  }
  if (folded.includes("saguao") && folded.includes("desembarque")) {
    const nature = naturezaDoNome(folded);
    return nature ? { kind: "saguao-desembarque", nature } : "desconhecida";
  }
  if (folded.includes("saguao") && folded.includes("embarque")) {
    const nature = naturezaDoNome(folded);
    return nature ? { kind: "saguao-embarque", nature } : "desconhecida";
  }
  if (folded.includes("inspec")) {
    const nature = naturezaDoNome(folded);
    if (nature === "domestico" || nature === "internacional") {
      return { kind: "inspecao", nature };
    }
    return "desconhecida";
  }
  if (folded.includes("emigracao")) {
    return { kind: "emigracao", nature: "internacional" };
  }
  if (folded.includes("imigracao")) {
    return { kind: "imigracao", nature: "internacional" };
  }
  if (folded.includes("aduana")) {
    return { kind: "aduana", nature: "internacional" };
  }
  if (folded.includes("desembarque")) {
    const nature = naturezaDoNome(folded);
    if (nature === "misto") return "desconhecida";
    return {
      kind: "sala-desembarque",
      nature: nature ?? "domestico",
    };
  }
  if (folded.includes("embarque")) {
    const nature = naturezaDoNome(folded);
    if (nature === "domestico" || nature === "internacional") {
      return { salaEmbarque: nature };
    }
    return "desconhecida";
  }
  return "desconhecida";
}

type PranchaFixada = {
  familia: FamiliaPlanta;
  prancha: PranchaCriada;
};

/** Sem “remoto” no nome, a conta é a de pontes. Com “remoto”, a de remotas. Uma conta só, como na 5ª rodada, permanece. */
function contaDeEmbarque(
  folded: string,
  salasEmbarque: OrganKind[],
): OrganKind | null {
  if (salasEmbarque.length === 0) return null;
  if (salasEmbarque.length === 1) return salasEmbarque[0];
  const remoto = /\bremot/.test(folded);
  return (
    salasEmbarque.find((kind) =>
      remoto ? kind.includes("remotas") : kind.includes("pontes"),
    ) ?? null
  );
}

/** Nome sem tipo fica de fora. A reversível não vira aba: cada fixa da mesma função ganha a aba com a área somada. A sala de embarque sem remoto fica na conta de pontes. */
export function separarPranchas(
  pranchas: PranchaLida[],
  salasEmbarque: OrganKind[] = [],
): PlantaSeparada {
  const fixas: PranchaFixada[] = [];
  const reversiveis: PranchaLida[] = [];
  const ignoradas: PranchaIgnorada[] = [];
  for (const prancha of pranchas) {
    const folded = fold(prancha.nome);
    if (folded.includes("reversivel")) {
      reversiveis.push(prancha);
      continue;
    }
    const destino = classificar(folded);
    if (destino === "reversivel" || destino === "desconhecida") {
      ignoradas.push({ ...prancha, motivo: destino });
      continue;
    }
    if ("salaEmbarque" in destino) {
      const kind = contaDeEmbarque(folded, salasEmbarque);
      if (!kind) {
        ignoradas.push({ ...prancha, motivo: "desconhecida" });
        continue;
      }
      fixas.push({
        familia: "sala-embarque",
        prancha: { ...prancha, kind, nature: destino.salaEmbarque },
      });
      continue;
    }
    const familia = familiaDaPrancha(folded);
    if (!familia) {
      ignoradas.push({ ...prancha, motivo: "desconhecida" });
      continue;
    }
    fixas.push({
      familia,
      prancha: { ...prancha, ...destino },
    });
  }

  const criar = fixas.map((item) => item.prancha);
  for (const reversivel of reversiveis) {
    const folded = semReversivel(fold(reversivel.nome));
    const familia = familiaDaPrancha(folded);
    const nature = naturezaDoNome(folded);
    const pares =
      familia === null
        ? []
        : fixas.filter(
            (item) =>
              item.familia === familia &&
              (nature === null || item.prancha.nature === nature),
          );
    if (pares.length === 0) {
      ignoradas.push({ ...reversivel, motivo: "reversivel" });
      continue;
    }
    for (const par of pares) {
      criar.push({
        ...par.prancha,
        areaM2: somarArea(par.prancha.areaM2, reversivel.areaM2),
        com: reversivel.nome,
      });
    }
  }
  return { criar, ignoradas };
}

export type AirportId =
  | "sbsg"
  | "sbgo"
  | "sbmt"
  | "sbjr"
  | "sbbe"
  | "sbmq"
  | "sbsp"
  | "sbcg"
  | "sbcr"
  | "sbpp"
  | "sbsn"
  | "sbma"
  | "sbcj"
  | "sbht"
  | "sbul"
  | "sbmk"
  | "sbur";

export type RoundId = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type PmdTableId = "standard";
export type AirportBlock =
  | "Relicitação"
  | "Central"
  | "Aviação Geral"
  | "Norte II"
  | "SP/MS/PA/MG";

export interface AirportSource {
  id: AirportId;
  icao: string;
  place: string;
  name: string;
  roundId: RoundId;
  block: AirportBlock;
  contract: string;
  peakLabel: string;
  pmdTableId: PmdTableId;
}

export interface AirportGroup {
  label: string;
  airports: AirportSource[];
}

export const DEFAULT_AIRPORT_ID: AirportId = "sbsg";

const PEAK_LABEL = "Valores na hora-pico";

function source(
  id: AirportId,
  icao: string,
  place: string,
  roundId: RoundId,
  block: AirportBlock,
  contract: string,
): AirportSource {
  return {
    id,
    icao,
    place,
    name: `${place} (${icao})`,
    roundId,
    block,
    contract,
    peakLabel: PEAK_LABEL,
    pmdTableId: "standard",
  };
}

export const AIRPORTS: AirportSource[] = [
  source(
    "sbsg",
    "SBSG",
    "São Gonçalo do Amarante",
    "1",
    "Relicitação",
    "Contrato de Concessão nº 004/ANAC/2023",
  ),
  source(
    "sbgo",
    "SBGO",
    "Santa Genoveva",
    "6",
    "Central",
    "Contrato de Concessão nº 003/ANAC/2021-Central",
  ),
  source(
    "sbmt",
    "SBMT",
    "Campo de Marte",
    "7",
    "Aviação Geral",
    "Contrato de Concessão nº 001/ANAC/2023-Aviação Geral",
  ),
  source(
    "sbjr",
    "SBJR",
    "Jacarepaguá",
    "7",
    "Aviação Geral",
    "Contrato de Concessão nº 001/ANAC/2023-Aviação Geral",
  ),
  source(
    "sbbe",
    "SBBE",
    "Belém",
    "7",
    "Norte II",
    "Contrato de Concessão nº 003/ANAC/2023-Norte II",
  ),
  source(
    "sbmq",
    "SBMQ",
    "Macapá",
    "7",
    "Norte II",
    "Contrato de Concessão nº 003/ANAC/2023-Norte II",
  ),
  source(
    "sbsp",
    "SBSP",
    "Congonhas",
    "7",
    "SP/MS/PA/MG",
    "Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG",
  ),
  source(
    "sbcg",
    "SBCG",
    "Campo Grande",
    "7",
    "SP/MS/PA/MG",
    "Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG",
  ),
  source(
    "sbcr",
    "SBCR",
    "Corumbá",
    "7",
    "SP/MS/PA/MG",
    "Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG",
  ),
  source(
    "sbpp",
    "SBPP",
    "Ponta Porã",
    "7",
    "SP/MS/PA/MG",
    "Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG",
  ),
  source(
    "sbsn",
    "SBSN",
    "Santarém",
    "7",
    "SP/MS/PA/MG",
    "Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG",
  ),
  source(
    "sbma",
    "SBMA",
    "Marabá",
    "7",
    "SP/MS/PA/MG",
    "Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG",
  ),
  source(
    "sbcj",
    "SBCJ",
    "Parauapebas",
    "7",
    "SP/MS/PA/MG",
    "Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG",
  ),
  source(
    "sbht",
    "SBHT",
    "Altamira",
    "7",
    "SP/MS/PA/MG",
    "Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG",
  ),
  source(
    "sbul",
    "SBUL",
    "Uberlândia",
    "7",
    "SP/MS/PA/MG",
    "Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG",
  ),
  source(
    "sbmk",
    "SBMK",
    "Montes Claros",
    "7",
    "SP/MS/PA/MG",
    "Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG",
  ),
  source(
    "sbur",
    "SBUR",
    "Uberaba",
    "7",
    "SP/MS/PA/MG",
    "Contrato de Concessão nº 002/ANAC/2023-SP/MS/PA/MG",
  ),
];

const AIRPORT_IDS: AirportId[] = AIRPORTS.map((item) => item.id);

export function parseAirportId(raw: unknown): AirportId {
  return typeof raw === "string" && AIRPORT_IDS.includes(raw as AirportId)
    ? (raw as AirportId)
    : DEFAULT_AIRPORT_ID;
}

export function airportById(id: string | undefined): AirportSource {
  return AIRPORTS.find((item) => item.id === id) ?? AIRPORTS[0];
}

export function defaultAirport(): AirportSource {
  return airportById(DEFAULT_AIRPORT_ID);
}

export function airportOptionLabel(source: AirportSource): string {
  return `${source.icao} — ${source.place}`;
}

export function airportGroupLabel(item: AirportSource): string {
  return `${item.roundId}ª rodada — ${item.block}`;
}

export function airportsByGroup(): AirportGroup[] {
  const groups: AirportGroup[] = [];
  for (const item of AIRPORTS) {
    const label = airportGroupLabel(item);
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.airports.push(item);
    } else {
      groups.push({ label, airports: [item] });
    }
  }
  return groups;
}

export function shouldReplaceAirportName(
  currentName: string,
  previous: AirportSource,
): boolean {
  const trimmed = currentName.trim();
  return trimmed === "" || trimmed === previous.name;
}

export type AirportId =
  | "sbsg"
  | "sbkp"
  | "sbgr"
  | "sbbr"
  | "sbgl"
  | "sbcf"
  | "sbpa"
  | "sbsv"
  | "sbfl"
  | "sbfz"
  | "sbrf"
  | "sbmo"
  | "sbjp"
  | "sbar"
  | "sbkg"
  | "sbju"
  | "sbcy"
  | "sbsi"
  | "sbrd"
  | "sbat"
  | "sbvt"
  | "sbme"
  | "sbeg"
  | "sbpv"
  | "sbrb"
  | "sbcz"
  | "sbtt"
  | "sbtf"
  | "sbbv"
  | "sbgo"
  | "sbsl"
  | "sbte"
  | "sbpj"
  | "sbpl"
  | "sbiz"
  | "sbct"
  | "sbfi"
  | "sbnf"
  | "sblo"
  | "sbjv"
  | "sbbi"
  | "sbpk"
  | "sbug"
  | "sbbg"
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
export type PmdTableId = "standard" | "nordeste" | "sentado";
export type AirportBlock =
  | "Relicitação"
  | "Individual"
  | "Nordeste"
  | "Centro-Oeste"
  | "Sudeste"
  | "Norte"
  | "Central"
  | "Sul"
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
  pmdTableId: PmdTableId = "standard",
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
    pmdTableId,
  };
}

const NORDESTE_CONTRACT =
  "Contrato de Concessão do Bloco Nordeste, Termo Aditivo n. 002, de 07 de junho de 2023";
const CENTRO_OESTE_CONTRACT = "Contrato de Concessão nº 002/ANAC/2019-Centro-Oeste";
const SUDESTE_CONTRACT =
  "Contrato de Concessão do Bloco Sudeste, Termo Aditivo n. 001, de 15 de setembro de 2021";
const NORTE_CONTRACT = "Contrato de Concessão do Bloco Norte (6ª rodada)";
const CENTRAL_CONTRACT = "Contrato de Concessão nº 003/ANAC/2021-Central";
const SUL_CONTRACT = "Contrato de Concessão nº 002/ANAC/2021-Sul";

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
    "sbkp",
    "SBKP",
    "Viracopos",
    "2",
    "Individual",
    "Contrato de Concessão do Aeroporto de Viracopos (2ª rodada)",
    "sentado",
  ),
  source(
    "sbgr",
    "SBGR",
    "Guarulhos",
    "2",
    "Individual",
    "Contrato de Concessão do Aeroporto Internacional de Guarulhos, Apêndice B pela Decisão nº 587, de 28 de dezembro de 2022",
    "sentado",
  ),
  source(
    "sbbr",
    "SBBR",
    "Brasília",
    "2",
    "Individual",
    "Contrato de Concessão do Aeroporto Internacional de Brasília (2ª rodada)",
    "sentado",
  ),
  source(
    "sbgl",
    "SBGL",
    "Galeão",
    "3",
    "Individual",
    "Contrato de Concessão nº 001/ANAC/2014-SBGL",
    "sentado",
  ),
  source(
    "sbcf",
    "SBCF",
    "Confins",
    "3",
    "Individual",
    "Contrato de Concessão nº 002/ANAC/2014-SBCF",
    "sentado",
  ),
  source(
    "sbpa",
    "SBPA",
    "Porto Alegre",
    "4",
    "Individual",
    "Contrato de Concessão do Aeroporto Internacional de Porto Alegre, Apêndice B pela Decisão nº 589, de 28 de dezembro de 2022",
    "sentado",
  ),
  source(
    "sbsv",
    "SBSV",
    "Salvador",
    "4",
    "Individual",
    "Contrato de Concessão do Aeroporto Internacional de Salvador, 1ª Revisão dos Parâmetros da Concessão (dezembro de 2022)",
    "sentado",
  ),
  source(
    "sbfl",
    "SBFL",
    "Florianópolis",
    "4",
    "Individual",
    "Contrato de Concessão do Aeroporto Internacional de Florianópolis, 1ª Revisão dos Parâmetros da Concessão (dezembro de 2022)",
    "sentado",
  ),
  source(
    "sbfz",
    "SBFZ",
    "Fortaleza",
    "4",
    "Individual",
    "Contrato de Concessão do Aeroporto Internacional de Fortaleza, Apêndice B pela Decisão nº 590, de 28 de dezembro de 2022",
    "sentado",
  ),
  source(
    "sbrf",
    "SBRF",
    "Recife",
    "5",
    "Nordeste",
    NORDESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbmo",
    "SBMO",
    "Maceió",
    "5",
    "Nordeste",
    NORDESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbjp",
    "SBJP",
    "João Pessoa",
    "5",
    "Nordeste",
    NORDESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbar",
    "SBAR",
    "Aracaju",
    "5",
    "Nordeste",
    NORDESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbkg",
    "SBKG",
    "Campina Grande",
    "5",
    "Nordeste",
    NORDESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbju",
    "SBJU",
    "Juazeiro do Norte",
    "5",
    "Nordeste",
    NORDESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbcy",
    "SBCY",
    "Cuiabá",
    "5",
    "Centro-Oeste",
    CENTRO_OESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbsi",
    "SBSI",
    "Sinop",
    "5",
    "Centro-Oeste",
    CENTRO_OESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbrd",
    "SBRD",
    "Rondonópolis",
    "5",
    "Centro-Oeste",
    CENTRO_OESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbat",
    "SBAT",
    "Alta Floresta",
    "5",
    "Centro-Oeste",
    CENTRO_OESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbvt",
    "SBVT",
    "Vitória",
    "5",
    "Sudeste",
    SUDESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbme",
    "SBME",
    "Macaé",
    "5",
    "Sudeste",
    SUDESTE_CONTRACT,
    "nordeste",
  ),
  source(
    "sbeg",
    "SBEG",
    "Manaus",
    "6",
    "Norte",
    NORTE_CONTRACT,
  ),
  source(
    "sbpv",
    "SBPV",
    "Porto Velho",
    "6",
    "Norte",
    NORTE_CONTRACT,
  ),
  source(
    "sbrb",
    "SBRB",
    "Rio Branco",
    "6",
    "Norte",
    NORTE_CONTRACT,
  ),
  source(
    "sbcz",
    "SBCZ",
    "Cruzeiro do Sul",
    "6",
    "Norte",
    NORTE_CONTRACT,
  ),
  source(
    "sbtt",
    "SBTT",
    "Tabatinga",
    "6",
    "Norte",
    NORTE_CONTRACT,
  ),
  source(
    "sbtf",
    "SBTF",
    "Tefé",
    "6",
    "Norte",
    NORTE_CONTRACT,
  ),
  source(
    "sbbv",
    "SBBV",
    "Boa Vista",
    "6",
    "Norte",
    NORTE_CONTRACT,
  ),
  source(
    "sbgo",
    "SBGO",
    "Santa Genoveva",
    "6",
    "Central",
    CENTRAL_CONTRACT,
  ),
  source(
    "sbsl",
    "SBSL",
    "São Luís",
    "6",
    "Central",
    CENTRAL_CONTRACT,
  ),
  source(
    "sbte",
    "SBTE",
    "Teresina",
    "6",
    "Central",
    CENTRAL_CONTRACT,
  ),
  source(
    "sbpj",
    "SBPJ",
    "Palmas",
    "6",
    "Central",
    CENTRAL_CONTRACT,
  ),
  source(
    "sbpl",
    "SBPL",
    "Petrolina",
    "6",
    "Central",
    CENTRAL_CONTRACT,
  ),
  source(
    "sbiz",
    "SBIZ",
    "Imperatriz",
    "6",
    "Central",
    CENTRAL_CONTRACT,
  ),
  source(
    "sbct",
    "SBCT",
    "Curitiba",
    "6",
    "Sul",
    SUL_CONTRACT,
  ),
  source(
    "sbfi",
    "SBFI",
    "Foz do Iguaçu",
    "6",
    "Sul",
    SUL_CONTRACT,
  ),
  source(
    "sbnf",
    "SBNF",
    "Navegantes",
    "6",
    "Sul",
    SUL_CONTRACT,
  ),
  source(
    "sblo",
    "SBLO",
    "Londrina",
    "6",
    "Sul",
    SUL_CONTRACT,
  ),
  source(
    "sbjv",
    "SBJV",
    "Joinville",
    "6",
    "Sul",
    SUL_CONTRACT,
  ),
  source(
    "sbbi",
    "SBBI",
    "Bacacheri",
    "6",
    "Sul",
    SUL_CONTRACT,
  ),
  source(
    "sbpk",
    "SBPK",
    "Pelotas",
    "6",
    "Sul",
    SUL_CONTRACT,
  ),
  source(
    "sbug",
    "SBUG",
    "Uruguaiana",
    "6",
    "Sul",
    SUL_CONTRACT,
  ),
  source(
    "sbbg",
    "SBBG",
    "Bagé",
    "6",
    "Sul",
    SUL_CONTRACT,
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

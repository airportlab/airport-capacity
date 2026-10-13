import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { airportById, type AirportId } from "../domain/airports";
import {
  dhpCoverageText,
  loadDhpCoverage,
  loadMovimento,
  type DhpCoverage,
} from "../dhp/duckdb";
import { arquivoTexto, useMovimento } from "./useMovimento";

const EMPTY_COVERAGE: DhpCoverage = {
  dataRecente: null,
  periodoInicio: null,
  periodoFim: null,
};

const PARQUET_URL = import.meta.env.VITE_PARQUET_URL?.trim() ?? "";
const DOWNLOAD_ERROR = "Não foi possível baixar a movimentação.";

function parquetFileName(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    if (name.toLowerCase().endsWith(".parquet")) return name;
  } catch {
    // An invalid URL uses the default name.
  }
  return "movimentacoes.parquet";
}

interface DhpSearchPageProps {
  airportId: AirportId;
}

export function DhpSearchPage({ airportId }: DhpSearchPageProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const movimento = useMovimento();
  const [coverage, setCoverage] = useState<DhpCoverage>(EMPTY_COVERAGE);
  const [reading, setReading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const airport = airportById(airportId);
  const ocupado = movimento.restaurando || movimento.enviando;
  const pedido = useRef({ icao: airport.icao, nome: movimento.nome });

  useEffect(() => {
    const mudou =
      pedido.current.icao !== airport.icao || pedido.current.nome !== movimento.nome;
    pedido.current = { icao: airport.icao, nome: movimento.nome };
    if (ocupado || !movimento.nome) {
      setReading(false);
      setCoverage(EMPTY_COVERAGE);
      return;
    }
    if (mudou) setError(null);
    let cancelled = false;
    setReading(true);
    setCoverage(EMPTY_COVERAGE);
    void loadDhpCoverage(airport.icao)
      .then((next) => {
        if (!cancelled) setCoverage(next);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setCoverage(EMPTY_COVERAGE);
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível ler o movimento.",
        );
      })
      .finally(() => {
        if (!cancelled) setReading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [airport.icao, movimento.nome, ocupado]);

  async function handleLatest() {
    if (!PARQUET_URL) return;
    setError(null);
    setDownloading(true);
    try {
      let response: Response;
      try {
        response = await fetch(PARQUET_URL, { cache: "no-store" });
      } catch {
        throw new Error(DOWNLOAD_ERROR);
      }
      if (!response.ok) throw new Error(DOWNLOAD_ERROR);
      const blob = await response.blob();
      await loadMovimento(new File([blob], parquetFileName(PARQUET_URL)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : DOWNLOAD_ERROR);
    } finally {
      setDownloading(false);
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    try {
      await loadMovimento(file);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível ler o arquivo de movimentação.",
      );
    }
  }

  return (
    <section className="panel">
      <h2>DHP</h2>
      <p className="panel-lead">
        O navegador guarda este arquivo até um envio novo.
      </p>
      <p className="dhp-meta">{dhpCoverageText(coverage)}</p>
      <p className="dhp-meta">
        {movimento.restaurando || (!movimento.nome && movimento.erro)
          ? arquivoTexto(movimento, "")
          : `Nome do arquivo de movimentações: ${movimento.nome ?? "—"}`}
      </p>
      <div className="actions dhp-actions">
        <input
          ref={fileRef}
          type="file"
          accept=".parquet"
          hidden
          onChange={(event) => void handleFile(event)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={ocupado || reading || downloading}
        >
          {movimento.enviando && !downloading ? "A enviar…" : "Enviar movimentação"}
        </button>
        <button
          type="button"
          onClick={() => void handleLatest()}
          disabled={!PARQUET_URL || ocupado || reading || downloading}
        >
          {downloading ? "A carregar…" : "Carregar dados mais atualizados"}
        </button>
      </div>
      {PARQUET_URL ? null : (
        <p className="panel-lead">O endereço da movimentação não está configurado.</p>
      )}
      {error ? <p className="panel-lead">{error}</p> : null}
    </section>
  );
}

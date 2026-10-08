import { useSyncExternalStore } from "react";
import {
  movimentoAtual,
  subscribeMovimento,
  type MovimentoState,
} from "../dhp/duckdb";

export function useMovimento(): MovimentoState {
  return useSyncExternalStore(subscribeMovimento, movimentoAtual, movimentoAtual);
}

export function arquivoTexto(movimento: MovimentoState, vazio: string): string {
  if (movimento.restaurando) return "A abrir a movimentação guardada.";
  if (movimento.nome) return movimento.nome;
  if (movimento.erro) return movimento.erro;
  return vazio;
}

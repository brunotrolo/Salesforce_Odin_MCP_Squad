export interface Oculto { linha: number; coluna: number; codigo: string; nome: string }
export function caracteresOcultos(texto: string): Oculto[];
export function varrerOcultos(raiz: string, caminhos: string[], o?: { extensoes?: Set<string> }): string[];
export const FAIXAS: Array<[number, number, string]>;

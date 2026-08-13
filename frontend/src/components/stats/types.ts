export interface WordStat {
  surface_devanagari: string;
  surface_romanized: string;
  english_gloss: string;
  word_sense_definition: string | null;
  note: string | null;
  word_sense_id: string | null;
  play_count: number;
  word_audio_path: string | null;
  sentence_word_id: string | null;
}

export interface StatsSummaryData {
  count: number;
  mean: number;
  min: number;
  max: number;
}

export type SortColumn =
  | "devanagari"
  | "romanized"
  | "english"
  | "override"
  | "count";

export type SortDirection = "asc" | "desc";

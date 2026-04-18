export interface SentenceWord {
  id: string;
  position: number;
  surface_devanagari: string;
  surface_romanized: string;
  english_gloss: string;
  word_sense_definition: string | null;
  word_sense_id: string | null;
  note: string | null;
  word_audio_path: string | null;
}

export interface Sentence {
  id: string;
  story_id: string;
  sequence_num: number;
  devanagari: string;
  romanized: string;
  english: string;
  audio_path: string | null;
  words: SentenceWord[] | undefined;
}

export interface Story {
  id: string;
  position: number | null;
  title_hi: string;
  title_en: string | null;
  author: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string | null;
}

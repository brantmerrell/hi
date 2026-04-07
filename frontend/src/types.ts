export interface SentenceWord {
  id: string;
  position: number;
  surface_devanagari: string;
  surface_romanized: string;
  english_gloss: string;
  word_sense_definition: string | null;
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
  words: SentenceWord[];
}

export interface Story {
  id: string;
  title: string;
  title_hi: string;
  author: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string | null;
}

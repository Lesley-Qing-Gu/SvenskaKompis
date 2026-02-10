
export enum Level {
  SFICD = 'SFI C/D (基础)',
  PROFESSIONAL = 'Professional (职场)',
  SLANG = 'Slang/Casual (地道口语)'
}

export interface VocabularyItem {
  term: string;
  translation: string;
  info: string;
}

export interface DialogueLine {
  role: string;
  swedish: string;
  chinese: string;
}

export interface PronunciationKey {
  term: string;
  explanation: string;
}

export interface SwedishCoachResponse {
  vocabulary: VocabularyItem[];
  dialogue: DialogueLine[];
  culturalTip: string;
  pronunciation: PronunciationKey[];
}

export interface CoachRequest {
  scenario: string;
  level: Level;
  keywords: string;
}

import { create } from 'zustand';
import { LangCode } from '../config/translations';

interface LanguageState {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  lang: 'en',
  setLang: (lang) => set({ lang }),
}));

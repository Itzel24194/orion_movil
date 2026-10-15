import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { messages } from '../i18n/translations';
import { translateText } from '../i18n/translate';

// Idioma actual accesible fuera de componentes (p. ej. Alert.alert).
let currentLanguage = 'es';
export const getCurrentLanguage = () => currentLanguage;

const PreferencesContext = createContext(null);
const KEY = '@orion/preferences/v1';
const light = {
  background: '#F6F7FB', surface: '#FFFFFF', text: '#151926',
  subtle: '#657084', border: '#E5E9F0', primary: '#635BEB',
  soft: '#F0EEFF', success: '#0F9367', input: '#F2F4F9',
};
const dark = {
  background: '#0B1020', surface: '#151C2D', text: '#F8FAFC',
  subtle: '#ACB7CC', border: '#2B354B', primary: '#948CFF',
  soft: '#252341', success: '#34D399', input: '#202B3D',
};

export function PreferencesProvider({ children }) {
  const systemTheme = useColorScheme();
  const deviceLanguage = getLocales()?.[0]?.languageCode === 'en' ? 'en' : 'es';
  const [mode, setMode] = useState('system');
  const [language, setLanguage] = useState(deviceLanguage);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY).then(value => {
      if (!active || !value) return;
      const saved = JSON.parse(value);
      if (['system', 'light', 'dark'].includes(saved.mode)) setMode(saved.mode);
      if (['es', 'en'].includes(saved.language)) setLanguage(saved.language);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const update = (next) => {
    const newMode = next.mode ?? mode;
    const newLanguage = next.language ?? language;
    setMode(newMode);
    setLanguage(newLanguage);
    AsyncStorage.setItem(KEY, JSON.stringify({ mode: newMode, language: newLanguage })).catch(() => {});
  };
  const isDark = mode === 'dark' || (mode === 'system' && systemTheme === 'dark');
  const palette = isDark ? dark : light;
  currentLanguage = language;
  // t('clave') usa el catálogo corto; si la clave es un texto en español, lo traduce con el diccionario completo.
  const t = (key) => messages[language]?.[key] ?? (language === 'en' ? translateText(messages.es[key] ?? key, 'en') : messages.es[key] ?? key);
  const value = useMemo(() => ({ mode, language, isDark, palette, t,
    setMode: (value) => update({ mode: value }),
    setLanguage: (value) => update({ language: value }),
  }), [mode, language, isDark]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('PreferencesProvider no está disponible');
  return ctx;
}

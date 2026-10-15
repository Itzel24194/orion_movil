// Componentes de interfaz con traducción automática (es <-> en).
// Se usan igual que los de react-native: <Text>, <TextInput> y Alert.alert().
// El idioma sale de PreferencesContext; al cambiarlo todo se re-renderiza solo.
import React from 'react';
import { Alert as RNAlert, Text as RNText, TextInput as RNTextInput } from 'react-native';
import { translateText } from './translate';
import { usePreferences, getCurrentLanguage } from '../context/PreferencesContext';

function translateChildren(children, language) {
  if (language !== 'en') return children;
  if (typeof children === 'string') return translateText(children, language);
  if (Array.isArray(children)) return children.map(c => (typeof c === 'string' ? translateText(c, language) : c));
  return children;
}

export const Text = React.forwardRef(function Text({ children, accessibilityLabel, ...rest }, ref) {
  const { language } = usePreferences();
  return <RNText ref={ref} {...rest}
    accessibilityLabel={typeof accessibilityLabel === 'string' ? translateText(accessibilityLabel, language) : accessibilityLabel}>
    {translateChildren(children, language)}
  </RNText>;
});

export const TextInput = React.forwardRef(function TextInput({ placeholder, ...rest }, ref) {
  const { language } = usePreferences();
  return <RNTextInput ref={ref} {...rest} placeholder={typeof placeholder === 'string' ? translateText(placeholder, language) : placeholder} />;
});

const tr = s => translateText(s, getCurrentLanguage());
export const Alert = {
  alert(title, message, buttons, options) {
    const tb = Array.isArray(buttons) ? buttons.map(b => (b && typeof b.text === 'string' ? { ...b, text: tr(b.text) } : b)) : buttons;
    return RNAlert.alert(tr(title), typeof message === 'string' ? tr(message) : message, tb, options);
  },
};

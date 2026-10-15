import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { Text, type TextProps } from 'react-native';

// Enlace externo sin expo-router (la app navega con React Navigation).
type Props = Omit<TextProps, 'onPress'> & { href: string };

export function ExternalLink({ href, children, ...rest }: Props) {
  return (
    <Text
      {...rest}
      accessibilityRole="link"
      onPress={() => openBrowserAsync(href, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC })}
    >
      {children}
    </Text>
  );
}

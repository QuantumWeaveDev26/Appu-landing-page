/**
 * Text and TextInput for every screen:
 * - the website's fonts (Manrope body, Space Grotesk headings) are applied automatically;
 * - plain UI text is shown in the chosen language (Hindi / Kannada) via the shared dictionary.
 *   Pass `noTranslate` for content that must stay as written (chat messages, lesson content).
 */
import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { translateUi } from '../i18n/uiTranslate';

const BOLD = new Set(['600', '700', '800', '900', 'bold']);

function fontFor(style: TextProps['style']): TextStyle | null {
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  if (flat.fontFamily) return null;
  const bold = BOLD.has(String(flat.fontWeight ?? '400'));
  const big = (flat.fontSize ?? 14) >= 20;
  return {
    fontFamily: bold ? (big ? theme.fonts.heading : theme.fonts.bodyBold) : theme.fonts.body,
    fontWeight: 'normal', // the font file carries the weight
  };
}

function translateChildren(children: React.ReactNode, lang: string): React.ReactNode {
  if (lang !== 'hi' && lang !== 'kn') return children;
  if (typeof children === 'string') return translateUi(children, lang);
  if (Array.isArray(children)) {
    // Join adjacent plain strings/numbers first so "Card {n} of {n}" is looked up as one phrase.
    const parts: React.ReactNode[] = [];
    let buffer = '';
    let hasText = false;
    const flush = () => {
      if (hasText) parts.push(translateUi(buffer, lang));
      buffer = '';
      hasText = false;
    };
    for (const child of children) {
      if (typeof child === 'string' || typeof child === 'number') {
        buffer += String(child);
        hasText = true;
      } else {
        flush();
        parts.push(child);
      }
    }
    flush();
    return parts;
  }
  return children;
}

type AppTextProps = TextProps & { noTranslate?: boolean };

export const Text = forwardRef<RNText, AppTextProps>(({ noTranslate, children, ...props }, ref) => {
  const { i18n } = useTranslation();
  return (
    <RNText ref={ref} {...props} style={[props.style, fontFor(props.style)]}>
      {noTranslate ? children : translateChildren(children, i18n.language)}
    </RNText>
  );
});
Text.displayName = 'AppText';

export const TextInput = forwardRef<RNTextInput, TextInputProps>((props, ref) => {
  const { i18n } = useTranslation();
  return (
    <RNTextInput
      ref={ref}
      {...props}
      placeholder={props.placeholder ? translateUi(props.placeholder, i18n.language) : props.placeholder}
      style={[props.style, fontFor(props.style as TextProps['style'])]}
    />
  );
});
TextInput.displayName = 'AppTextInput';

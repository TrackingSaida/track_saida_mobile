import React from "react";
import { Text, type TextProps, type StyleProp, type TextStyle } from "react-native";
import { type as typo, textStyle, type TypeToken } from "../../theme/typography";

export type AppTextProps = TextProps & {
  /** Token tipográfico do tema (opcional). */
  variant?: TypeToken;
};

/**
 * Text que respeita a escala de fonte do sistema (padrão B / Play Store).
 * Sem maxFontSizeMultiplier — layouts devem acompanhar o fontScale.
 */
export default function AppText({ variant, style, children, ...rest }: AppTextProps) {
  const variantStyle: StyleProp<TextStyle> = variant ? textStyle(variant) : undefined;
  return (
    <Text allowFontScaling style={[variantStyle, style]} {...rest}>
      {children}
    </Text>
  );
}

export { typo };

import React from "react";
import { TextInput, type TextInputProps, type StyleProp, type TextStyle } from "react-native";
import { textStyle, type TypeToken } from "../../theme/typography";

export type AppTextInputProps = TextInputProps & {
  variant?: TypeToken;
};

/**
 * TextInput com escala de fonte do sistema (padrão B).
 * Preferir minHeight no container em vez de height fixo.
 */
export default function AppTextInput({ variant = "body", style, ...rest }: AppTextInputProps) {
  const variantStyle: StyleProp<TextStyle> = textStyle(variant);
  return <TextInput allowFontScaling style={[variantStyle, style]} {...rest} />;
}

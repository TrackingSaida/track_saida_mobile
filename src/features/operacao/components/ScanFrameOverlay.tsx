import React from "react";
import { View, Dimensions, type ViewStyle } from "react-native";

const FRAME_SIZE = Math.min(Dimensions.get("window").width, Dimensions.get("window").height) * 0.65;
const CORNER_LENGTH = 40;
const CORNER_THICKNESS = 5;
const CORNER_COLOR = "#00bfff";

/** Moldura central (cantos) para alinhar QR/código na câmera — mesmo padrão de leitura de coleta. */
export function ScanFrameOverlay({ wrapStyle }: { wrapStyle: ViewStyle }) {
  const cornerStyle = {
    position: "absolute" as const,
    width: CORNER_LENGTH,
    height: CORNER_LENGTH,
    borderColor: CORNER_COLOR,
    shadowColor: CORNER_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  };
  return (
    <View style={[wrapStyle, { width: FRAME_SIZE, height: FRAME_SIZE }]} pointerEvents="none">
      <View
        style={[
          cornerStyle,
          { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
        ]}
      />
      <View
        style={[
          cornerStyle,
          { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
        ]}
      />
      <View
        style={[
          cornerStyle,
          { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
        ]}
      />
      <View
        style={[
          cornerStyle,
          { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
        ]}
      />
    </View>
  );
}

import React, { useEffect, useRef } from "react";
import {
  Animated,
  TouchableOpacity,
  type TouchableOpacityProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = TouchableOpacityProps & {
  pulsing?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function PulsingTouchable({
  pulsing = false,
  style,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulsing) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.05, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={style} activeOpacity={0.85} {...rest}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { operationalIcons, type OperationalIconKey } from "../theme/operationalIcons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  name: OperationalIconKey;
  color: string;
  size?: number;
  backgroundColor?: string;
};

const CONTAINER_SIZE = 104;

export function OperationalStatusIcon({
  name,
  color,
  size = 60,
  backgroundColor,
}: Props) {
  const iconName = operationalIcons[name] as IoniconName;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: backgroundColor ?? `${color}18` },
      ]}
    >
      <Ionicons name={iconName} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
    borderRadius: CONTAINER_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

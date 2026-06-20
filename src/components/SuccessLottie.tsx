import React, { useEffect, useState } from "react";
import { View } from "react-native";
import LottieView from "lottie-react-native";

const LOTTIE_SUCCESS_URL =
  "https://lottie.host/65fe40cc-cd6f-46e7-b45b-1afec1539923/bXroAwf17P.json";

export default function SuccessLottie({ visible }: { visible: boolean }) {
  const [source, setSource] = useState<object | null>(null);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetch(LOTTIE_SUCCESS_URL)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSource(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);
  if (!source) return <View style={{ width: 120, height: 120, marginVertical: 8 }} />;
  return (
    <LottieView
      source={source}
      autoPlay
      loop
      style={{ width: 120, height: 120, alignSelf: "center", marginVertical: 8 }}
    />
  );
}

import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ListRenderItem,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import HomeProximoPage, { type HomeNavigationHandlers } from "./HomeProximoPage";
import HomeHojePage from "./HomeHojePage";
import HomeAtalhosPage from "./HomeAtalhosPage";
import HomePageIndicator from "./HomePageIndicator";
import type { useHomeData } from "../hooks/useHomeData";
import { useHomeRouteStore } from "../../../store/homeRouteStore";
import { getRotaResumo } from "../../entregas/api";
import {
  useDiaRotaConcluidaStore,
  VALOR_ROTA_LABEL,
} from "../../../store/diaRotaConcluidaStore";

type HomeData = ReturnType<typeof useHomeData>;

type PageKey = "proximo" | "hoje" | "atalhos";

const PAGES: PageKey[] = ["proximo", "hoje", "atalhos"];

export type HomePagerCallbacks = HomeNavigationHandlers & {
  onPendentes: () => void;
  onFinalizadas: () => void;
  onAusentes: () => void;
  onAtrasadas: () => void;
  onMinhasEntregas: () => void;
  onMapaPendentes: () => void;
  onPreferencias: () => void;
};

type Props = {
  data: HomeData;
  callbacks: HomePagerCallbacks;
};

async function openRouteResumo(rotaId: string): Promise<void> {
  const resumo = await getRotaResumo(rotaId);
  useDiaRotaConcluidaStore.getState().open({
    variant: "route",
    paradas: resumo.paradas,
    pedidos: resumo.pedidos,
    entregues: resumo.entregues,
    ausentes: resumo.ausentes,
    pendentes: resumo.pendentes,
    valorRota: String(resumo.valor_total ?? "0"),
    valorLabel: VALOR_ROTA_LABEL,
  });
}

export default function HomePager({ data, callbacks }: Props) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<PageKey>>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const lastCompleted = useHomeRouteStore((s) => s.lastCompleted);

  useFocusEffect(
    useCallback(() => {
      setPageIndex(0);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }, [])
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / width);
      setPageIndex(idx);
    },
    [width]
  );

  const onSelectPage = useCallback(
    (index: number) => {
      setPageIndex(index);
      listRef.current?.scrollToOffset({ offset: index * width, animated: true });
    },
    [width]
  );

  const renderItem: ListRenderItem<PageKey> = useCallback(
    ({ item }) => (
      <View style={{ width }}>
        {item === "proximo" ? (
          <HomeProximoPage data={data} navigation={callbacks} />
        ) : item === "hoje" ? (
          <HomeHojePage
            resumo={data.resumo}
            onPendentes={callbacks.onPendentes}
            onFinalizadas={callbacks.onFinalizadas}
            onAusentes={callbacks.onAusentes}
            onAtrasadas={callbacks.onAtrasadas}
          />
        ) : (
          <HomeAtalhosPage
            roteirizacaoHabilitada={data.roteirizacaoHabilitada}
            lastCompleted={lastCompleted}
            onMinhasEntregas={callbacks.onMinhasEntregas}
            onMapaPendentes={callbacks.onMapaPendentes}
            onHistoricoRotas={callbacks.onRouteHistory}
            onPreferencias={callbacks.onPreferencias}
            onVerResumoUltimaRota={() => {
              if (lastCompleted?.rotaId) void openRouteResumo(lastCompleted.rotaId);
            }}
          />
        )}
      </View>
    ),
    [width, data, callbacks, lastCompleted]
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(item) => item}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        keyboardShouldPersistTaps="handled"
      />
      <HomePageIndicator pageIndex={pageIndex} onSelectPage={onSelectPage} />
    </View>
  );
}

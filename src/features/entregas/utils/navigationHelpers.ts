import { CommonActions, StackActions } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

function getTabNavigator(navigation: NavigationProp<ParamListBase>) {
  let nav: NavigationProp<ParamListBase> | undefined = navigation;
  for (let i = 0; i < 4 && nav; i++) {
    const parent = nav.getParent?.();
    if (!parent) break;
    nav = parent as NavigationProp<ParamListBase>;
  }
  return nav;
}

function dispatchToEntregasList(navigation: NavigationProp<ParamListBase>): void {
  const state = navigation.getState?.();
  const routes = state?.routes ?? [];
  const routeNames = state?.routeNames ?? [];
  const hasListInStack = routes.some((r) => r.name === "EntregasList");
  const listRegistered = routeNames.includes("EntregasList");

  // Sempre a tela geral com abas (Pendentes | Ausentes | Finalizadas).
  if (hasListInStack) {
    navigation.dispatch(StackActions.popTo("EntregasList", { initialTab: "pendente" }));
    return;
  }

  if (listRegistered) {
    navigation.dispatch(StackActions.replace("EntregasList", { initialTab: "pendente" }));
    return;
  }

  // Detalhe aberto por outro stack (ex.: Mais): abre a lista no Home.
  const tabNav = getTabNavigator(navigation);
  if (tabNav?.navigate) {
    tabNav.navigate("Home", {
      screen: "EntregasList",
      params: { initialTab: "pendente" },
    });
    return;
  }

  if (navigation.canGoBack()) {
    navigation.goBack();
  }
}

/**
 * Após confirmar entrega/ausência: fecha o detalhe e vai para a lista geral
 * (Pendentes | Ausentes | Finalizadas), mesmo com sync ainda em andamento.
 */
export function navigateToEntregasPendentes(navigation: NavigationProp<ParamListBase>): void {
  // Modal nativo pode engolir navigate síncrono; próximo frame é mais confiável.
  requestAnimationFrame(() => {
    try {
      dispatchToEntregasList(navigation);
    } catch {
      if (navigation.canGoBack()) navigation.goBack();
    }
  });
}

/** Volta à Home (tab Home + stack HomeInicio). */
export function navigateToHomeInicio(navigation: NavigationProp<ParamListBase>): void {
  const tabNav = getTabNavigator(navigation);
  if (tabNav?.dispatch) {
    tabNav.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: "Home",
            state: {
              routes: [{ name: "HomeInicio" }],
            },
          },
        ],
      })
    );
    return;
  }
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "HomeInicio" }],
    })
  );
}

/** Abre Minhas Entregas (tab Mais) com período filtrado para hoje. */
export function navigateToMinhasEntregasHoje(navigation: NavigationProp<ParamListBase>): void {
  const tabNav = getTabNavigator(navigation);
  if (tabNav?.navigate) {
    tabNav.navigate("Mais", {
      screen: "MinhasEntregas",
      params: { presetPeriodoHoje: true },
    });
    return;
  }
  navigation.navigate("MinhasEntregas", { presetPeriodoHoje: true });
}

/** Abre Minhas Entregas (tab Mais). */
export function navigateToMinhasEntregas(navigation: NavigationProp<ParamListBase>): void {
  const tabNav = getTabNavigator(navigation);
  if (tabNav?.navigate) {
    tabNav.navigate("Mais", { screen: "MinhasEntregas" });
    return;
  }
  navigation.navigate("MinhasEntregas");
}

/** Abre Preferências (tab Mais). */
export function navigateToConfiguracoes(navigation: NavigationProp<ParamListBase>): void {
  const tabNav = getTabNavigator(navigation);
  if (tabNav?.navigate) {
    tabNav.navigate("Mais", { screen: "Configuracoes" });
    return;
  }
  navigation.navigate("Configuracoes");
}

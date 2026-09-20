import { CommonActions, StackActions } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useAuthStore } from "../../../store/authStore";
import { isMotoboyRole } from "../../../utils/role";

function isMotoboyNav(): boolean {
  return isMotoboyRole(useAuthStore.getState().currentUser?.role as number | undefined);
}

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
  if (isMotoboyNav()) {
    navigation.navigate("Tabs", {
      screen: "Entregas",
      params: { initialTab: "pendente" },
    });
    return;
  }

  const state = navigation.getState?.();
  const routes = state?.routes ?? [];
  const routeNames = state?.routeNames ?? [];
  const hasListInStack = routes.some((r) => r.name === "EntregasList");
  const listRegistered = routeNames.includes("EntregasList");

  if (hasListInStack) {
    navigation.dispatch(StackActions.popTo("EntregasList", { initialTab: "pendente" }));
    return;
  }

  if (listRegistered) {
    navigation.dispatch(StackActions.replace("EntregasList", { initialTab: "pendente" }));
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
  requestAnimationFrame(() => {
    try {
      dispatchToEntregasList(navigation);
    } catch {
      if (navigation.canGoBack()) navigation.goBack();
    }
  });
}

/** Volta à Home / Início. */
export function navigateToHomeInicio(navigation: NavigationProp<ParamListBase>): void {
  if (isMotoboyNav()) {
    navigation.navigate("Tabs", { screen: "Inicio" });
    return;
  }
  const tabNav = getTabNavigator(navigation);
  if (tabNav?.navigate) {
    tabNav.navigate("Inicio", { screen: "StaffInicio" });
    return;
  }
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Inicio" }],
    })
  );
}

/** Abre Minhas Entregas (extrato) com período filtrado para hoje. */
export function navigateToMinhasEntregasHoje(navigation: NavigationProp<ParamListBase>): void {
  if (isMotoboyNav()) {
    navigation.navigate("MinhasEntregas", { presetPeriodoHoje: true });
    return;
  }
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

/** Abre Minhas Entregas (extrato). */
export function navigateToMinhasEntregas(navigation: NavigationProp<ParamListBase>): void {
  if (isMotoboyNav()) {
    navigation.navigate("MinhasEntregas");
    return;
  }
  const tabNav = getTabNavigator(navigation);
  if (tabNav?.navigate) {
    tabNav.navigate("Mais", { screen: "MinhasEntregas" });
    return;
  }
  navigation.navigate("MinhasEntregas");
}

/** Abre Preferências. */
export function navigateToConfiguracoes(navigation: NavigationProp<ParamListBase>): void {
  if (isMotoboyNav()) {
    navigation.navigate("Configuracoes");
    return;
  }
  const tabNav = getTabNavigator(navigation);
  if (tabNav?.navigate) {
    tabNav.navigate("Mais", { screen: "Configuracoes" });
    return;
  }
  navigation.navigate("Configuracoes");
}

import { CommonActions } from "@react-navigation/native";
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

/** Abre lista de entregas na aba finalizadas com filtro somente hoje (stack Home). */
export function navigateToEntregasResumo(navigation: NavigationProp<ParamListBase>): void {
  const tabNav = getTabNavigator(navigation);
  if (tabNav?.dispatch) {
    tabNav.dispatch(
      CommonActions.navigate({
        name: "Home",
        params: {
          screen: "EntregasList",
          params: { initialTab: "finalizadas", somenteHoje: true },
        },
      })
    );
    return;
  }
  navigation.navigate("EntregasList" as never, {
    initialTab: "finalizadas",
    somenteHoje: true,
  } as never);
}

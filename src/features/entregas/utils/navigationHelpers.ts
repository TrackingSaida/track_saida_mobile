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

import NetInfo from "@react-native-community/netinfo";

export type NetworkState = {
  online: boolean;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

/** Considera offline se desconectado ou sem internet confirmada. */
export function resolveOnline(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export async function getNetworkState(): Promise<NetworkState> {
  const state = await NetInfo.fetch();
  return {
    online: resolveOnline(state),
    isConnected: state.isConnected ?? null,
    isInternetReachable: state.isInternetReachable ?? null,
  };
}

export async function isOnline(): Promise<boolean> {
  const { online } = await getNetworkState();
  return online;
}

export function subscribeNetworkStatus(onChange: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    onChange(resolveOnline(state));
  });
}

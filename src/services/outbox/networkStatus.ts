import NetInfo from "@react-native-community/netinfo";

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function subscribeNetworkStatus(onChange: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    const online =
      state.isConnected !== false && state.isInternetReachable !== false;
    onChange(online);
  });
}

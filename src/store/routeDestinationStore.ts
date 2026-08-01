import { create } from "zustand";
import type { MotoboyHomeAddress } from "../features/entregas/api";

export type RouteDestinationCoords = {
  latitude: number;
  longitude: number;
};

interface RouteDestinationState {
  /** Sessão: usuário escolheu roterizar com origem + destino. */
  useDestination: boolean;
  end: RouteDestinationCoords | null;
  address: MotoboyHomeAddress | null;
  addressLabel: string | null;
  setDestination: (payload: {
    end: RouteDestinationCoords;
    address: MotoboyHomeAddress;
    addressLabel: string;
  }) => void;
  clearDestination: () => void;
  disableDestinationMode: () => void;
}

export const useRouteDestinationStore = create<RouteDestinationState>((set) => ({
  useDestination: false,
  end: null,
  address: null,
  addressLabel: null,
  setDestination: ({ end, address, addressLabel }) =>
    set({
      useDestination: true,
      end,
      address,
      addressLabel,
    }),
  clearDestination: () =>
    set({
      useDestination: false,
      end: null,
      address: null,
      addressLabel: null,
    }),
  disableDestinationMode: () =>
    set({
      useDestination: false,
      end: null,
      address: null,
      addressLabel: null,
    }),
}));

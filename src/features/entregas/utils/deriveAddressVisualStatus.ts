import type { AddressFormValues } from "../components/AddressForm";
import { isValidGeocodeCoords, type GeocodeResult } from "./geocode";

export type AddressVisualStatus =
  | { kind: "none" }
  | { kind: "missing_number"; message: string }
  | { kind: "located"; message: string }
  | { kind: "not_located"; message: string }
  | { kind: "valid"; message: string }
  | { kind: "select_suggestion"; message: string };

export function deriveAddressVisualStatus(params: {
  freeText: string;
  vals: Partial<AddressFormValues>;
  selectedCoords: GeocodeResult | null;
  hasSelectedSuggestion: boolean;
  searching: boolean;
  resolvingPlace: boolean;
  suggestionCount: number;
  searchEmpty: boolean;
  hasDidYouMean: boolean;
}): AddressVisualStatus {
  const text = (params.freeText ?? "").trim();
  if (!text) return { kind: "none" };

  const rua = (params.vals.rua ?? "").trim();
  const bairro = (params.vals.bairro ?? "").trim();
  const numero = (params.vals.numero ?? "").trim();
  const cidade = (params.vals.cidade ?? "").trim();
  const estado = (params.vals.estado ?? "").trim();

  const hasCoords = isValidGeocodeCoords(
    params.selectedCoords?.latitude,
    params.selectedCoords?.longitude
  );

  if (hasCoords || params.hasSelectedSuggestion) {
    const loc =
      cidade && estado
        ? `${cidade}/${estado}`
        : cidade || estado || "mapa";
    return { kind: "located", message: `📍 ${loc} · Endereço localizado` };
  }

  if (params.searching || params.resolvingPlace) {
    return { kind: "none" };
  }

  const hasPendingSuggestions = params.suggestionCount > 0 || params.hasDidYouMean;
  if (hasPendingSuggestions) {
    return { kind: "select_suggestion", message: "Selecione o endereço abaixo" };
  }

  if (params.searchEmpty) {
    return { kind: "not_located", message: "⚠ Endereço não localizado" };
  }

  if ((rua || bairro) && !numero) {
    return { kind: "missing_number", message: "⚠ Falta número" };
  }

  if (rua && numero && bairro && cidade && estado) {
    return { kind: "valid", message: "✓ Endereço válido" };
  }

  return { kind: "none" };
}

import type { ImageSourcePropType } from "react-native";
import { servicoTipo, type ServicoTipo } from "./servico";

const LOGO_SHOPEE = require("../../../../assets/canais/shopee.png");
const LOGO_MERCADO_LIVRE = require("../../../../assets/canais/mercado-livre.png");

const LOGO_BY_SERVICO: Partial<Record<ServicoTipo, ImageSourcePropType>> = {
  Shopee: LOGO_SHOPEE,
  Flex: LOGO_MERCADO_LIVRE,
};

/** Logo oficial do canal; Avulso não tem logo. */
export function servicoCanalLogo(servico?: string | null): ImageSourcePropType | null {
  const tipo = servicoTipo(servico);
  return LOGO_BY_SERVICO[tipo] ?? null;
}

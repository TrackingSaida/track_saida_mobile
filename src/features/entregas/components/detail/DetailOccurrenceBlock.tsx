import React from "react";
import type { EntregaListItem } from "../../types";
import DetailInfoBlock, { DetailFieldRow } from "./DetailInfoBlock";
import { displayOrMuted, formatDetailDateTime } from "./detailFormatters";

type Props = {
  entrega: EntregaListItem;
};

export default function DetailOccurrenceBlock({ entrega }: Props) {
  const motivo = (entrega.motivo_ocorrencia ?? "").trim();
  const observacao = (entrega.observacao_ocorrencia ?? "").trim();
  const tentativa = entrega.tentativa ?? 1;
  const registrado =
    formatDetailDateTime(entrega.data_hora_ocorrencia) ??
    formatDetailDateTime(entrega.data_hora_entrega);

  return (
    <DetailInfoBlock title="Ocorrência" icon="warning-outline">
      <DetailFieldRow
        label="Motivo"
        value={displayOrMuted(motivo)}
        muted={!motivo}
      />
      <DetailFieldRow
        label="Observação"
        value={displayOrMuted(observacao)}
        muted={!observacao}
      />
      <DetailFieldRow label="Tentativa" value={String(tentativa)} />
      <DetailFieldRow
        label="Registrado às"
        value={registrado ?? "Não informado"}
        muted={!registrado}
      />
    </DetailInfoBlock>
  );
}

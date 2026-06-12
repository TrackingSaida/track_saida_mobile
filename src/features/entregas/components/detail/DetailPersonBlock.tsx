import React from "react";
import type { EntregaListItem } from "../../types";
import DetailInfoBlock, { DetailFieldRow } from "./DetailInfoBlock";
import { displayOrMuted } from "./detailFormatters";

type Props = {
  entrega: EntregaListItem;
  mode: "cliente" | "recebedor";
};

export default function DetailPersonBlock({ entrega, mode }: Props) {
  if (mode === "cliente") {
    const nome = (entrega.cliente ?? "").trim();
    return (
      <DetailInfoBlock title="Cliente" icon="person-outline">
        <DetailFieldRow label="Nome" value={displayOrMuted(nome, "—")} muted={!nome} />
      </DetailInfoBlock>
    );
  }

  const tipo = (entrega.tipo_recebedor ?? "").trim();
  const nome = (entrega.nome_recebedor ?? "").trim();
  const tipoDoc = (entrega.tipo_documento ?? "").trim();
  const numDoc = (entrega.numero_documento ?? "").trim();
  const documento =
    tipoDoc && numDoc ? `${tipoDoc} ${numDoc}` : tipoDoc || numDoc || "";

  return (
    <DetailInfoBlock title="Recebedor" icon="person-outline">
      <DetailFieldRow label="Tipo" value={displayOrMuted(tipo, "—")} muted={!tipo} />
      <DetailFieldRow label="Nome" value={displayOrMuted(nome, "—")} muted={!nome} />
      <DetailFieldRow
        label="Documento"
        value={displayOrMuted(documento, "—")}
        muted={!documento}
      />
    </DetailInfoBlock>
  );
}

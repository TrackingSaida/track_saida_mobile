import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

export interface AddressFormValues {
  destinatario: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

const initialEmpty: AddressFormValues = {
  destinatario: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
};

export type AddressOrigem = "manual" | "ocr" | "voz";

interface ViaCepResponse {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

async function fetchViaCep(cep: string): Promise<ViaCepResponse | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = (await res.json()) as ViaCepResponse;
    return data?.erro ? null : data;
  } catch {
    return null;
  }
}

interface AddressFormProps {
  idSaida: number;
  initialValues?: Partial<AddressFormValues>;
  origem: AddressOrigem;
  onSave: (values: AddressFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export default function AddressForm({
  idSaida,
  initialValues,
  origem,
  onSave,
  onCancel,
  submitLabel = "Salvar",
}: AddressFormProps) {
  const [values, setValues] = useState<AddressFormValues>(() => ({
    ...initialEmpty,
    ...initialValues,
  }));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = useCallback((field: keyof AddressFormValues, text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
  }, []);

  const blur = useCallback((field: keyof AddressFormValues) => {
    setTouched((t) => ({ ...t, [field]: true }));
    if (field === "cep") {
      const cep = values.cep.replace(/\D/g, "");
      if (cep.length === 8) {
        setLoadingCep(true);
        fetchViaCep(cep)
          .then((data) => {
            if (data) {
              setValues((v) => ({
                ...v,
                rua: data.logradouro ?? v.rua,
                bairro: data.bairro ?? v.bairro,
                cidade: data.localidade ?? v.cidade,
                estado: data.uf ?? v.estado,
              }));
            }
          })
          .finally(() => setLoadingCep(false));
      }
    }
  }, [values.cep]);

  const required = ["destinatario", "rua", "numero", "bairro", "cidade", "estado", "cep"];
  const getError = (field: keyof AddressFormValues): string | null => {
    if (!touched[field]) return null;
    const v = (values[field] || "").trim();
    if (required.includes(field) && !v) return "Obrigatório";
    if (field === "cep" && v.replace(/\D/g, "").length !== 8) return "CEP inválido";
    return null;
  };

  const handleSubmit = async () => {
    const allTouched = required.reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<string, boolean>);
    setTouched((t) => ({ ...t, ...allTouched }));
    const errs = required.map((f) => getError(f as keyof AddressFormValues));
    const dest = (values.destinatario || "").trim();
    const rua = (values.rua || "").trim();
    const num = (values.numero || "").trim();
    const bairro = (values.bairro || "").trim();
    const cidade = (values.cidade || "").trim();
    const estado = (values.estado || "").trim();
    const cep = (values.cep || "").replace(/\D/g, "");
    if (!dest || !rua || !num || !bairro || !cidade || !estado || cep.length !== 8) {
      return;
    }
    setSaving(true);
    try {
      await onSave({
        destinatario: dest,
        rua,
        numero: num,
        complemento: (values.complemento || "").trim() || "",
        bairro,
        cidade,
        estado,
        cep: cep,
      });
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof AddressFormValues; label: string; placeholder?: string; required?: boolean }[] = [
    { key: "destinatario", label: "Destinatário", required: true },
    { key: "rua", label: "Rua", required: true },
    { key: "numero", label: "Número", required: true },
    { key: "complemento", label: "Complemento" },
    { key: "bairro", label: "Bairro", required: true },
    { key: "cidade", label: "Cidade", required: true },
    { key: "estado", label: "Estado", required: true },
    { key: "cep", label: "CEP", required: true },
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {fields.map(({ key, label, placeholder, required: req }) => {
          const err = getError(key);
          return (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>
                {label}
                {req ? <Text style={styles.asterisk}> *</Text> : null}
              </Text>
              <TextInput
                style={[styles.input, err ? styles.inputError : null]}
                value={values[key]}
                onChangeText={(t) => set(key, t)}
                onBlur={() => blur(key)}
                placeholder={placeholder ?? label}
                editable={key !== "cep" || !loadingCep}
              />
              {key === "cep" && loadingCep && (
                <View style={styles.cepLoading}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.cepLoadingText}>Buscando CEP...</Text>
                </View>
              )}
              {err ? <Text style={styles.errorText}>{err}</Text> : null}
            </View>
          );
        })}
        <View style={styles.actions}>
          {onCancel && (
            <TouchableOpacity style={styles.btnCancel} onPress={onCancel} disabled={saving}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btnSave, saving && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnSaveText}>{submitLabel}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { flex: 1 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, color: "#333", marginBottom: 6 },
  asterisk: { color: "#dc3545" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  inputError: { borderColor: "#dc3545" },
  errorText: { fontSize: 12, color: "#dc3545", marginTop: 4 },
  cepLoading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  cepLoadingText: { fontSize: 12, color: "#666" },
  actions: { flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 24 },
  btnCancel: { paddingVertical: 12, paddingHorizontal: 20 },
  btnCancelText: { color: "#666", fontSize: 16 },
  btnSave: {
    flex: 1,
    backgroundColor: "#0d6efd",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnSaveText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});

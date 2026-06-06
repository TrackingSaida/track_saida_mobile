import React, { useState, useCallback, useMemo, useEffect } from "react";
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
import { useThemeColors } from "../../../theme/colors";

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

export type AddressOrigem =
  | "manual"
  | "ocr"
  | "voz"
  | "suggestion"
  | "autocomplete"
  | "mapa";

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

function formatCep(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d.replace(/(\d{5})/, "$1-");
  return d.replace(/(\d{5})(\d{0,3})/, "$1-$2");
}

function isAddressCompleteExceptDestinatario(v: Partial<AddressFormValues>): boolean {
  const rua = (v.rua ?? "").trim();
  const num = (v.numero ?? "").trim();
  const bairro = (v.bairro ?? "").trim();
  const cidade = (v.cidade ?? "").trim();
  const estado = (v.estado ?? "").trim();
  const cep = (v.cep ?? "").replace(/\D/g, "");
  const dest = (v.destinatario ?? "").trim();
  return rua.length > 0 && num.length > 0 && bairro.length > 0 && cidade.length > 0 && estado.length > 0 && cep.length === 8 && dest.length === 0;
}

export type AddressCandidate = Partial<AddressFormValues>;

interface AddressFormProps {
  idSaida: number;
  initialValues?: Partial<AddressFormValues>;
  origem: AddressOrigem;
  onSave: (values: AddressFormValues, origemOverride?: AddressOrigem) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  enableOnlyDestinatarioShortcut?: boolean;
  /** Exibe ícones OCR e Voz ao lado do campo no Step 1 (escolha no momento). */
  showOcrVozIcons?: boolean;
  /** Retorna candidato(s) de endereço; o formulário exibe lista para o usuário selecionar. */
  onRequestOcr?: () => Promise<AddressCandidate[] | AddressCandidate | null>;
  onRequestVoz?: () => Promise<AddressCandidate[] | AddressCandidate | null>;
}

const TOTAL_STEPS = 3;

function candidateSummary(c: AddressCandidate): string {
  const parts = [c.rua, c.numero, c.bairro, c.cidade, c.estado].filter(Boolean);
  return parts.join(", ") || "Endereço";
}

export default function AddressForm({
  idSaida,
  initialValues,
  origem,
  onSave,
  onCancel,
  submitLabel = "Salvar",
  enableOnlyDestinatarioShortcut,
  showOcrVozIcons,
  onRequestOcr,
  onRequestVoz,
}: AddressFormProps) {
  const colors = useThemeColors();
  const [values, setValues] = useState<AddressFormValues>(() => ({
    ...initialEmpty,
    ...initialValues,
  }));
  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cepNotFound, setCepNotFound] = useState(false);
  /** Candidatos de OCR/Voz para o usuário selecionar (Step 1). */
  const [addressCandidates, setAddressCandidates] = useState<AddressCandidate[] | null>(null);
  const [candidateOrigem, setCandidateOrigem] = useState<"ocr" | "voz" | null>(null);
  const [loadingOcrVoz, setLoadingOcrVoz] = useState(false);
  /** Origem usada no save (manual ou definida ao selecionar candidato OCR/voz). */
  const [saveOrigem, setSaveOrigem] = useState<AddressOrigem>(origem);

  const onlyDestinatarioMode = useMemo(
    () => enableOnlyDestinatarioShortcut !== false && isAddressCompleteExceptDestinatario(values),
    [enableOnlyDestinatarioShortcut, values]
  );

  const set = useCallback((field: keyof AddressFormValues, text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
  }, []);

  const fetchCep = useCallback(
    async (digits: string, options?: { autoAdvance?: boolean }) => {
      if (digits.length !== 8) return false;
      setLoadingCep(true);
      setCepNotFound(false);
      try {
        const data = await fetchViaCep(digits);
        if (data) {
          setValues((v) => ({
            ...v,
            rua: data.logradouro ?? v.rua,
            bairro: data.bairro ?? v.bairro,
            cidade: data.localidade ?? v.cidade,
            estado: data.uf ?? v.estado,
          }));
          if (options?.autoAdvance) {
            setStep(2);
          }
          return true;
        }
        setCepNotFound(true);
        return false;
      } finally {
        setLoadingCep(false);
      }
    },
    []
  );

  const blurCep = useCallback(() => {
    setTouched((t) => ({ ...t, cep: true }));
    const digits = values.cep.replace(/\D/g, "");
    void fetchCep(digits, { autoAdvance: false });
  }, [fetchCep, values.cep]);

  const required = ["destinatario", "rua", "numero", "bairro", "cidade", "estado", "cep"];
  const getError = (field: keyof AddressFormValues): string | null => {
    if (!touched[field]) return null;
    const v = (values[field] ?? "").trim();
    const vCep = (values.cep ?? "").replace(/\D/g, "");
    if (required.includes(field) && !v && field !== "cep") return "Obrigatório";
    if (field === "cep") {
      if (vCep.length !== 8) return "CEP inválido (8 dígitos)";
      if (cepNotFound) return "CEP não encontrado";
    }
    if (field === "numero" && !v) return "Obrigatório";
    if (field === "destinatario" && !v) return "Obrigatório";
    return null;
  };

  const step1Valid = (values.cep ?? "").replace(/\D/g, "").length === 8 && (values.rua ?? "").trim().length > 0;
  const step2Valid = (values.numero ?? "").trim().length > 0;

  const handleNext = useCallback(() => {
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2 && step2Valid) setStep(3);
  }, [step, step1Valid, step2Valid]);

  const handleSubmit = async () => {
    const dest = (values.destinatario || "").trim();
    const rua = (values.rua || "").trim();
    const num = (values.numero || "").trim();
    const bairro = (values.bairro || "").trim();
    const cidade = (values.cidade || "").trim();
    const estado = (values.estado || "").trim();
    const cep = (values.cep || "").replace(/\D/g, "");
    if (!dest || !rua || !num || !bairro || !cidade || !estado || cep.length !== 8) {
      setTouched((t) => ({ ...t, destinatario: true, rua: true, numero: true, bairro: true, cidade: true, estado: true, cep: true }));
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          destinatario: dest,
          rua,
          numero: num,
          complemento: (values.complemento || "").trim() || "",
          bairro,
          cidade,
          estado,
          cep,
        },
        saveOrigem
      );
    } finally {
      setSaving(false);
    }
  };

  const runOcr = useCallback(async () => {
    if (!onRequestOcr) return;
    setLoadingOcrVoz(true);
    try {
      const result = await onRequestOcr();
      if (result != null) {
        const list = Array.isArray(result) ? result : [result];
        setAddressCandidates(list);
        setCandidateOrigem("ocr");
      }
    } finally {
      setLoadingOcrVoz(false);
    }
  }, [onRequestOcr]);

  const runVoz = useCallback(async () => {
    if (!onRequestVoz) return;
    setLoadingOcrVoz(true);
    try {
      const result = await onRequestVoz();
      if (result != null) {
        const list = Array.isArray(result) ? result : [result];
        setAddressCandidates(list);
        setCandidateOrigem("voz");
      }
    } finally {
      setLoadingOcrVoz(false);
    }
  }, [onRequestVoz]);

  const selectCandidate = useCallback(
    (c: AddressCandidate) => {
      const merged: AddressFormValues = {
        ...initialEmpty,
        ...initialValues,
        destinatario: (c.destinatario ?? values.destinatario ?? initialValues?.destinatario ?? "").trim(),
        rua: (c.rua ?? "").trim(),
        numero: (c.numero ?? "").trim(),
        complemento: (c.complemento ?? "").trim(),
        bairro: (c.bairro ?? "").trim(),
        cidade: (c.cidade ?? "").trim(),
        estado: (c.estado ?? "").trim(),
        cep: (c.cep ?? "").replace(/\D/g, "").slice(0, 8),
      };
      if (merged.cep.length === 8) {
        const formatted = merged.cep.replace(/(\d{5})(\d{3})/, "$1-$2");
        merged.cep = formatted;
      }
      setValues(merged);
      setAddressCandidates(null);
      setCandidateOrigem(null);
      setSaveOrigem(candidateOrigem ?? "manual");
      const hasNumero = (merged.numero ?? "").trim().length > 0;
      setStep(hasNumero ? 3 : 2);
    },
    [initialValues, values.destinatario, candidateOrigem]
  );

  // Sempre que mudar de entrega (idSaida), resetar formulário e voltar ao passo 1
  useEffect(() => {
    setValues({
      ...initialEmpty,
      ...initialValues,
    });
    setStep(1);
    setTouched({});
    setCepNotFound(false);
    setAddressCandidates(null);
    setCandidateOrigem(null);
    setSaveOrigem(origem);
  }, [idSaida, initialValues, origem]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flex: 1 },
        scroll: { flex: 1 },
        stepBar: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
        stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.separator },
        stepDotActive: { backgroundColor: colors.primary },
        stepLine: { flex: 1, height: 2, backgroundColor: colors.separator, marginHorizontal: 4 },
        stepLineDone: { backgroundColor: colors.primary },
        stepLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
        field: { marginBottom: 16 },
        label: { fontSize: 14, color: colors.text, marginBottom: 6 },
        asterisk: { color: colors.danger },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 16,
          backgroundColor: colors.inputBackground,
          color: colors.text,
        },
        inputError: { borderColor: colors.danger },
        errorText: { fontSize: 12, color: colors.danger, marginTop: 4 },
        cepLoading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
        cepLoadingText: { fontSize: 12, color: colors.textSecondary },
        readOnlyRow: { marginBottom: 10 },
        readOnlyLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
        readOnlyValue: { fontSize: 15, color: colors.text },
        actions: { flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 24 },
        btnCancel: { paddingVertical: 12, paddingHorizontal: 20 },
        btnCancelText: { color: colors.textSecondary, fontSize: 16 },
        btnNext: {
          flex: 1,
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 8,
          alignItems: "center",
        },
        btnSave: {
          flex: 1,
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 8,
          alignItems: "center",
        },
        btnDisabled: { opacity: 0.7 },
        btnSaveText: { color: colors.primaryContrast, fontWeight: "600", fontSize: 16 },
        cepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        cepInputWrap: { flex: 1 },
        iconBtn: {
          width: 44,
          height: 44,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          justifyContent: "center",
          alignItems: "center",
        },
        candidateListTitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
        candidateItem: {
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          marginBottom: 8,
          backgroundColor: colors.backgroundCard,
        },
        candidateItemText: { fontSize: 15, color: colors.text },
      }),
    [colors]
  );

  if (onlyDestinatarioMode) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.stepLabel}>Falta apenas o destinatário.</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Destinatário <Text style={styles.asterisk}>*</Text></Text>
            <TextInput
              style={[styles.input, getError("destinatario") ? styles.inputError : null]}
              value={values.destinatario}
              onChangeText={(t) => set("destinatario", t)}
              onBlur={() => setTouched((t) => ({ ...t, destinatario: true }))}
              placeholder="Nome do destinatário"
              placeholderTextColor={colors.placeholder}
            />
            {getError("destinatario") ? <Text style={styles.errorText}>{getError("destinatario")}</Text> : null}
          </View>
          <View style={styles.actions}>
            {onCancel && (
              <TouchableOpacity style={styles.btnCancel} onPress={onCancel} disabled={saving}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.btnSave, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.primaryContrast} size="small" /> : <Text style={styles.btnSaveText}>{submitLabel}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.stepBar}>
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              {s > 1 && <View style={[styles.stepLine, s <= step ? styles.stepLineDone : null]} />}
              <View style={[styles.stepDot, s <= step ? styles.stepDotActive : null]} />
            </React.Fragment>
          ))}
        </View>
        <Text style={styles.stepLabel}>Passo {step} de {TOTAL_STEPS}</Text>

        {step === 1 && addressCandidates && addressCandidates.length > 0 && (
          <>
            <Text style={styles.candidateListTitle}>Selecione o endereço</Text>
            {addressCandidates.map((c, idx) => (
              <TouchableOpacity key={idx} style={styles.candidateItem} onPress={() => selectCandidate(c)} activeOpacity={0.7}>
                <Text style={styles.candidateItemText}>{candidateSummary(c)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.btnCancel, { marginTop: 12 }]} onPress={() => { setAddressCandidates(null); setCandidateOrigem(null); }}>
              <Text style={styles.btnCancelText}>Voltar</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 1 && !addressCandidates?.length && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>CEP ou endereço <Text style={styles.asterisk}>*</Text></Text>
              <View style={styles.cepRow}>
                <View style={styles.cepInputWrap}>
                  <TextInput
                    style={[styles.input, getError("cep") ? styles.inputError : null]}
                    value={values.cep}
                    onChangeText={(t) => {
                      setCepNotFound(false);
                      const formatted = formatCep(t);
                      set("cep", formatted);
                      const digits = formatted.replace(/\D/g, "");
                      if (digits.length === 8) {
                        setTouched((prev) => ({ ...prev, cep: true }));
                        void fetchCep(digits, { autoAdvance: true });
                      }
                    }}
                    onBlur={blurCep}
                    placeholder="00000-000 ou digite o CEP"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                    maxLength={9}
                    editable={!loadingCep}
                  />
                </View>
                {showOcrVozIcons && (
                  <>
                    <TouchableOpacity style={styles.iconBtn} onPress={runOcr} disabled={loadingOcrVoz}>
                      {loadingOcrVoz ? <ActivityIndicator size="small" /> : <Text style={{ fontSize: 18 }}>📷</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={runVoz} disabled={loadingOcrVoz}>
                      <Text style={{ fontSize: 18 }}>🎤</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              {loadingCep && (
                <View style={styles.cepLoading}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.cepLoadingText}>Buscando CEP...</Text>
                </View>
              )}
              {getError("cep") ? <Text style={styles.errorText}>{getError("cep")}</Text> : null}
            </View>
            <View style={styles.actions}>
              {onCancel && (
                <TouchableOpacity style={styles.btnCancel} onPress={onCancel}>
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.btnNext, !step1Valid && styles.btnDisabled]}
                onPress={handleNext}
                disabled={!step1Valid || loadingCep || loadingOcrVoz}
              >
                <Text style={styles.btnSaveText}>Próximo</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.readOnlyRow}>
              <Text style={styles.readOnlyLabel}>Rua</Text>
              <Text style={styles.readOnlyValue}>{values.rua || "—"}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Número <Text style={styles.asterisk}>*</Text></Text>
              <TextInput
                style={[styles.input, getError("numero") ? styles.inputError : null]}
                value={values.numero}
                onChangeText={(t) => set("numero", t)}
                onBlur={() => setTouched((t) => ({ ...t, numero: true }))}
                placeholder="Número"
                placeholderTextColor={colors.placeholder}
                keyboardType="numeric"
              />
              {getError("numero") ? <Text style={styles.errorText}>{getError("numero")}</Text> : null}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Complemento</Text>
              <TextInput
                style={styles.input}
                value={values.complemento}
                onChangeText={(t) => set("complemento", t)}
                placeholder="Apto, bloco, etc."
                placeholderTextColor={colors.placeholder}
              />
            </View>
            <View style={styles.readOnlyRow}>
              <Text style={styles.readOnlyLabel}>Bairro</Text>
              <Text style={styles.readOnlyValue}>{values.bairro || "—"}</Text>
            </View>
            <View style={styles.readOnlyRow}>
              <Text style={styles.readOnlyLabel}>Cidade / Estado</Text>
              <Text style={styles.readOnlyValue}>{[values.cidade, values.estado].filter(Boolean).join(" / ") || "—"}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setStep(1)}>
                <Text style={styles.btnCancelText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnNext, !step2Valid && styles.btnDisabled]}
                onPress={handleNext}
                disabled={!step2Valid}
              >
                <Text style={styles.btnSaveText}>Próximo</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Destinatário <Text style={styles.asterisk}>*</Text></Text>
              <TextInput
                style={[styles.input, getError("destinatario") ? styles.inputError : null]}
                value={values.destinatario}
                onChangeText={(t) => set("destinatario", t)}
                onBlur={() => setTouched((t) => ({ ...t, destinatario: true }))}
                placeholder="Nome do destinatário"
                placeholderTextColor={colors.placeholder}
              />
              {getError("destinatario") ? <Text style={styles.errorText}>{getError("destinatario")}</Text> : null}
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setStep(2)}>
                <Text style={styles.btnCancelText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSave, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.primaryContrast} size="small" /> : <Text style={styles.btnSaveText}>{submitLabel}</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

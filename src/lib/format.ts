const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPrice(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError("cents must be a non-negative safe integer");
  }
  return brl.format(cents / 100);
}

/**
 * Lê um preço digitado pelo lojista e devolve centavos inteiros, ou `null` se for inválido.
 * Aceita "79,90", "79.90", "R$ 79,90", "1.299,90" e "80". Zero é válido; negativo não.
 */
export function parseBrlToCents(text: string): number | null {
  const cleaned = text.replace(/R\$/gi, "").replace(/\s/g, "");
  if (cleaned === "" || !/^[\d.,]+$/.test(cleaned)) return null;

  let integerPart: string;
  let decimalPart = "";

  if (cleaned.includes(",")) {
    // Vírgula é o separador decimal; pontos só podem ser separadores de milhar.
    const parts = cleaned.split(",");
    if (parts.length !== 2) return null;
    integerPart = parts[0].replace(/\./g, "");
    decimalPart = parts[1];
    if (parts[0].includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(parts[0])) return null;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    integerPart = cleaned.replace(/\./g, ""); // "1.299" = mil duzentos e noventa e nove
  } else if (/^\d+\.\d{1,2}$/.test(cleaned)) {
    [integerPart, decimalPart] = cleaned.split("."); // "79.90"
  } else if (/^\d+$/.test(cleaned)) {
    integerPart = cleaned;
  } else {
    return null;
  }

  if (!/^\d+$/.test(integerPart) || !/^\d{0,2}$/.test(decimalPart)) return null;
  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Centavos em texto de campo ("7990" → "79,90"), sem símbolo de moeda. */
export function centsToInput(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError("cents must be a non-negative safe integer");
  }
  const reais = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return `${reais},${rest}`;
}

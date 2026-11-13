import type { AllowedImageType } from "./constants";

/**
 * Detecta o formato pelos primeiros bytes do arquivo. Não confia no MIME nem na extensão
 * enviados pelo cliente (SECURITY.md).
 */
export function detectImageType(head: Uint8Array): AllowedImageType | null {
  const startsWith = (signature: number[], offset = 0) =>
    head.length >= offset + signature.length && signature.every((byte, i) => head[offset + i] === byte);

  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP: "RIFF" .... "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

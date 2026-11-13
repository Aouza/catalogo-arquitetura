// Limites de fotos (OQ-13) e bucket. Os mesmos valores são impostos pelo banco e pelo bucket.
export const PRODUCT_IMAGES_BUCKET = "product-images";
export const MAX_IMAGES_PER_PRODUCT = 10;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ALT_TEXT_LENGTH = 200;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const IMAGE_EXTENSIONS: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Validade das URLs assinadas usadas na pré-visualização do admin. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Arquivos órfãos mais novos que isto não são limpos (podem estar sendo enviados agora). */
export const ORPHAN_GRACE_MS = 10 * 60 * 1000;

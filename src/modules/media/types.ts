export type ProductImage = {
  id: string;
  productId: string;
  /** Valor de opção (ex.: a cor) a que a foto pertence; `null` = foto geral. */
  optionValueId: string | null;
  storagePath: string;
  altText: string;
  position: number;
};

export type ProductImageRow = {
  id: string;
  product_id: string;
  option_value_id: string | null;
  storage_path: string;
  alt_text: string;
  position: number;
};

export function toProductImage(row: ProductImageRow): ProductImage {
  return {
    id: row.id,
    productId: row.product_id,
    optionValueId: row.option_value_id,
    storagePath: row.storage_path,
    altText: row.alt_text,
    position: row.position,
  };
}

export const PRODUCT_IMAGE_COLUMNS = "id, product_id, option_value_id, storage_path, alt_text, position";

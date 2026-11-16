import { formatPrice } from "@/lib/format";

export function PriceDisplay({
  cents,
  from = false,
  className = "",
}: {
  cents: number;
  /** Mostra "A partir de" antes do valor (preços diferentes entre as combinações). */
  from?: boolean;
  className?: string;
}) {
  return (
    <span className={`tabular-nums ${className}`}>
      {from ? <span className="font-normal text-fg-muted">A partir de </span> : null}
      {formatPrice(cents)}
    </span>
  );
}

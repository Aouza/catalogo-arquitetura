import { formatPrice } from "@/lib/format";

export function PriceDisplay({ cents, className = "" }: { cents: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatPrice(cents)}</span>;
}

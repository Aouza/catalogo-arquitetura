export function ImagePlaceholder({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`h-full w-full bg-surface-subtle ${className}`} />;
}

import type { Flash } from "@/modules/products/flash";

/** Aviso ou erro mostrado depois de uma ação (vem de códigos conhecidos na URL). */
export function FlashBanner({ flash }: { flash: Flash }) {
  if (!flash) return null;
  const isError = flash.kind === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`rounded-card border p-4 text-body ${
        isError ? "border-accent-strong bg-surface text-accent-strong" : "border-action bg-surface-subtle text-fg"
      }`}
    >
      {flash.message}
    </p>
  );
}

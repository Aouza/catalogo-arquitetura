"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { registerImageAction } from "@/app/admin/produtos/actions";
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_EXTENSIONS,
  MAX_IMAGE_BYTES,
  PRODUCT_IMAGES_BUCKET,
} from "@/modules/media/constants";
import { detectImageType } from "@/modules/media/file-type";

type FileStatus = { id: number; name: string; state: "uploading" | "done" | "error"; message?: string };

const field =
  "min-h-12 w-full rounded-control border border-border-strong bg-surface px-4 text-body text-fg";

/**
 * Envia as fotos direto do navegador para o Storage (o arquivo não passa pelo servidor, o que evita
 * o limite de corpo de requisição das hospedagens) e depois registra cada uma no produto.
 * O servidor confere o arquivo de novo antes de aceitar.
 */
export function PhotoUploader({
  productId,
  colors,
  remainingSlots,
}: {
  productId: string;
  colors: { id: string; label: string }[];
  remainingSlots: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState("");
  const [statuses, setStatuses] = useState<FileStatus[]>([]);
  const [busy, setBusy] = useState(false);

  const update = (id: number, patch: Partial<FileStatus>) =>
    setStatuses((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    const startId = Date.now();
    setStatuses(files.map((file, index) => ({ id: startId + index, name: file.name, state: "uploading" })));

    const supabase = createBrowserSupabase();
    let accepted = 0;

    for (const [index, file] of files.entries()) {
      const id = startId + index;

      if (accepted >= remainingSlots) {
        update(id, { state: "error", message: "Limite de 10 fotos por produto." });
        continue;
      }
      if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
        update(id, { state: "error", message: file.size === 0 ? "O arquivo está vazio." : "A foto deve ter no máximo 5 MB." });
        continue;
      }

      const type = detectImageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
      if (!type || !ALLOWED_IMAGE_TYPES.includes(type)) {
        update(id, { state: "error", message: "Formato não aceito. Envie JPG, PNG ou WebP." });
        continue;
      }

      // Nome aleatório com a extensão do formato real (nunca o nome do arquivo do usuário).
      const path = `${productId}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[type]}`;
      const upload = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(path, file, { contentType: type, cacheControl: "31536000", upsert: false });
      if (upload.error) {
        update(id, { state: "error", message: "Não foi possível enviar esta foto. Tente de novo." });
        continue;
      }

      let outcome;
      try {
        outcome = await registerImageAction({ productId, path, altText: "", optionValueId: target || null });
      } catch {
        outcome = { ok: false as const, message: "Não foi possível salvar esta foto. Tente de novo." };
      }

      if (outcome.ok) {
        accepted += 1;
        update(id, { state: "done" });
      } else {
        update(id, { state: "error", message: outcome.message });
      }
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  if (remainingSlots <= 0) {
    return (
      <p role="status" className="rounded-card border border-border bg-surface-subtle p-4 text-body text-fg">
        Você chegou ao limite de 10 fotos. Exclua uma para enviar outra.
      </p>
    );
  }

  return (
    <section aria-labelledby="upload-title" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
      <div>
        <h2 id="upload-title" className="font-heading text-h2 font-bold text-fg">
          Enviar fotos
        </h2>
        <p className="text-label text-fg-muted">
          JPG, PNG ou WebP, até 5 MB cada. Você ainda pode enviar {remainingSlots}{" "}
          {remainingSlots === 1 ? "foto" : "fotos"}.
        </p>
      </div>

      {colors.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="photo-target" className="text-label font-semibold text-fg">
            Estas fotos são de qual cor?
          </label>
          <select
            id="photo-target"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            disabled={busy}
            className={field}
          >
            <option value="">Todas as cores (foto geral)</option>
            {colors.map((color) => (
              <option key={color.id} value={color.id}>
                {color.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="photo-files" className="text-label font-semibold text-fg">
          Escolher fotos
        </label>
        <input
          id="photo-files"
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => void handleFiles(Array.from(event.target.files ?? []))}
          className={`${field} py-3`}
        />
      </div>

      {statuses.length > 0 ? (
        <ul aria-live="polite" className="flex flex-col gap-1 text-label">
          {statuses.map((item) => (
            <li key={item.id} className={item.state === "error" ? "text-accent-strong" : "text-fg"}>
              <span className="font-semibold">{item.name}</span>:{" "}
              {item.state === "uploading" ? "enviando…" : item.state === "done" ? "enviada." : item.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

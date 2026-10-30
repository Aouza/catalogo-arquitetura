"use client";

import Link from "next/link";
import { useRef } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { routes } from "@/lib/routes";
import type { CategoryView } from "@/modules/catalogs/types";

export function CategoryDrawer({ storeSlug, categories }: { storeSlug: string; categories: CategoryView[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu de categorias"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className="grid size-11 place-items-center text-fg lg:hidden"
      >
        <MenuIcon />
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Categorias"
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-surface p-0 text-fg backdrop:bg-fg/40"
      >
        <div className="flex items-center justify-between p-4">
          <span className="font-heading text-h2 font-semibold">Categorias</span>
          <button type="button" aria-label="Fechar menu" onClick={close} className="grid size-11 place-items-center">
            <CloseIcon />
          </button>
        </div>
        <ul>
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={routes.category(storeSlug, category.slug)}
                onClick={close}
                className="block px-4 py-3 text-body text-fg"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}

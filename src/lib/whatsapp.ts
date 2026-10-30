const E164 = /^\+?[1-9]\d{7,14}$/;

export function whatsappLink(value?: string | null): string | null {
  if (!value || !E164.test(value)) return null;
  return `https://wa.me/${value.replace("+", "")}`;
}

const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

export function instagramUrl(handle: string): string | null {
  const name = handle.trim().replace(/^@/, "");
  return INSTAGRAM_HANDLE.test(name) ? `https://instagram.com/${name}` : null;
}

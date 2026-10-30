const E164 = /^\+?[1-9]\d{7,14}$/;

export function whatsappLink(value?: string | null): string | null {
  if (!value || !E164.test(value)) return null;
  return `https://wa.me/${value.replace("+", "")}`;
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle.trim().replace(/^@/, "")}`;
}

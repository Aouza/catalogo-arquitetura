import Link from "next/link";

type Props = {
  href: string;
  variant?: "primary" | "secondary";
  external?: boolean;
  className?: string;
  children: React.ReactNode;
};

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-label font-semibold transition-colors";
const variants = {
  primary: "bg-action text-white hover:bg-action-hover",
  secondary: "border border-border-strong bg-surface text-fg hover:border-action",
};

export function ButtonLink({ href, variant = "secondary", external, className = "", children }: Props) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>;
  }
  return <Link href={href} className={cls}>{children}</Link>;
}

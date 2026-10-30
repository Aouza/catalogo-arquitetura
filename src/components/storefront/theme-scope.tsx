import { themeToStyle } from "@/modules/catalogs/theme/theme-to-style";
import type { CatalogTheme } from "@/modules/catalogs/theme/tokens";

export function ThemeScope({ theme, children }: { theme: CatalogTheme; children: React.ReactNode }) {
  return (
    <div style={themeToStyle(theme)} className="flex min-h-dvh flex-col bg-bg font-sans text-fg">
      {children}
    </div>
  );
}

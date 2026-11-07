import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * Troca entre claro e escuro com um clique. Segue a preferência salva no
 * aparelho; quando o painel desativa o modo escuro, o site volta ao claro.
 */
export default function ThemeToggle({ enabled = true }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!enabled && theme === "dark") setTheme("light");
  }, [enabled, theme, setTheme]);

  if (!enabled) return null;

  const dark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={dark ? "Modo claro" : "Modo escuro"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 text-ink-foreground/80 transition hover:border-gold hover:text-gold"
    >
      {dark ? <Sun className="h-5 w-5" strokeWidth={1.4} /> : <Moon className="h-5 w-5" strokeWidth={1.4} />}
    </button>
  );
}
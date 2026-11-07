import { Clock, CreditCard, Lock, Store } from "lucide-react";
import { useSettings } from "@/lib/store";
import { useSiteContent } from "@/hooks/use-site-content";
import { fillVars } from "@/lib/site-content";

const ICONS = [Clock, Store, CreditCard, Lock];

export default function TrustBar() {
  const { settings } = useSettings();
  const { content } = useSiteContent();
  const vars = {
    dias: Number(settings?.production_days) || 3,
    retencao: Number(settings?.retention_days) || 90,
  };

  const items = [1, 2, 3, 4].map((index) => ({
    icon: ICONS[index - 1],
    title: fillVars(content[`home.trust${index}.title`], vars),
    text: fillVars(content[`home.trust${index}.text`], vars),
  }));

  return (
    <section className="relative py-8">
      <div className="glass container-x grid gap-6 rounded-[1.5rem] px-6 py-7 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full border border-gold/40 bg-gold-soft/70 text-[hsl(var(--gold-deep))]">
              <item.icon className="h-4 w-4" strokeWidth={1.6} />
            </span>
            <div>
              <p className="text-sm font-medium leading-tight">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
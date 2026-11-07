import { Sparkles, ShieldCheck, Truck, Heart } from "lucide-react";
import { useSiteContent } from "@/hooks/use-site-content";

const ICONS = [Sparkles, ShieldCheck, Truck, Heart];

export default function Advantages() {
  const { content } = useSiteContent();
  const items = [1, 2, 3, 4].map((index) => ({
    icon: ICONS[index - 1],
    title: content[`home.advantages.${index}.title`],
    text: content[`home.advantages.${index}.text`],
  }));

  return (
    <section className="border-y border-border/70 bg-card py-20">
      <div className="container-x grid gap-12 md:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="eyebrow">{content["home.advantages.eyebrow"]}</p>
          <h2 className="mt-3 text-4xl leading-tight">{content["home.advantages.title"]}</h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.title}>
              <item.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
              <h3 className="mt-4 text-lg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
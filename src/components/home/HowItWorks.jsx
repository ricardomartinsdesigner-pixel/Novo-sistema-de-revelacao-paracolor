import { Upload, Crop, ShoppingBag, Store } from "lucide-react";
import { useSiteContent } from "@/hooks/use-site-content";

const ICONS = [Upload, Crop, ShoppingBag, Store];

export default function HowItWorks() {
  const { content } = useSiteContent();
  const steps = [1, 2, 3, 4].map((index) => ({
    icon: ICONS[index - 1],
    title: content[`home.steps.${index}.title`],
    text: content[`home.steps.${index}.text`],
  }));

  return (
    <section className="py-20">
      <div className="container-x">
        <div className="max-w-xl">
          <p className="eyebrow">{content["home.steps.eyebrow"]}</p>
          <h2 className="mt-3 text-4xl leading-tight">{content["home.steps.title"]}</h2>
        </div>
        <div className="elev-2 mt-12 grid gap-px overflow-hidden rounded-[var(--radius)] border border-border/80 bg-border/70 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="bg-card p-7">
              <div className="flex items-center justify-between">
                <step.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <span className="font-display text-2xl text-muted-foreground/60">0{index + 1}</span>
              </div>
              <h3 className="mt-6 text-lg">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
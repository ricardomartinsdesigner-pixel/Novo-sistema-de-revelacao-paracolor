import { Quote } from "lucide-react";
import { useEntityList } from "@/lib/store";
import { useSiteContent } from "@/hooks/use-site-content";

export default function Testimonials() {
  const { content } = useSiteContent();
  const { data: testimonials = [] } = useEntityList("Testimonial", { active: true }, { sort: "sort", limit: 6 });

  if (!testimonials.length) return null;

  return (
    <section className="border-t border-border/70 py-20">
      <div className="container-x">
        <div className="max-w-lg">
          <p className="eyebrow">{content["home.testimonials.eyebrow"]}</p>
          <h2 className="mt-3 text-4xl leading-tight">{content["home.testimonials.title"]}</h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((item) => (
            <figure key={item.id} className="card-hover elev-1 rounded-[1.25rem] border border-border/80 bg-card p-6">
              <Quote className="h-5 w-5 text-primary/60" strokeWidth={1.5} />
              <blockquote className="mt-4 text-sm leading-relaxed text-foreground/90">{item.text}</blockquote>
              <figcaption className="mt-5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{item.name}</span>
                {item.city ? ` · ${item.city}` : ""}
                {Number(item.rating) > 0 ? ` · ${"★".repeat(Math.min(5, Number(item.rating)))}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSiteContent } from "@/hooks/use-site-content";

export default function Faq() {
  const { content } = useSiteContent();
  const items = [1, 2, 3, 4, 5, 6].map((index) => ({
    q: content[`home.faq.${index}.q`],
    a: content[`home.faq.${index}.a`],
  }));

  return (
    <section className="band-gold border-t border-border/70 py-20">
      <div className="container-x grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">{content["home.faq.eyebrow"]}</p>
          <h2 className="mt-3 text-4xl leading-tight">{content["home.faq.title"]}</h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{content["home.faq.text"]}</p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {items.map((item, index) => (
            <AccordionItem key={index} value={`item-${index}`} className="border-border/70">
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
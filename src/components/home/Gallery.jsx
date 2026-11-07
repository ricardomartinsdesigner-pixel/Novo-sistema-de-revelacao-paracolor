import { useEntityList } from "@/lib/store";
import { Image } from "@/components/ui/image";
import { useSiteContent } from "@/hooks/use-site-content";

// Prova social: fotos reais enviadas por clientes. Se o administrador ainda não
// cadastrou nenhuma, a seção não aparece no site.
export default function Gallery() {
  const { data: items = [] } = useEntityList("GalleryItem", { active: true }, { sort: "sort", limit: 12 });
  const { content } = useSiteContent();
  if (!items.length) return null;

  return (
    <section className="container-x py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{content["home.gallery.eyebrow"]}</p>
          <h2 className="mt-2 text-3xl">{content["home.gallery.title"]}</h2>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">{content["home.gallery.text"]}</p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <figure key={item.id} className="card-hover elev-1 overflow-hidden rounded-[1.25rem] border border-border bg-card">
            <Image
              src={item.image_url}
              alt={item.caption || item.customer_name || "Foto impressa por cliente"}
              className="aspect-square w-full object-cover"
              fittingType="fill"
            />
            {item.caption || item.customer_name ? (
              <figcaption className="px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                {item.caption}
                {item.customer_name ? <span className="mt-0.5 block font-medium text-foreground">{item.customer_name}</span> : null}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
import { useState } from "react";
import { Image } from "@/components/ui/image";
import StudioLightbox from "@/components/studio/StudioLightbox";

/** Uma galeria do estúdio: molduras douradas em grade que abrem a foto ampliada. */
export default function StudioGallerySection({ gallery, photos }) {
  const [index, setIndex] = useState(null);
  if (!photos.length) return null;

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-display text-[26px] uppercase leading-[1.1] text-cream sm:text-[32px]">
          {gallery.title}
        </h3>
        <span className="font-body text-xs text-gold-warm">{photos.length} foto(s)</span>
      </div>
      {gallery.description ? (
        <p className="mt-2 max-w-[520px] font-body text-sm leading-[1.6] text-cream/75">
          {gallery.description}
        </p>
      ) : null}

      <ul className="mt-5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, position) => (
          <li key={photo.id} className="border border-gold-warm bg-night p-[5px]">
            <button
              type="button"
              onClick={() => setIndex(position)}
              className="group block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-night"
              aria-label={`Ampliar foto ${position + 1}${photo.alt ? ` — ${photo.alt}` : ""}`}
            >
              <Image
                src={photo.image_url}
                alt={photo.alt || `Foto de ensaio do estúdio — ${gallery.title}`}
                className="aspect-[4/5] w-full brightness-[.9] transition-[transform,filter] [transition-duration:600ms] group-hover:brightness-[1.05]"
                fittingType="fill"
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>

      <StudioLightbox photos={photos} index={index} onChange={setIndex} onClose={() => setIndex(null)} />
    </section>
  );
}
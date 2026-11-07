import { createFileRoute } from "@tanstack/react-router";
import { buildZip } from "@/lib/zip.server";
import { orderLabel, pad, photoFolder, photoPrefix, sizeLabel } from "@/lib/order-paths";

const AREAS = ["revelacao", "polaroid", "banner", "personalizado", "moldura"];

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .toUpperCase();
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer());
}

function resolveFilter(only) {
  if (only === "originais") return { originals: true, prints: false, areas: null };
  if (only === "impressao") return { originals: false, prints: true, areas: null };
  if (only === "polaroids") return { originals: false, prints: true, areas: ["polaroid"] };
  if (AREAS.includes(only)) return { originals: false, prints: true, areas: [only] };
  return { originals: true, prints: true, areas: null };
}

export const Route = createFileRoute("/api/order-zip")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        const url = new URL(request.url);
        const orderId = url.searchParams.get("orderId");
        const token = url.searchParams.get("token");
        const only = url.searchParams.get("only") || "all";
        const size = url.searchParams.get("size") || "";
        if (!orderId || !token) return new Response("Link inválido", { status: 400 });

        const role = context.getBase44().asServiceRole;
        let order;
        try {
          order = await role.entities.Order.get(orderId);
        } catch {
          return new Response("Pedido não encontrado", { status: 404 });
        }

        const valid =
          order.download_token &&
          order.download_token === token &&
          order.download_token_expires &&
          new Date(order.download_token_expires).getTime() > Date.now();
        if (!valid) return new Response("Link expirado. Gere novamente no painel.", { status: 403 });

        const items = (await role.entities.OrderItem.filter({ order_id: orderId }, { limit: 100 })).items ?? [];
        let photos = (await role.entities.OrderPhoto.filter({ order_id: orderId }, { limit: 500 })).items ?? [];

        const filter = resolveFilter(size ? "impressao" : only);
        if (size) photos = photos.filter((photo) => sizeLabel(photo) === size);
        if (filter.areas) photos = photos.filter((photo) => filter.areas.includes(photo.area));

        const root = slug(orderLabel(order) || `PEDIDO_${order.id}`);
        const files = [];

        const originalPhotos = filter.originals ? photos.filter((photo) => photo.original_file_uri) : [];
        const counters = new Map();
        const printPlan = (filter.prints ? photos.filter((photo) => photo.print_file_uri) : []).map((photo) => {
          const folder = photoFolder(photo);
          const next = (counters.get(folder) || 0) + 1;
          counters.set(folder, next);
          const ext = /\.pdf$/i.test(photo.print_name || "") ? "pdf" : "jpg";
          return { photo, folder, fileName: `${root}_${photoPrefix(photo)}_${pad(next)}.${ext}` };
        });

        for (let index = 0; index < originalPhotos.length; index += 1) {
          const photo = originalPhotos[index];
          const signed = await role.integrations.Core.CreateFileSignedUrl({ file_uri: photo.original_file_uri });
          const bytes = await fetchBytes(signed.signed_url);
          if (!bytes) {
            return new Response(`Não foi possível incluir o original ${photo.filename || ""}. Tente novamente.`, {
              status: 502,
            });
          }
          const ext = (photo.original_file_uri.split(".").pop() || "jpg").split("?")[0].slice(0, 5);
          files.push({ name: `${root}/Fotos_Originais/${root}_ORIGINAL_${pad(index + 1)}.${ext}`, data: bytes });
        }

        for (const entry of printPlan) {
          const signed = await role.integrations.Core.CreateFileSignedUrl({ file_uri: entry.photo.print_file_uri });
          const bytes = await fetchBytes(signed.signed_url);
          if (!bytes) {
            return new Response(`Não foi possível incluir a foto ${entry.photo.filename || entry.fileName}. Tente novamente.`, {
              status: 502,
            });
          }
          files.push({ name: `${root}/${entry.folder}/${entry.fileName}`, data: bytes });
        }

        const includeArt = (filter.originals || filter.prints) && !size;
        for (const [index, item] of items.entries()) {
          const options = item.options || {};
          if (options.art_file_uri && includeArt) {
            const signed = await role.integrations.Core.CreateFileSignedUrl({ file_uri: options.art_file_uri });
            const bytes = await fetchBytes(signed.signed_url);
            if (!bytes) return new Response("Não foi possível incluir a arte. Tente novamente.", { status: 502 });
            const extension = (options.art_original_name || "arte.jpg").split(".").pop().replace(/[^a-zA-Z0-9]/g, "").slice(0, 6) || "jpg";
            files.push({ name: `${root}/Banners/ITEM_${index + 1}_ARTE.${extension}`, data: bytes });
          }
        }

        const zip = buildZip(files);
        return new Response(zip, {
          headers: {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="${root}.zip"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
import { canAccessOrder, verifyOrderDownload } from "@/lib/order-download.server";
import { createFileRoute } from "@tanstack/react-router";
import { Readable } from "node:stream";
import yazl from "yazl";
import { listOrderPhotos } from "@/lib/photo-order";
import { orderProductEntries } from "@/lib/order-product-archive";
import { orderArchiveFiles } from "@/lib/vps/files.server";
import { orderLabel, photoFolder, photoPrefix, sizeLabel } from "@/lib/order-paths";

const AREAS = ["revelacao", "polaroid", "magnet", "banner", "personalizado", "moldura"];

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .toUpperCase();
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

        if (!verifyOrderDownload(context.user, orderId, only, size, url.searchParams.get("expires"), token)) {
          return new Response("Link inválido ou expirado. Gere outro no pedido.", { status: 403 });
        }

        const role = context.getBase44().asServiceRole;
        let order;
        try {
          order = await role.entities.Order.get(orderId);
        } catch {
          return new Response("Pedido não encontrado", { status: 404 });
        }

        if (!canAccessOrder(context.user, order)) return new Response("Sem acesso ao pedido.", { status: 403 });

        const [items, allPhotos] = await Promise.all([
          role.entities.OrderItem.filter({ order_id: orderId }, { sort: "created_date", limit: 100 }).then((result) => result.items ?? []),
          listOrderPhotos(role.entities, orderId),
        ]);
        const filter = resolveFilter(size ? "impressao" : only);
        const digits = allPhotos.length >= 1000 ? 4 : 3;
        const photos = allPhotos.map((photo, index) => ({
          photo, position: String(index + 1).padStart(digits, "0"),
        })).filter(({ photo }) =>
          (!size || sizeLabel(photo) === size) && (!filter.areas || filter.areas.includes(photo.area))
        );

        const root = slug(orderLabel(order) || `PEDIDO_${order.id}`);
        const entries = [];
        for (const { photo, position } of photos) {
          if (photo.area === "personalizado") continue;
          if (filter.originals && photo.original_file_uri) {
            entries.push({ uri: photo.original_file_uri, name: `${root}/Fotos_Originais/${root}_ORIGINAL_${position}`, fallback: "jpg" });
          }
          if (filter.prints && photo.print_file_uri) {
            entries.push({ uri: photo.print_file_uri, name: `${root}/${photoFolder(photo)}/${root}_${photoPrefix(photo)}_${position}`, fallback: /\.pdf$/i.test(photo.print_name || "") ? "pdf" : "jpg" });
          }
        }
        if (!size) {
          for (const entry of orderProductEntries(items, photos, filter)) {
            entries.push({ ...entry, name: `${root}/${entry.name}` });
          }
        }

        let files;
        try {
          files = await orderArchiveFiles(entries.flatMap((entry) => entry.uri ? [entry.uri] : []), order.created_by_id);
        } catch (error) {
          if (error.status === 403) return new Response("O pedido contém arquivos não autorizados ou indisponíveis.", { status: 403 });
          return new Response("Há arquivos indisponíveis neste pedido. Confira os arquivos e tente novamente.", { status: 502 });
        }
        const zip = new yazl.ZipFile();
        zip.on("error", (error) => zip.outputStream.destroy(error));
        for (const entry of entries) {
          if (entry.uri) {
            const file = files.get(entry.uri);
            zip.addFile(file.filename, `${entry.name}.${file.extension || entry.fallback}`, { compress: false });
          } else if (entry.text !== undefined) {
            zip.addBuffer(Buffer.from(entry.text, "utf8"), entry.name);
          } else {
            zip.addEmptyDirectory(entry.name);
          }
        }
        const stream = Readable.toWeb(zip.outputStream);
        zip.end();
        return new Response(stream, {
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

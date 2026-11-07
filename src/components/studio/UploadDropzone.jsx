import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { PHOTO_ACCEPT } from "@/lib/upload-formats";

export default function UploadDropzone({ onFiles, uploading }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length) onFiles(files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-[1.25rem] border-2 border-dashed p-10 text-center transition ${
        dragging ? "border-primary bg-accent/60" : "border-gold/60 bg-gold-soft/25 hover:border-gold"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={`${PHOTO_ACCEPT},application/pdf,.pdf`}
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          if (files.length) onFiles(files);
          event.target.value = "";
        }}
      />
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" strokeWidth={1.5} />}
      </div>
      <p className="mt-4 font-display text-2xl">Arraste suas fotos aqui</p>
      <p className="mt-1 text-sm text-foreground/75">
        JPG, PNG, WEBP, AVIF, HEIC do iPhone ou PDF · até 1.000 arquivos por pedido
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        Escolher fotos
      </button>
      <p className="mt-4 text-xs text-foreground/70">
        Suas fotos são guardadas em armazenamento privado e usadas apenas na produção do pedido.
      </p>
    </div>
  );
}
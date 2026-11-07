// Extrai o ID de um vídeo do YouTube de qualquer formato de link colado no painel:
// watch?v=, youtu.be/, /embed/, /shorts/ ou o próprio ID.
export function youtubeId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const patterns = [
    /youtube\.com\/watch\?[^#]*\bv=([\w-]{11})/i,
    /youtu\.be\/([\w-]{11})/i,
    /youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[1];
  }
  return /^[\w-]{11}$/.test(raw) ? raw : "";
}

// Player embutido em loop infinito. O autoplay dos navegadores exige o vídeo mudo;
// o parâmetro playlist repetindo o próprio ID é o que faz o loop funcionar.
export function youtubeEmbedUrl(input) {
  const id = youtubeId(input);
  if (!id) return "";
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: id,
    controls: "1",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
  });
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}
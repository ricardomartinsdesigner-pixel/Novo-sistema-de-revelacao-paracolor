export const ORDER_SOUND_STYLES = [
  { value: "bip_curto", label: "Bip curto", description: "Um aviso rápido e discreto." },
  { value: "bip_duplo", label: "Bip duplo", description: "Dois bips para chamar mais atenção." },
  { value: "crescente", label: "Tom crescente", description: "Três notas que sobem de tom." },
  { value: "campainha", label: "Campainha suave", description: "Duas notas mais suaves e longas." },
];

const PATTERNS = {
  bip_curto: { notes: [740], duration: 0.19, gap: 0.1, volume: 0.19 },
  bip_duplo: { notes: [740, 740], duration: 0.13, gap: 0.12, volume: 0.2 },
  crescente: { notes: [590, 760, 960], duration: 0.14, gap: 0.08, volume: 0.2 },
  campainha: { notes: [660, 880], duration: 0.24, gap: 0.1, volume: 0.13 },
};

export function createOrderAlertAudio() {
  if (typeof window === "undefined") return null;
  const Audio = window.AudioContext || window.webkitAudioContext;
  try { return Audio ? new Audio() : null; }
  catch { return null; }
}

export function playOrderAlertSound(audio, style = "bip_curto", count = 1) {
  if (!audio || audio.state !== "running") return;
  const pattern = PATTERNS[style] || PATTERNS.bip_curto;
  const notesPerPattern = pattern.duration * pattern.notes.length + pattern.gap * Math.max(0, pattern.notes.length - 1);
  const startAt = audio.currentTime + 0.035;
  const patternsToPlay = Math.min(Math.max(1, Number(count) || 1), 3);

  for (let alert = 0; alert < patternsToPlay; alert += 1) {
    const patternStart = startAt + alert * (notesPerPattern + 0.22);
    pattern.notes.forEach((frequency, index) => {
      const start = patternStart + index * (pattern.duration + pattern.gap);
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(pattern.volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + pattern.duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + pattern.duration + 0.01);
    });
  }
}

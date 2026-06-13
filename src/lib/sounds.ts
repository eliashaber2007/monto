function playToneSequence(
  frequencies: number[],
  durationMs: number,
  overlapMs: number,
  type: OscillatorType,
  peakGain: number,
): void {
  const ctx = new AudioContext();
  const stepMs = durationMs - overlapMs;

  frequencies.forEach((freq, i) => {
    const startSec = (i * stepMs) / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startSec);

    gain.gain.setValueAtTime(0, ctx.currentTime + startSec);
    gain.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + startSec + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startSec + durationMs / 1000);

    osc.start(ctx.currentTime + startSec);
    osc.stop(ctx.currentTime + startSec + durationMs / 1000);
  });

  const totalSec = ((frequencies.length - 1) * stepMs + durationMs) / 1000;
  setTimeout(() => ctx.close(), totalSec * 1000 + 200);
}

export function playDepositSound(): void {
  playToneSequence([523, 659, 784, 1047], 80, 10, 'sine', 0.35);
}

export function playWithdrawalSound(): void {
  playToneSequence([523, 415, 330, 262], 100, 0, 'sine', 0.25);
}

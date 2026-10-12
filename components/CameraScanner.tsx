"use client";

import { useEffect, useRef, useState } from "react";

/** Phone-camera QR reader that runs in the browser (Android and iOS, no app install). Needs HTTPS or localhost. */
export default function CameraScanner({ onScan, paused }: { onScan: (text: string) => void; paused: boolean }) {
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);
  pausedRef.current = paused;
  onScanRef.current = onScan;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let started = false;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      scanner = new Html5Qrcode("qr-reader");
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w: number, h: number) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s }; } },
          (text) => { if (!pausedRef.current) onScanRef.current(text); },
          () => {},
        );
        started = true;
        if (cancelled) await scanner.stop();
      } catch {
        setError("We can't open the camera. Allow camera access in your browser settings, or enter the code by hand below.");
      }
    })();

    return () => {
      cancelled = true;
      if (scanner && started) scanner.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, []);

  return (
    <div>
      <div id="qr-reader" className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-ink" />
      {error && <p role="alert" className="mt-3 rounded-xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">{error}</p>}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { Modal } from "./ui";

const EXIT_MS = 120;

/**
 * `Modal` + çıkış animasyonu. Amber UI Modal'ı kapanınca hemen kaldırılır;
 * burada kapanma sırasında DOM kısa süre tutulup solma animasyonu oynatılır.
 */
export function AppModal({ open, children, onClose, ...rest }: ComponentProps<typeof Modal>) {
  const [mounted, setMounted] = useState(open);
  const marker = useRef<HTMLSpanElement>(null);

  // Modal'ın odak etkisi `onClose` kimliğine bağlı; her render'da değişirse odağı (ve kaydırmayı)
  // yeniden pencereye çeker. Sabit bir sarmalayıcı veriyoruz.
  const latestClose = useRef(onClose);
  latestClose.current = onClose;
  const stableClose = useCallback(() => latestClose.current(), []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    marker.current?.closest(".ui-modal-backdrop")?.classList.add("is-closing");
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  return (
    <Modal open={mounted} onClose={stableClose} {...rest}>
      <span ref={marker} hidden />
      {children}
    </Modal>
  );
}

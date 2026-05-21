import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

interface VirtualizedMailListProps<T> {
  items: T[];
  renderRow: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  estimateSize?: number;
  overscan?: number;
  threshold?: number;
}

/**
 * Virtualise une liste de mails via le scroll de la fenêtre — garde le layout
 * existant (sidebar + header sticky + scroll page) intact. En-dessous d'un
 * seuil (défaut 60), bypass : on map normalement (overhead React virtualizer
 * inutile sur petites listes, perte du jank-free hover).
 *
 * Hauteur de row : 52 px (convention Superhuman cf. replit.md). overscan : 8
 * lignes hors viewport pour anticiper le scroll.
 *
 * IMPORTANT : la row rendue doit être un bloc à hauteur exacte 52 px (ce que
 * font déjà toutes les EmailRow du projet). Aucune marge entre rows (les
 * séparateurs sont `border-b` internes).
 */
export function VirtualizedMailList<T>({
  items,
  renderRow,
  keyExtractor,
  estimateSize = 52,
  overscan = 8,
  threshold = 60,
}: VirtualizedMailListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    if (!parentRef.current) return;
    const update = () => {
      const rect = parentRef.current?.getBoundingClientRect();
      if (rect) setScrollMargin(rect.top + window.scrollY);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin,
  });

  // Bypass virtualisation sous le seuil — gain marginal, et garde la sélection
  // multi-clic / drag-select 100 % naturelle.
  if (items.length < threshold) {
    return (
      <div ref={parentRef}>
        {items.map((item, index) => (
          <div key={keyExtractor(item, index)}>{renderRow(item, index)}</div>
        ))}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div ref={parentRef} style={{ height: totalSize, position: "relative", width: "100%" }}>
      {virtualItems.map((vRow) => {
        const item = items[vRow.index];
        if (!item) return null;
        return (
          <div
            key={keyExtractor(item, vRow.index)}
            data-virtual-index={vRow.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vRow.start - scrollMargin}px)`,
            }}
          >
            {renderRow(item, vRow.index)}
          </div>
        );
      })}
    </div>
  );
}

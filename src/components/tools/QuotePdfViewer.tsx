import { useLayoutEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
// Explicit Vite `?url` import instead of `new URL(..., import.meta.url)`, so the
// worker is bundled locally (works offline / behind CDN blockers) without relying
// on Vite's URL-constructor asset detection, which is less reliable across bundlers.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface QuotePdfViewerProps {
  /** Blob URL of the generated quotation PDF. */
  url: string;
}

const PAGE_ASPECT = 11 / 8.5;

function PageSkeleton({ width }: { width: number }) {
  return (
    <div
      className="bg-surface-3 animate-pulse rounded-lg"
      style={{ width, height: Math.round(width * PAGE_ASPECT) }}
      aria-label="Loading PDF page"
    />
  );
}

/**
 * Renders the real generated PDF as canvases inside a plain div (pdf.js), so the
 * preview is pixel-accurate but free of the browser's native PDF viewer chrome.
 */
export function QuotePdfViewer({ url }: QuotePdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    // Debounce: only re-render the canvas once the container settles at its
    // final size, instead of at every intermediate width mid-animation.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver((entries) => {
      clearTimeout(timer);
      const next = entries[0]?.target.clientWidth;
      timer = setTimeout(() => {
        if (typeof next === "number") setWidth(next);
      }, 180);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex w-full flex-col items-center">
      <Document
        key={url}
        file={url}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={
          width > 0 ? (
            <PageSkeleton width={width} />
          ) : (
            <div
              className="bg-surface-3 animate-pulse rounded-lg"
              style={{ width: "100%", paddingBottom: `${Math.round(PAGE_ASPECT * 100)}%` }}
              aria-label="Loading PDF page"
            />
          )
        }
        error={
          <p className="py-8 text-center text-xs text-muted-foreground">
            Preview unavailable
          </p>
        }
        className="flex flex-col items-center gap-3"
      >
        {width > 0 &&
          Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i}
              pageNumber={i + 1}
              width={width}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={<PageSkeleton width={width} />}
              className="overflow-hidden rounded-xl shadow-sm [&_canvas]:!h-auto [&_canvas]:!w-full"
            />
          ))}
      </Document>
    </div>
  );
}

export default QuotePdfViewer;

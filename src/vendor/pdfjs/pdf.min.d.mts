interface PdfViewport {
  width: number;
  height: number;
}

interface PdfPage {
  getViewport(params: { scale: number }): PdfViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }): { promise: Promise<void> };
  cleanup(): void;
}

interface PdfDocument {
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

export const GlobalWorkerOptions: { workerSrc: string };

export function getDocument(params: {
  data: Uint8Array;
}): { promise: Promise<PdfDocument> };

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { PdfKind } from "../domain/types";
import { stampFilename } from "./download";

export async function exportReportPdf(
  element: HTMLElement,
  kind: PdfKind,
  basename: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

  const image = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imageWidth = pageWidth - margin * 2;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;
  const pageBody = pageHeight - margin * 2;

  let offset = 0;
  let remaining = imageHeight;

  while (remaining > 0) {
    if (offset > 0) {
      pdf.addPage();
    }
    pdf.addImage(image, "PNG", margin, margin - offset, imageWidth, imageHeight);
    offset += pageBody;
    remaining -= pageBody;
  }

  pdf.save(stampFilename(`${basename}-${kind}`, "pdf"));
}

import workerSource from "../vendor/pdfjs/pdf.worker.min.mjs?raw";

type PdfModulo = typeof import("../vendor/pdfjs/pdf.min.mjs");
type PdfAberto = Awaited<ReturnType<PdfModulo["getDocument"]>["promise"]>;

let fonte: ArrayBuffer | null = null;
let documento: Promise<PdfAberto> | null = null;
let trabalhador: Promise<Worker> | null = null;

function workerPronto(): Promise<Worker> {
  if (trabalhador) return trabalhador;
  const url = URL.createObjectURL(
    new Blob([workerSource], { type: "text/javascript" }),
  );
  const worker = new Worker(url, { type: "module" });
  trabalhador = new Promise((resolve, reject) => {
    let timer = 0;
    const falhou = () => {
      window.clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      trabalhador = null;
      reject(new Error("worker"));
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { action?: string } | null;
      if (!data || data.action !== "ready") return;
      window.clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", falhou);
      URL.revokeObjectURL(url);
      resolve(worker);
    };
    timer = window.setTimeout(falhou, 20000);
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", falhou);
  });
  return trabalhador;
}

function biblioteca(): Promise<PdfModulo> {
  return Promise.all([
    import("../vendor/pdfjs/pdf.min.mjs"),
    workerPronto(),
  ]).then(([pdf, worker]) => {
    (
      pdf.GlobalWorkerOptions as { workerPort?: Worker }
    ).workerPort = worker;
    return pdf;
  });
}

export function prepararPlanta(data: ArrayBuffer): void {
  if (fonte === data && documento) return;
  esquecerPlanta();
  fonte = data;
}

export function esquecerPlanta(): void {
  const atual = documento;
  documento = null;
  fonte = null;
  if (!atual) return;
  void atual.then((pdf) => pdf.destroy()).catch(() => undefined);
}

async function plantaAberta(): Promise<PdfAberto> {
  if (!fonte) throw new Error("sem planta");
  if (!documento) {
    const pedido = biblioteca().then((pdf) => {
      if (!fonte) throw new Error("sem planta");
      return pdf
        .getDocument({ data: new Uint8Array(fonte.slice(0)) })
        .promise;
    });
    documento = pedido;
    pedido.catch(() => {
      if (documento === pedido) documento = null;
    });
  }
  return documento;
}

/** Desenha uma página do PDF escolhido. A folha é vetor; o resultado é PNG. */
export async function desenharPagina(
  data: ArrayBuffer,
  pagina: number,
): Promise<Blob> {
  if (fonte !== data) prepararPlanta(data);
  const pdf = await plantaAberta();
  const page = await pdf.getPage(pagina);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/png");
  });
  if (!blob) throw new Error("png");
  return blob;
}

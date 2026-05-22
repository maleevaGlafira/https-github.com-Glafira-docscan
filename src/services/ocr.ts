import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function getPdfPreview(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // high resolution scale for full-size viewing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };
    
    // @ts-expect-error pdfjs types mismatch
    await page.render(renderContext).promise;
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error('Error generating PDF preview:', error);
    return null;
  }
}

export async function convertPdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  const numPages = pdf.numPages;
  const images: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better OCR
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) continue;
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };
    
    // @ts-expect-error pdfjs types mismatch
    await page.render(renderContext).promise;
    images.push(canvas.toDataURL('image/png'));
  }
  
  return images;
}

export type ProgressCallback = (progress: number, status: string) => void;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export async function recognizeText(
  files: File[],
  onProgress: ProgressCallback
): Promise<string> {
  let allImagesBase64: string[] = [];
  const totalFiles = files.length;

  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const isPDF = file.type === 'application/pdf';
    
    if (isPDF) {
      onProgress(0, `Converting PDF ${i + 1}/${totalFiles} to images...`);
      const images = await convertPdfToImages(file);
      allImagesBase64 = allImagesBase64.concat(images);
    } else {
      onProgress(0, `Reading image file ${i + 1}/${totalFiles}...`);
      const base64 = await fileToBase64(file);
      allImagesBase64.push(base64);
    }
  }

  onProgress(0.5, "Sending to Gemini AI for processing...");

  try {
    const response = await fetch("/api/recognize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ images: allImagesBase64 })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || "Failed to recognize text from server.");
    }

    const data = await response.json();
    onProgress(1.0, "Recognition complete.");
    return data.text;
  } catch (error: any) {
    console.error("OCR Error:", error);
    throw error;
  }
}

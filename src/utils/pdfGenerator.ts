import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { TenderData, Requirement, DocumentMatch } from './documentValidator';

interface PackageParams {
  tender: TenderData;
  requirements: Requirement[];
  matches: Record<string, DocumentMatch>;
  uploadedFiles: Record<string, { file: File; bytes: ArrayBuffer; pageCount?: number }>;
}

export async function generateTenderPackage({
  tender,
  requirements,
  matches,
  uploadedFiles,
}: PackageParams): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

  const coverPage = mergedPdf.addPage([595.28, 841.89]);
  const { height } = coverPage.getSize();

  coverPage.drawText('TENDER DOCUMENT PACKAGE', {
    x: 50,
    y: height - 80,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.2, 0.5),
  });

  const details = [
    `Tender ID: ${tender.tender_id || 'N/A'}`,
    `Tender Title: ${tender.title || 'N/A'}`,
    `Procuring Entity: ${tender.procuring_entity || 'N/A'}`,
    `Bidder Name: ${tender.bidder || 'N/A'}`,
    `Submission Deadline: ${tender.submission_deadline || 'N/A'}`,
    `Package Generated On: ${new Date().toISOString().split('T')[0]}`,
  ];

  let currentY = height - 120;
  details.forEach((line) => {
    coverPage.drawText(line, { x: 50, y: currentY, size: 10, font });
    currentY -= 18;
  });

  currentY -= 15;
  coverPage.drawText('Included Documents:', { x: 50, y: currentY, size: 13, font: boldFont });
  currentY -= 22;

  const sortedReqs = [...requirements].sort((a, b) => a.order - b.order);
  const includedReqs: Requirement[] = [];

  sortedReqs.forEach((req) => {
    const match = matches[req.id];
    if (match && match.fileId && uploadedFiles[match.fileId]) {
      includedReqs.push(req);
      const title = req.title_en.length > 65 ? `${req.title_en.substring(0, 65)}...` : req.title_en;
      coverPage.drawText(`${req.order}. ${title}`, {
        x: 65,
        y: currentY,
        size: 9,
        font,
      });
      currentY -= 16;
    }
  });

  for (const req of includedReqs) {
    const match = matches[req.id];
    const fileData = uploadedFiles[match.fileId!];
    if (fileData && fileData.bytes) {
      try {
        const srcDoc = await PDFDocument.load(fileData.bytes);
        const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        console.error('Failed to append PDF pages:', err);
      }
    }
  }

  const totalPages = mergedPdf.getPageCount();
  const pages = mergedPdf.getPages();

  pages.forEach((page, index) => {
    const footerText = `${tender.tender_id} | Page ${index + 1} of ${totalPages}`;
    page.drawText(footerText, {
      x: 50,
      y: 20,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  });

  return await mergedPdf.save();
}
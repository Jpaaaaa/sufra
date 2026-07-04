import { ExportPdfDto } from './dto/export-pdf.dto';

/**
 * PDF generation is ONLY available via IPC in Electron main process.
 * This file exists only for type compatibility - it should never be called.
 */
export async function generateReportPDF(dto: ExportPdfDto): Promise<Buffer> {
  throw new Error(
    'PDF generation via HTTP is not supported. PDF export must be done via IPC in Electron main process using window.sufra.export.pdf()'
  );
}

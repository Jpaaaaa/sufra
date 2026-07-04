import React from 'react';
import ReactPDF from '@react-pdf/renderer';
import { ExportPdfDto } from '../../types/reports/export-pdf.dto';
import { ReportDocument } from './ReportDocument';

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function generateReportPDF(dto: ExportPdfDto): Promise<Buffer> {
  try {
    console.log('[PDF] Generating PDF for type:', dto.type);
    console.log('[PDF] Data summary:', dto.data?.summary ? 'exists' : 'missing');
    console.log('[PDF] Data items:', Array.isArray(dto.data?.items) ? dto.data.items.length : 'not array');
    console.log('[PDF] Data employees:', Array.isArray(dto.data?.employees) ? dto.data.employees.length : 'not array');
    console.log('[PDF] Data orders:', Array.isArray(dto.data?.orders) ? dto.data.orders.length : 'not array');

    const element = React.createElement(ReportDocument, { dto }) as React.ReactElement;
    const stream = await ReactPDF.renderToStream(element);
    const pdfBuffer = await streamToBuffer(stream);
    console.log('[PDF] PDF generated successfully, size:', pdfBuffer.length);
    return pdfBuffer;
  } catch (error) {
    console.error('[PDF] Error in generateReportPDF:', error);
    console.error('[PDF] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[PDF] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      type: typeof error,
      dtoType: dto?.type,
      hasData: !!dto?.data,
    });
    throw error;
  }
}

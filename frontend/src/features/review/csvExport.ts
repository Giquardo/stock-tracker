import Papa from 'papaparse';
import type { OrderLine } from './useReviewData';

export interface ExportRow {
  sku: string;
  name: string;
  unit: string;
  order_qty: number;
  supplier: string;
  status: string;
  counted: number | '';
}

/** Spec FR-5 export columns. Excluded lines are dropped, not just marked. */
export function buildExportRows(orderLines: OrderLine[]): ExportRow[] {
  return orderLines
    .filter((orderLine) => !orderLine.line.excluded)
    .map((orderLine) => ({
      sku: orderLine.item.sku,
      name: orderLine.item.name,
      unit: orderLine.item.unit ?? '',
      order_qty: orderLine.line.orderQty,
      supplier: orderLine.supplierName,
      status: orderLine.line.status,
      counted: orderLine.line.countedQty ?? '',
    }));
}

export function generateCsv(rows: ExportRow[]): string {
  return Papa.unparse(rows);
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

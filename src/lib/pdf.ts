import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportTablePDF(opts: {
  title: string;
  head: string[];
  body: (string | number)[][];
  filename: string;
  meta?: string[];
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
  doc.setFontSize(14);
  doc.text(opts.title, 40, 40);
  if (opts.meta?.length) {
    doc.setFontSize(9);
    opts.meta.forEach((m, i) => doc.text(m, 40, 58 + i * 12));
  }
  autoTable(doc, {
    head: [opts.head],
    body: opts.body,
    startY: 60 + (opts.meta?.length ?? 0) * 12,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
  });
  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}
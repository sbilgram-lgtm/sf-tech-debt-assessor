import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { AssessmentResult } from '../types/assessment';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

function getScoreColor(percentage: number) {
  if (percentage >= 80) return { r: 39, g: 174, b: 96 };
  if (percentage >= 60) return { r: 243, g: 156, b: 18 };
  if (percentage >= 40) return { r: 211, g: 84, b: 0 };
  return { r: 192, g: 57, b: 43 };
}

function getScoreLabel(percentage: number): string {
  if (percentage >= 80) return 'Healthy';
  if (percentage >= 60) return 'Moderate Debt';
  if (percentage >= 40) return 'Significant Debt';
  return 'Critical Debt';
}

export function generatePDFReport(assessment: AssessmentResult): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title page
  doc.setFontSize(22);
  doc.setTextColor(44, 62, 80);
  doc.text('Salesforce Technical Debt Assessment', pageWidth / 2, 25, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(127, 140, 141);
  doc.text(`Generated: ${new Date(assessment.timestamp).toLocaleDateString()}`, pageWidth / 2, 33, { align: 'center' });
  if (assessment.instanceUrl) {
    doc.text(`Org: ${assessment.instanceUrl}`, pageWidth / 2, 39, { align: 'center' });
  }

  // Overall score
  doc.setFontSize(16);
  doc.setTextColor(44, 62, 80);
  doc.text('Overall Health Score', 14, 55);

  const scoreColor = getScoreColor(assessment.overallPercentage);
  doc.setFontSize(36);
  doc.setTextColor(scoreColor.r, scoreColor.g, scoreColor.b);
  doc.text(`${assessment.overallPercentage}%`, 14, 72);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(getScoreLabel(assessment.overallPercentage), 55, 72);

  // Category summary table
  let yPos = 85;
  doc.setFontSize(14);
  doc.setTextColor(44, 62, 80);
  doc.text('Category Scores', 14, yPos);

  doc.autoTable({
    startY: yPos + 5,
    head: [['Category', 'Score', 'Rating', 'Issues']],
    body: assessment.categories.map(cat => [
      cat.category,
      `${cat.percentage}%`,
      getScoreLabel(cat.percentage),
      `${cat.items.length} issues`
    ]),
    theme: 'striped',
    headStyles: { fillColor: [44, 62, 80] },
    styles: { fontSize: 10 }
  });

  // Detailed findings — one page per category
  assessment.categories.forEach(category => {
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.text(`${category.category}`, 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Score: ${category.percentage}%  |  ${getScoreLabel(category.percentage)}  |  ${category.items.length} issue${category.items.length !== 1 ? 's' : ''}`, 14, 28);

    if (category.items.length === 0) {
      doc.setFontSize(11);
      doc.setTextColor(39, 174, 96);
      doc.text('No issues found. This category is in good health.', 14, 42);
      return;
    }

    const sortedItems = [...category.items].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });

    let currentY = 35;

    sortedItems.forEach(item => {
      const records: { name: string; detail?: string }[] = item.metadata?.records || [];

      // Finding header row
      const findingRows: string[][] = [[
        item.severity.toUpperCase(),
        item.title,
        item.recommendation
      ]];

      (doc as any).autoTable({
        startY: currentY,
        head: [['Severity', 'Finding', 'Recommendation']],
        body: findingRows,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], fontSize: 8 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 75 },
          2: { cellWidth: 'auto' }
        },
        didParseCell: (data: any) => {
          if (data.column.index === 0 && data.section === 'body') {
            const sev = data.cell.raw.toLowerCase();
            if (sev === 'critical') data.cell.styles.textColor = [192, 57, 43];
            else if (sev === 'high') data.cell.styles.textColor = [211, 84, 0];
            else if (sev === 'medium') data.cell.styles.textColor = [243, 156, 18];
            else data.cell.styles.textColor = [39, 174, 96];
          }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 2;

      // Affected records sub-table
      if (records.length > 0) {
        const recordRows = records.map(r => [r.name, r.detail || '']);
        (doc as any).autoTable({
          startY: currentY,
          head: [['Affected Record', 'Detail']],
          body: recordRows,
          theme: 'plain',
          headStyles: { fillColor: [236, 240, 241], textColor: [80, 80, 80], fontSize: 7, fontStyle: 'bold' },
          styles: { fontSize: 8, cellPadding: 2, textColor: [80, 80, 80] },
          columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 'auto' }
          },
          margin: { left: 22, right: 14 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 6;
      } else {
        currentY += 4;
      }

      // Add page if running out of space
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }
    });
  });

  doc.save('sf-tech-debt-assessment.pdf');
}

export function generateCSVReport(assessment: AssessmentResult): void {
  const rows: string[][] = [];

  // Header
  rows.push(['Category', 'Score %', 'Severity', 'Issue', 'Description', 'Recommendation', 'Affected Record', 'Detail']);

  assessment.categories.forEach(category => {
    if (category.items.length === 0) {
      rows.push([category.category, String(category.percentage), '', 'No issues found', '', '', '', '']);
      return;
    }

    const sortedItems = [...category.items].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });

    sortedItems.forEach(item => {
      const records: { name: string; detail?: string }[] = item.metadata?.records || [];

      if (records.length === 0) {
        rows.push([
          category.category,
          String(category.percentage),
          item.severity,
          item.title,
          item.description,
          item.recommendation,
          '',
          ''
        ]);
      } else {
        records.forEach((record, i) => {
          rows.push([
            i === 0 ? category.category : '',
            i === 0 ? String(category.percentage) : '',
            i === 0 ? item.severity : '',
            i === 0 ? item.title : '',
            i === 0 ? item.description : '',
            i === 0 ? item.recommendation : '',
            record.name,
            record.detail || ''
          ]);
        });
      }
    });
  });

  // Escape and join
  const csv = rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sf-tech-debt-assessment-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

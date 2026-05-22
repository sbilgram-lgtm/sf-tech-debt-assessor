import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { AssessmentResult, DebtItem } from '../types/assessment';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export function generatePDFReport(assessment: AssessmentResult): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(22);
  doc.setTextColor(44, 62, 80);
  doc.text('Salesforce Technical Debt Assessment', pageWidth / 2, 25, { align: 'center' });

  // Subtitle
  doc.setFontSize(11);
  doc.setTextColor(127, 140, 141);
  doc.text(`Generated: ${new Date(assessment.timestamp).toLocaleDateString()}`, pageWidth / 2, 33, { align: 'center' });
  if (assessment.instanceUrl) {
    doc.text(`Org: ${assessment.instanceUrl}`, pageWidth / 2, 39, { align: 'center' });
  }

  // Overall Score
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

  // Category Summary Table
  let yPos = 85;
  doc.setFontSize(14);
  doc.setTextColor(44, 62, 80);
  doc.text('Category Scores', 14, yPos);

  const categoryData = assessment.categories.map(cat => [
    cat.category,
    `${cat.percentage}%`,
    getScoreLabel(cat.percentage),
    `${cat.items.length} issues`
  ]);

  doc.autoTable({
    startY: yPos + 5,
    head: [['Category', 'Score', 'Rating', 'Issues']],
    body: categoryData,
    theme: 'striped',
    headStyles: { fillColor: [44, 62, 80] },
    styles: { fontSize: 10 }
  });

  // Detailed Findings
  assessment.categories.forEach(category => {
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.text(`${category.category} - Detailed Findings`, 14, 20);

    doc.setFontSize(12);
    doc.text(`Score: ${category.percentage}% | Issues: ${category.items.length}`, 14, 28);

    if (category.items.length === 0) {
      doc.setFontSize(11);
      doc.setTextColor(39, 174, 96);
      doc.text('No issues found. This category is in good health.', 14, 40);
      return;
    }

    const sortedItems = [...category.items].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });

    const itemData = sortedItems.map(item => [
      item.severity.toUpperCase(),
      item.title,
      item.recommendation
    ]);

    doc.autoTable({
      startY: 35,
      head: [['Severity', 'Finding', 'Recommendation']],
      body: itemData,
      theme: 'striped',
      headStyles: { fillColor: [44, 62, 80] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 70 },
        2: { cellWidth: 'auto' }
      },
      didParseCell: (data: any) => {
        if (data.column.index === 0 && data.section === 'body') {
          const severity = data.cell.raw.toLowerCase();
          if (severity === 'critical') data.cell.styles.textColor = [192, 57, 43];
          else if (severity === 'high') data.cell.styles.textColor = [211, 84, 0];
          else if (severity === 'medium') data.cell.styles.textColor = [243, 156, 18];
          else data.cell.styles.textColor = [39, 174, 96];
        }
      }
    });
  });

  doc.save('sf-tech-debt-assessment.pdf');
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

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { QUESTION_TYPE_LABELS } from '../models/question.types.js';

/** Excel-safe, injection-proof cell text. */
function cell(value) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'object' ? value.join(', ') : String(value);
  // Neutralise CSV/Excel formula injection
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return text;
}

export function responsesToCsv(survey, questions, responses) {
  const headers = [
    'Response ID',
    'Submitted At',
    'Respondent',
    ...questions.map((q, i) => `Q${i + 1}: ${cell(q.text)} [${QUESTION_TYPE_LABELS[q.type] ?? q.type}]`),
  ];

  const lines = [headers.map(csvEscape).join(',')];

  for (const response of responses) {
    const byQuestion = new Map(response.answers.map((a) => [a.questionId, a.value]));
    const row = [
      response.id,
      new Date(response.submittedAt).toISOString(),
      response.respondentEmail ?? 'Anonymous',
      ...questions.map((q) => cell(byQuestion.get(q.id) ?? '')),
    ];
    lines.push(row.map(csvEscape).join(','));
  }

  return `${lines.join('\r\n')}\r\n`;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function responsesToExcel(survey, questions, responses) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = survey.title;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Responses', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Response ID', key: 'id', width: 14 },
    { header: 'Submitted At', key: 'submittedAt', width: 24 },
    { header: 'Respondent', key: 'respondent', width: 28 },
    ...questions.map((q, i) => ({
      header: `Q${i + 1}: ${q.text}`,
      key: `q${i + 1}`,
      width: 36,
    })),
  ];

  sheet.getRow(1).font = { bold: true };

  for (const response of responses) {
    const byQuestion = new Map(response.answers.map((a) => [a.questionId, a.value]));
    const row = {
      id: response.id,
      submittedAt: new Date(response.submittedAt).toISOString(),
      respondent: response.respondentEmail ?? 'Anonymous',
    };
    questions.forEach((q, i) => {
      row[`q${i + 1}`] = cell(byQuestion.get(q.id) ?? '');
    });
    sheet.addRow(row);
  }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(sheet.columnCount, 1) },
  };

  // Second sheet: per-question summary
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Question', key: 'text', width: 52 },
    { header: 'Type', key: 'type', width: 20 },
    { header: 'Answers', key: 'answered', width: 12 },
    { header: 'Breakdown', key: 'breakdown', width: 60 },
  ];
  summary.getRow(1).font = { bold: true };

  for (const q of questions) {
    const values = responses
      .map((r) => r.answers.find((a) => a.questionId === q.id)?.value)
      .filter((v) => v !== undefined && v !== null && v !== '');
    const counts = new Map();
    for (const v of values.flatMap((v) => (Array.isArray(v) ? v : [v]))) {
      counts.set(String(v), (counts.get(String(v)) || 0) + 1);
    }
    summary.addRow({
      text: q.text,
      type: QUESTION_TYPE_LABELS[q.type] ?? q.type,
      answered: values.length,
      breakdown: [...counts.entries()].map(([k, v]) => `${k}: ${v}`).join(', '),
    });
  }

  return workbook.xlsx.writeBuffer();
}

export function responsesToPdf(survey, questions, responses, analytics) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  doc.fontSize(20).text(survey.title);
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#555555');
  if (survey.description) doc.text(survey.description);
  doc.text(
    [
      `Generated: ${new Date().toUTCString()}`,
      `Total responses: ${responses.length}`,
      analytics?.rating?.average != null ? `Average rating: ${analytics.rating.average}` : null,
    ]
      .filter(Boolean)
      .join(' | '),
  );
  doc.fillColor('#000000');
  doc.moveDown(1);

  // ---- Summary of answers ----
  doc.fontSize(14).text('Answer Summary');
  doc.moveDown(0.5);

  for (const q of analytics?.questions ?? []) {
    if (doc.y > 700) doc.addPage();
    doc.fontSize(11).fillColor('#111111').text(`Q: ${q.text}`);
    doc.fontSize(9).fillColor('#666666').text(`${QUESTION_TYPE_LABELS[q.type] ?? q.type} · answered by ${q.answered}`);
    doc.fillColor('#333333');

    const rows = q.breakdown.slice(0, 10);
    if (!rows.length) {
      doc.fontSize(9).fillColor('#888888').text('No answers yet.');
    } else {
      for (const row of rows) {
        const bar = '█'.repeat(Math.min(row.count, 40));
        doc.fontSize(9).text(`   ${truncate(row.label, 48)} — ${row.count}  ${bar}`);
      }
    }
    doc.moveDown(0.8);
  }

  // ---- Individual responses ----
  doc.addPage();
  doc.fontSize(14).fillColor('#000000').text('Individual Responses');
  doc.moveDown(0.5);

  responses.forEach((response, index) => {
    if (doc.y > 720) doc.addPage();
    doc.fontSize(10).fillColor('#000000').text(
      `#${response.id} · ${new Date(response.submittedAt).toUTCString()} · ${response.respondentEmail ?? 'Anonymous'}`,
    );
    doc.fontSize(9).fillColor('#444444');

    const byQuestion = new Map(response.answers.map((a) => [a.questionId, a.value]));
    for (const q of questions) {
      const value = byQuestion.get(q.id);
      if (value === undefined || value === null || value === '') continue;
      const text = Array.isArray(value) ? value.join(', ') : String(value);
      doc.text(`${truncate(q.text, 70)}: ${truncate(text, 70)}`, { width: 500 });
    }
    doc.moveDown(0.6);

    if (index < responses.length - 1) {
      doc.moveTo(doc.x, doc.y).lineTo(545, doc.y).strokeColor('#dddddd').stroke();
      doc.moveDown(0.5);
    }
  });

  doc.end();
  return doc;
}

function truncate(value, max) {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
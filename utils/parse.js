const fs = require('fs');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const { parse } = require('csv-parse');

async function parseCSV(filePath) {
  const records = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .on('data', row => records.push(row))
      .on('end', () => resolve({ type: 'csv', rows: records }))
      .on('error', reject);
  });
}

async function parseXLSX(filePath) {
  const wb = xlsx.readFile(filePath);
  const out = {};
  wb.SheetNames.forEach(name => {
    const sheet = xlsx.utils.sheet_to_json(wb.Sheets[name], { defval: null });
    out[name] = sheet;
  });
  return { type: 'xlsx', sheets: out };
}

async function parsePDF(filePath) {
  const data = await pdfParse(fs.readFileSync(filePath));
  // Split text by pages using the provided metadata if available
  const pages = (data.text || "").split('\f').map((t, i) => ({ page: i + 1, text: t.trim() }));
  return { type: 'pdf', numpages: data.numpages, pages };
}

async function parseFile(filePath, mimeType) {
  const lower = (mimeType || '').toLowerCase();
  if (lower.includes('csv') || filePath.toLowerCase().endsWith('.csv')) {
    return await parseCSV(filePath);
  }
  if (lower.includes('sheet') || filePath.toLowerCase().endsWith('.xlsx') || filePath.toLowerCase().endsWith('.xls')) {
    return await parseXLSX(filePath);
  }
  if (lower.includes('pdf') || filePath.toLowerCase().endsWith('.pdf')) {
    return await parsePDF(filePath);
  }
  // Fallback: return raw text preview
  const buf = fs.readFileSync(filePath);
  const sample = buf.slice(0, 1000).toString('utf8');
  return { type: 'unknown', preview: sample };
}

module.exports = { parseFile };

/**
 * xlsxExport.ts — Zero-dependency XLSX/CSV generator for browser environments.
 */

// ─── CRC-32 ───────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Binary helpers ───────────────────────────────────────────────────────────
const enc = new TextEncoder();
const str  = (s: string): Uint8Array => enc.encode(s);
const u16le = (n: number): Uint8Array =>
  new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
const u32le = (n: number): Uint8Array =>
  new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

// ─── DOS date/time ────────────────────────────────────────────────────────────
function dosDateTime(): [Uint8Array, Uint8Array] {
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [u16le(dosTime), u16le(dosDate)];
}

// ─── ZIP STORE builder ────────────────────────────────────────────────────────
interface ZipEntry {
  name: string; data: Uint8Array; crc: number;
  offset: number; dosTime: Uint8Array; dosDate: Uint8Array;
}

function buildZip(files: { name: string; content: string }[]): Uint8Array {
  const [dosTime, dosDate] = dosDateTime();
  const entries: ZipEntry[] = [];
  const localParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const data = str(file.content);
    const crc  = crc32(data);
    const nameBytes = str(file.name);
    const localHeader = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16le(20), u16le(0), u16le(0),
      dosTime, dosDate,
      u32le(crc), u32le(data.length), u32le(data.length),
      u16le(nameBytes.length), u16le(0), nameBytes,
    );
    entries.push({ name: file.name, data, crc, offset, dosTime, dosDate });
    offset += localHeader.length + data.length;
    localParts.push(localHeader, data);
  }

  const centralParts: Uint8Array[] = [];
  for (const e of entries) {
    const nameBytes = str(e.name);
    centralParts.push(concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      u16le(20), u16le(20), u16le(0), u16le(0),
      e.dosTime, e.dosDate,
      u32le(e.crc), u32le(e.data.length), u32le(e.data.length),
      u16le(nameBytes.length), u16le(0), u16le(0),
      u16le(0), u16le(0), u32le(0), u32le(e.offset), nameBytes,
    ));
  }

  const centralDir = concat(...centralParts);
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16le(0), u16le(0),
    u16le(entries.length), u16le(entries.length),
    u32le(centralDir.length), u32le(offset), u16le(0),
  );
  return concat(...localParts, centralDir, eocd);
}

// ─── XML escape ───────────────────────────────────────────────────────────────
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ─── OOXML static parts ───────────────────────────────────────────────────────
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

function buildWorkbook(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"      Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"        Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0"   fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0"   fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="2"   fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;

// ─── Column letter helper ─────────────────────────────────────────────────────
function colLetter(idx: number): string {
  let letter = '';
  idx += 1;
  while (idx > 0) {
    letter = String.fromCharCode(65 + ((idx - 1) % 26)) + letter;
    idx = Math.floor((idx - 1) / 26);
  }
  return letter;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface XlsxRow {
  [key: string]: string | number | null | undefined;
}

// ─── Main XLSX export ─────────────────────────────────────────────────────────
export function downloadXlsx(
  rows:      XlsxRow[],
  headers:   string[],
  keys:      string[],
  filename:  string,
  sheetName  = 'Data',
): void {
  // Build shared strings table
  const stringMap    = new Map<string, number>();
  const sharedStrings: string[] = [];
  function getStringIndex(s: string): number {
    if (stringMap.has(s)) return stringMap.get(s)!;
    const idx = sharedStrings.length;
    sharedStrings.push(s); stringMap.set(s, idx); return idx;
  }
  headers.forEach(h => getStringIndex(h));
  rows.forEach(row => {
    keys.forEach(k => {
      const v = row[k];
      if (v != null && typeof v === 'string' && v !== '') getStringIndex(v);
    });
  });

  // Build worksheet XML
  const totalRows = rows.length + 1;
  const lastCol   = colLetter(keys.length - 1);
  let sheetData = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCol}${totalRows}"/>
  <sheetData>`;

  // Header row (bold + navy fill — style 1)
  sheetData += `\n    <row r="1">`;
  headers.forEach((h, ci) => {
    sheetData += `<c r="${colLetter(ci)}1" t="s" s="1"><v>${getStringIndex(h)}</v></c>`;
  });
  sheetData += `</row>`;

  // Data rows
  rows.forEach((row, ri) => {
    const rowNum = ri + 2;
    sheetData += `\n    <row r="${rowNum}">`;
    keys.forEach((k, ci) => {
      const cellRef = `${colLetter(ci)}${rowNum}`;
      const val     = row[k];

      if (val === null || val === undefined || val === '') {
        // FIX: empty cells must be self-closing — no <v> child
        sheetData += `<c r="${cellRef}"/>`;
      } else if (typeof val === 'number') {
        const styleIdx = Number.isInteger(val) ? 0 : 2;
        sheetData += `<c r="${cellRef}" s="${styleIdx}"><v>${val}</v></c>`;
      } else {
        // Non-empty string via shared strings
        sheetData += `<c r="${cellRef}" t="s"><v>${getStringIndex(String(val))}</v></c>`;
      }
    });
    sheetData += `</row>`;
  });
  sheetData += `\n  </sheetData>\n</worksheet>`;

  // Shared strings XML
  const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map(s => `  <si><t xml:space="preserve">${xmlEscape(s)}</t></si>`).join('\n')}
</sst>`;

  // Assemble ZIP
  const zipBytes = buildZip([
    { name: '[Content_Types].xml',        content: CONTENT_TYPES       },
    { name: '_rels/.rels',                content: RELS                },
    { name: 'xl/workbook.xml',            content: buildWorkbook(sheetName) },
    { name: 'xl/_rels/workbook.xml.rels', content: WORKBOOK_RELS       },
    { name: 'xl/styles.xml',              content: STYLES              },
    { name: 'xl/sharedStrings.xml',       content: ssXml               },
    { name: 'xl/worksheets/sheet1.xml',   content: sheetData           },
  ]);

  const blob = new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── CSV export ───────────────────────────────────────────────────────────────
export function downloadCsv(
  rows:     XlsxRow[],
  headers:  string[],
  keys:     string[],
  filename: string,
): void {
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => keys.map(k => escape(row[k])).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

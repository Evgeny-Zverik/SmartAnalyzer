function saveBlob(parts: BlobPart[], type: string, filename: string): void {
  const blob = new Blob(parts, { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export type DownloadFormatPreset = "standard" | "compact" | "document" | "draft";
export type DownloadTextAlignment = "left" | "center" | "right" | "justify";

export type DownloadDocumentOptions = {
  preset?: DownloadFormatPreset;
  alignment?: DownloadTextAlignment;
};

export type DownloadDocumentFormat = "txt" | "md" | "rtf" | "doc" | "docx" | "pdf" | "odt";

function asBlobPart(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

function normalizeFilename(baseName: string, extension: string): string {
  const safe = baseName.trim().replace(/[^\w\-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
  return `${safe}.${extension}`;
}

function getPresetConfig(preset: DownloadFormatPreset) {
  if (preset === "compact") {
    return { fontFamily: "Courier New", fontSize: 20, lineHeight: 26 };
  }
  if (preset === "document") {
    return { fontFamily: "Times New Roman", fontSize: 24, lineHeight: 34 };
  }
  if (preset === "draft") {
    return { fontFamily: "Helvetica", fontSize: 22, lineHeight: 34 };
  }
  return { fontFamily: "Courier New", fontSize: 22, lineHeight: 30 };
}

function getDocxAlignmentValue(alignment: DownloadTextAlignment): string {
  if (alignment === "center") return "center";
  if (alignment === "right") return "right";
  if (alignment === "justify") return "both";
  return "left";
}

function wrapTextForCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");

  paragraphs.forEach((paragraph) => {
    if (!paragraph.trim()) {
      lines.push("");
      return;
    }

    let current = "";
    paragraph.split(/\s+/).forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        return;
      }
      if (current) {
        lines.push(current);
      }
      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
        return;
      }

      let chunk = "";
      Array.from(word).forEach((char) => {
        const nextChunk = chunk + char;
        if (ctx.measureText(nextChunk).width <= maxWidth) {
          chunk = nextChunk;
          return;
        }
        if (chunk) {
          lines.push(chunk);
        }
        chunk = char;
      });
      current = chunk;
    });

    if (current) {
      lines.push(current);
    }
  });

  return lines.length > 0 ? lines : [""];
}

function drawAlignedLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  alignment: DownloadTextAlignment,
  x: number,
  y: number,
  maxWidth: number,
  isLastLine: boolean
): void {
  const width = ctx.measureText(line).width;
  if (alignment === "center") {
    ctx.fillText(line, x + Math.max(0, (maxWidth - width) / 2), y);
    return;
  }
  if (alignment === "right") {
    ctx.fillText(line, x + Math.max(0, maxWidth - width), y);
    return;
  }
  if (alignment === "justify" && !isLastLine && line.includes(" ")) {
    const words = line.split(" ");
    const textWidth = words.reduce((sum, word) => sum + ctx.measureText(word).width, 0);
    const totalSpace = Math.max(0, maxWidth - textWidth);
    const gap = words.length > 1 ? totalSpace / (words.length - 1) : 0;
    let cursor = x;
    words.forEach((word, index) => {
      ctx.fillText(word, cursor, y);
      cursor += ctx.measureText(word).width + (index < words.length - 1 ? gap : 0);
    });
    return;
  }
  ctx.fillText(line, x, y);
}

function uint32ToBytes(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function uint16ToBytes(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function createStoredZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const localHeader = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      20, 0,
      0, 0,
      0, 0,
      0, 0,
      0, 0,
      ...uint32ToBytes(crc),
      ...uint32ToBytes(file.data.length),
      ...uint32ToBytes(file.data.length),
      ...uint16ToBytes(nameBytes.length),
      0, 0,
    ]);
    const localPart = concatUint8Arrays([localHeader, nameBytes, file.data]);
    localParts.push(localPart);

    const centralHeader = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02,
      20, 0,
      20, 0,
      0, 0,
      0, 0,
      0, 0,
      0, 0,
      ...uint32ToBytes(crc),
      ...uint32ToBytes(file.data.length),
      ...uint32ToBytes(file.data.length),
      ...uint16ToBytes(nameBytes.length),
      0, 0,
      0, 0,
      0, 0,
      0, 0,
      0, 0, 0, 0,
      ...uint32ToBytes(offset),
    ]);
    centralParts.push(concatUint8Arrays([centralHeader, nameBytes]));
    offset += localPart.length;
  });

  const centralDirectory = concatUint8Arrays(centralParts);
  const localDirectory = concatUint8Arrays(localParts);
  const endRecord = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,
    0, 0,
    0, 0,
    ...uint16ToBytes(files.length),
    ...uint16ToBytes(files.length),
    ...uint32ToBytes(centralDirectory.length),
    ...uint32ToBytes(localDirectory.length),
    0, 0,
  ]);

  return concatUint8Arrays([localDirectory, centralDirectory, endRecord]);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createDocxBytes(text: string, options: DownloadDocumentOptions): Uint8Array {
  const encoder = new TextEncoder();
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const preset = getPresetConfig(options.preset ?? "document");
  const alignment = getDocxAlignmentValue(options.alignment ?? "justify");
  const fontSize = String(Math.round(preset.fontSize * 2));
  const lineRule = String(Math.round(preset.lineHeight * 20));
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
  <w:body>
    ${paragraphs
      .map((paragraph) =>
        paragraph
          ? `<w:p><w:pPr><w:jc w:val="${alignment}"/><w:spacing w:line="${lineRule}" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="${xmlEscape(preset.fontFamily)}" w:hAnsi="${xmlEscape(preset.fontFamily)}" w:cs="${xmlEscape(preset.fontFamily)}"/><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(paragraph)}</w:t></w:r></w:p>`
          : `<w:p><w:pPr><w:jc w:val="${alignment}"/><w:spacing w:line="${lineRule}" w:lineRule="auto"/></w:pPr></w:p>`
      )
      .join("")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const files = [
    {
      name: "[Content_Types].xml",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
    },
    {
      name: "_rels/.rels",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
    },
    {
      name: "word/document.xml",
      data: encoder.encode(documentXml),
    },
  ];

  return createStoredZip(files);
}

function createRtfContent(text: string, options: DownloadDocumentOptions): string {
  const preset = getPresetConfig(options.preset ?? "document");
  const fontTable = `{\\fonttbl{\\f0 ${preset.fontFamily};}}`;
  const fontSize = Math.round(preset.fontSize * 2);
  const alignment =
    options.alignment === "center"
      ? "\\qc"
      : options.alignment === "right"
        ? "\\qr"
        : options.alignment === "justify"
          ? "\\qj"
          : "\\ql";
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "\\par\n");
  return `{\\rtf1\\ansi\\deff0${fontTable}\n${alignment}\\f0\\fs${fontSize}\n${escaped}\n}`;
}

function createDocHtmlContent(text: string, options: DownloadDocumentOptions): string {
  const preset = getPresetConfig(options.preset ?? "document");
  const alignment = options.alignment ?? "justify";
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const htmlBody = paragraphs
    .map((paragraph) =>
      paragraph.trim()
        ? `<p style="margin:0 0 12pt 0;text-align:${alignment};">${xmlEscape(paragraph)}</p>`
        : `<p style="margin:0 0 12pt 0;">&nbsp;</p>`
    )
    .join("");
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family: "${preset.fontFamily}", serif;
        font-size: ${Math.max(12, Math.round(preset.fontSize * 0.7))}pt;
        line-height: 1.45;
        margin: 1in;
        color: #111827;
      }
    </style>
  </head>
  <body>${htmlBody}</body>
</html>`;
}

function createOdtBytes(text: string, options: DownloadDocumentOptions): Uint8Array {
  const encoder = new TextEncoder();
  const preset = getPresetConfig(options.preset ?? "document");
  const alignment =
    options.alignment === "center"
      ? "center"
      : options.alignment === "right"
        ? "end"
        : options.alignment === "justify"
          ? "justify"
          : "start";
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const paragraphXml = paragraphs
    .map((paragraph) =>
      paragraph.trim()
        ? `<text:p text:style-name="P1">${xmlEscape(paragraph)}</text:p>`
        : `<text:p text:style-name="P1"/>`
    )
    .join("");

  const files = [
    {
      name: "mimetype",
      data: encoder.encode("application/vnd.oasis.opendocument.text"),
    },
    {
      name: "content.xml",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="P1" style:family="paragraph">
      <style:paragraph-properties fo:text-align="${alignment}" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"/>
      <style:text-properties style:font-name="${xmlEscape(preset.fontFamily)}" fo:font-size="${Math.max(12, Math.round(preset.fontSize * 0.7))}pt" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      ${paragraphXml}
    </office:text>
  </office:body>
</office:document-content>`),
    },
    {
      name: "styles.xml",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  office:version="1.2">
  <office:styles/>
</office:document-styles>`),
    },
    {
      name: "META-INF/manifest.xml",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest
  xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"
  manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`),
    },
  ];

  return createStoredZip(files);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function createPdfObject(id: number, body: string | Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const head = encoder.encode(`${id} 0 obj\n`);
  const tail = encoder.encode(`\nendobj\n`);
  const bodyBytes = typeof body === "string" ? encoder.encode(body) : body;
  return concatUint8Arrays([head, bodyBytes, tail]);
}

async function createPdfBytes(text: string, options: DownloadDocumentOptions): Promise<Uint8Array> {
  const pageWidth = 1240;
  const pageHeight = 1754;
  const marginX = 96;
  const marginTop = 110;
  const marginBottom = 110;
  const preset = getPresetConfig(options.preset ?? "document");
  const alignment = options.alignment ?? "justify";

  const imagePayloads: Array<{ bytes: Uint8Array; width: number; height: number }> = [];
  let remainingLines: string[] | null = null;

  while (remainingLines === null || remainingLines.length > 0) {
    const canvas = document.createElement("canvas");
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas is not available");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageWidth, pageHeight);
    ctx.fillStyle = "#111827";
    ctx.font = `${preset.fontSize}px "${preset.fontFamily}"`;
    ctx.textBaseline = "top";
    const maxWidth = pageWidth - marginX * 2;
    const allLines: string[] = remainingLines ?? wrapTextForCanvas(ctx, text, maxWidth);
    const linesPerPage = Math.max(1, Math.floor((pageHeight - marginTop - marginBottom) / preset.lineHeight));
    const pageLines = allLines.slice(0, linesPerPage);
    remainingLines = allLines.slice(linesPerPage);

    pageLines.forEach((line: string, index: number) => {
      drawAlignedLine(
        ctx,
        line,
        alignment,
        marginX,
        marginTop + index * preset.lineHeight,
        maxWidth,
        index === pageLines.length - 1
      );
    });

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    imagePayloads.push({
      bytes: base64ToUint8Array(dataUrl.split(",")[1] ?? ""),
      width: pageWidth,
      height: pageHeight,
    });
  }

  const encoder = new TextEncoder();
  const objects: Uint8Array[] = [];
  const objectOffsets: number[] = [0];
  let nextId = 3;
  const pageRefs: number[] = [];

  imagePayloads.forEach((image, index) => {
    const imageId = nextId;
    const pageId = nextId + 1;
    const contentId = nextId + 2;
    nextId += 3;
    pageRefs.push(pageId);

    objects.push(
      createPdfObject(
        imageId,
        concatUint8Arrays([
          encoder.encode(
            `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`
          ),
          image.bytes,
          encoder.encode("\nendstream"),
        ])
      )
    );

    objects.push(
      createPdfObject(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
      )
    );

    objects.push(
      createPdfObject(
        contentId,
        `<< /Length 39 >>\nstream\nq\n595 0 0 842 0 0 cm\n/Im${index + 1} Do\nQ\nendstream`
      )
    );
  });

  const catalog = createPdfObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  const pages = createPdfObject(2, `<< /Type /Pages /Kids [${pageRefs.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`);
  const allObjects = [catalog, pages, ...objects];

  let offset = encoder.encode("%PDF-1.4\n%\xC2\xA5\xC2\xB1\xC3\xAB\n").length;
  allObjects.forEach((object) => {
    objectOffsets.push(offset);
    offset += object.length;
  });

  const xrefStart = offset;
  const xrefRows = ["0000000000 65535 f "];
  for (let id = 1; id < objectOffsets.length; id += 1) {
    xrefRows.push(`${String(objectOffsets[id]).padStart(10, "0")} 00000 n `);
  }

  const trailer = encoder.encode(
    `xref\n0 ${objectOffsets.length}\n${xrefRows.join("\n")}\ntrailer\n<< /Size ${objectOffsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  );

  return concatUint8Arrays([encoder.encode("%PDF-1.4\n%\xC2\xA5\xC2\xB1\xC3\xAB\n"), ...allObjects, trailer]);
}

export async function downloadDocumentFile(
  text: string,
  format: DownloadDocumentFormat,
  baseName = "document-analyzer-edited",
  options: DownloadDocumentOptions = {}
): Promise<void> {
  if (format === "txt") {
    saveBlob([text], "text/plain;charset=utf-8", normalizeFilename(baseName, "txt"));
    return;
  }

  if (format === "md") {
    saveBlob([text], "text/markdown;charset=utf-8", normalizeFilename(baseName, "md"));
    return;
  }

  if (format === "rtf") {
    saveBlob([createRtfContent(text, options)], "application/rtf", normalizeFilename(baseName, "rtf"));
    return;
  }

  if (format === "doc") {
    saveBlob([createDocHtmlContent(text, options)], "application/msword", normalizeFilename(baseName, "doc"));
    return;
  }

  if (format === "docx") {
    const bytes = createDocxBytes(text, options);
    saveBlob(
      [asBlobPart(bytes)],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      normalizeFilename(baseName, "docx")
    );
    return;
  }

  if (format === "odt") {
    const bytes = createOdtBytes(text, options);
    saveBlob(
      [asBlobPart(bytes)],
      "application/vnd.oasis.opendocument.text",
      normalizeFilename(baseName, "odt")
    );
    return;
  }

  const pdfBytes = await createPdfBytes(text, options);
  saveBlob([asBlobPart(pdfBytes)], "application/pdf", normalizeFilename(baseName, "pdf"));
}

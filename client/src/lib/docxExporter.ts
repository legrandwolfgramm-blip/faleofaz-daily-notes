/**
 * docxExporter.ts
 * Generates a .docx that matches the FaleOfaz daily report PDF format exactly:
 * - FaleOfaz header with company name and client info
 * - 4-column table: Date | Code | Staff on duty | Behavior/Activity
 * - Yellow header row
 * - Activity bullet lines followed by narrative paragraph in one cell
 */

import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  VerticalAlign,
  PageOrientation,
  convertInchesToTwip,
} from "docx";
import type { ClientReport, ReportRow } from "./reportProcessor";

// Colors
const NAVY = "1E3A5F";
const YELLOW_FILL = "FACC15";
const WHITE = "FFFFFF";
const LIGHT_BLUE = "EFF6FF";
const LIGHT_GRAY = "F8FAFC";
const ORANGE_LIGHT = "FFF7ED";

function makePara(
  text: string,
  opts: { bold?: boolean; size?: number; color?: string; italic?: boolean; spaceAfter?: number; spaceBefore?: number } = {}
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: opts.bold ?? false,
        size: opts.size ?? 20,
        color: opts.color ?? "000000",
        italic: opts.italic ?? false,
        font: "Calibri",
      }),
    ],
    alignment: AlignmentType.LEFT,
    spacing: { before: opts.spaceBefore ?? 40, after: opts.spaceAfter ?? 40 },
  });
}

function makeCell(
  paragraphs: Paragraph[],
  widthTwips: number | undefined,
  bgColor: string = WHITE,
  bold = false
): TableCell {
  return new TableCell({
    children: paragraphs.length ? paragraphs : [new Paragraph({ children: [] })],
    width: widthTwips ? { size: widthTwips, type: WidthType.DXA } : undefined,
    shading: { fill: bgColor, type: ShadingType.CLEAR, color: "auto" },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
    },
  });
}

function buildDataRow(row: ReportRow): TableRow {
  const isMTP = row.rowType === "mtp";
  const isGraves = row.rowType === "rhs_on";
  const isAbove = row.isAboveBaseline;

  const bg = isAbove ? ORANGE_LIGHT : isMTP ? LIGHT_BLUE : isGraves ? LIGHT_GRAY : WHITE;

  const codeColor = isMTP ? "1D4ED8" : isGraves ? "64748B" : "1E3A5F";

  // Build the content cell with strict FaleOfaz format:
  // Activities: heading → bullet lines → Narrative: heading → paragraph → IR line (if applicable)
  const activityParagraphs: Paragraph[] = [];

  const isMTPRow = row.rowType === "mtp";

  if (!isMTPRow && row.activities.length > 0) {
    // "Activities:" label
    activityParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "Activities:", bold: true, size: 20, color: "1E3A5F", font: "Calibri" })],
        spacing: { before: 40, after: 20 },
      })
    );
  }

  for (const line of row.activities) {
    activityParagraphs.push(makePara(line, { size: 20 }));
  }

  if (!isMTPRow && row.narrative) {
    // "Narrative:" label
    activityParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "Narrative:", bold: true, size: 20, color: "1E3A5F", font: "Calibri" })],
        spacing: { before: row.activities.length ? 100 : 40, after: 20 },
      })
    );
  }

  if (row.narrative) {
    // Narrative may contain \n\n-separated paragraphs (prose overflow + behavior summary)
    const narrativeParts = row.narrative.split("\n\n").map(p => p.trim()).filter(Boolean);
    narrativeParts.forEach((part) => {
      activityParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: part, size: 20, font: "Calibri" })],
          spacing: { before: 20, after: 40 },
        })
      );
    });
  }

  if (row.irSubmitted) {
    activityParagraphs.push(
      makePara("IR report submitted.", { size: 18, color: "DC2626", bold: true, spaceBefore: 80 })
    );
  }
  if (row.thinSummary) {
    activityParagraphs.push(
      makePara("⚠ Behavior summary needs more detail — staff should expand this note.", {
        size: 17,
        color: "F59E0B",
        bold: true,
      })
    );
  }

  return new TableRow({
    children: [
      // Date
      makeCell([makePara(row.date, { size: 20 })], 1350, bg),
      // Code
      makeCell([
        new Paragraph({
          children: [new TextRun({ text: row.code, bold: true, size: 20, color: codeColor, font: "Calibri" })],
          spacing: { before: 40, after: 40 },
        }),
      ], 1400, bg),
      // Staff
      makeCell([makePara(row.staffOnDuty, { size: 20 })], 2000, bg),
      // Behavior/Activity
      makeCell(activityParagraphs.length ? activityParagraphs : [makePara("")], undefined, bg),
    ],
  });
}

function yellowHeaderRow(): TableRow {
  const cell = (text: string, width?: number) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: 22, color: NAVY, font: "Calibri" })],
          spacing: { before: 60, after: 60 },
        }),
      ],
      width: width ? { size: width, type: WidthType.DXA } : undefined,
      shading: { fill: YELLOW_FILL, type: ShadingType.CLEAR, color: "auto" },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: "EAB308" },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "EAB308" },
        left: { style: BorderStyle.SINGLE, size: 6, color: "EAB308" },
        right: { style: BorderStyle.SINGLE, size: 6, color: "EAB308" },
      },
    });

  return new TableRow({
    children: [
      cell("Date", 1350),
      cell("Code", 1400),
      cell("Staff on duty", 2000),
      cell("Behavior/Activity"),
    ],
    tableHeader: true,
  });
}

export async function generateClientDocx(report: ClientReport, pid: string): Promise<Blob> {
  const pidStr = pid || "—";

  // Header paragraphs
  const headerParas = [
    new Paragraph({
      children: [new TextRun({ text: "Fale Ofaz LLC", bold: true, size: 28, color: NAVY, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Daily Reports: ${report.month} | Code: ${report.serviceCodes.join(", ")}`,
          size: 22,
          color: NAVY,
          font: "Calibri",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `| Client: ${report.clientName} | Client Identification #: ${pidStr} |`,
          size: 22,
          color: NAVY,
          font: "Calibri",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Time: AM: Morning | PM: Afternoon&Evening | ON: Overnight",
          size: 18,
          color: "64748B",
          font: "Calibri",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
    }),
  ];

  // Main table
  const mainTable = new Table({
    rows: [yellowHeaderRow(), ...report.rows.map(buildDataRow)],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
      insideH: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
      insideV: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
    },
  });

  // Incident summary (if any)
  const incidentRows = report.rows.filter(r => r.irSubmitted);
  const incidentSection: Paragraph[] = [];
  if (incidentRows.length > 0) {
    incidentSection.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Incident Reports Filed", bold: true, size: 24, color: "DC2626", font: "Calibri" }),
        ],
        spacing: { before: 400, after: 120 },
      })
    );
    for (const row of incidentRows) {
      incidentSection.push(
        new Paragraph({
          children: [
            new TextRun({ text: row.date + " — ", bold: true, size: 20, color: "DC2626", font: "Calibri" }),
            new TextRun({ text: row.irSummary || "IR submitted", size: 20, font: "Calibri" }),
          ],
          spacing: { after: 80 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: {
              top: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
            },
          },
        },
        children: [
          ...headerParas,
          mainTable,
          ...incidentSection,
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

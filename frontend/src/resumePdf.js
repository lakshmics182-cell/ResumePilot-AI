import { jsPDF } from "jspdf";

/*
 * Builds an ATS-friendly resume PDF from structured data.
 * The text is real (selectable and machine-readable), not an image.
 * The look follows the template the person chose in the builder.
 *
 * data = {
 *   name, jobTitle, contact: ["email", "phone", ...], summary,
 *   sections: [
 *     { heading, entries: [{ title, bullets: [] }] },
 *     { heading, lines: ["text", ...] },
 *   ],
 * }
 * template = "classic" | "modern" | "minimal" | "professional" | "executive" | "clean"
 */
const TEMPLATES = {
  classic: {
    font: "helvetica",
    align: "center",
    nameSize: 20,
    nameColor: [34, 38, 51],
    jobColor: [90, 95, 115],
    contactColor: [110, 105, 125],
    headerRule: { width: 1.6, color: [52, 57, 79] },
    headingColor: [52, 71, 109],
    headingRule: { width: 0.8, color: [158, 165, 181] },
    entryColor: [30, 28, 40],
    bodyColor: [70, 66, 80],
  },
  modern: {
    font: "helvetica",
    align: "left",
    nameSize: 25,
    nameColor: [41, 52, 93],
    jobColor: [79, 99, 216],
    contactColor: [100, 105, 130],
    headerBar: [79, 99, 216],
    headingColor: [79, 99, 216],
    headingRule: { width: 1.6, color: [223, 227, 243] },
    entryColor: [41, 52, 93],
    bodyColor: [70, 66, 80],
  },
  minimal: {
    font: "helvetica",
    align: "left",
    margin: 62,
    nameSize: 22,
    nameColor: [51, 51, 51],
    jobColor: [85, 85, 85],
    contactColor: [110, 110, 110],
    headingColor: [68, 68, 68],
    headingSize: 10,
    headingSpacing: 1.2,
    headingRule: null,
    sectionGap: 14,
    entryColor: [40, 40, 40],
    bodyColor: [69, 69, 69],
  },
  professional: {
    font: "helvetica",
    align: "left",
    nameSize: 22,
    nameColor: [38, 59, 104],
    jobColor: [57, 77, 117],
    contactColor: [90, 100, 125],
    headerFill: [244, 246, 250],
    headerBar: [38, 59, 104],
    headingColor: [38, 59, 104],
    headingRule: { width: 1.6, color: [38, 59, 104] },
    entryColor: [38, 59, 104],
    bodyColor: [60, 60, 75],
  },
  clean: {
    font: "helvetica",
    align: "left",
    margin: 58,
    nameSize: 24,
    nameColor: [34, 34, 34],
    jobColor: [85, 85, 85],
    contactColor: [100, 100, 100],
    headerRule: { width: 0.8, color: [100, 116, 139] },
    headingColor: [34, 34, 34],
    headingSize: 10.5,
    headingRule: { width: 0.8, color: [34, 34, 34] },
    sectionGap: 12,
    entryColor: [34, 34, 34],
    bodyColor: [60, 60, 60],
  },
  executive: {
    font: "times",
    headingFont: "helvetica",
    align: "center",
    nameSize: 25,
    nameColor: [34, 34, 34],
    jobColor: [68, 68, 68],
    jobSpacing: 1.5,
    contactColor: [90, 90, 90],
    headerRule: "double",
    headingColor: [51, 51, 51],
    headingSize: 10.5,
    headingSpacing: 1,
    headingRule: { width: 0.8, color: [51, 51, 51] },
    entryColor: [37, 37, 37],
    bodyColor: [50, 50, 50],
    bodySize: 10,
  },
};

export function buildResumePdf(data, template = "classic") {
  const t = TEMPLATES[template] || TEMPLATES.classic;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = t.margin || 50;
  const contentWidth = pageWidth - margin * 2;
  const bodySize = t.bodySize || 9.5;

  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const setText = ({
    font = t.font,
    style = "normal",
    size = 10,
    color = t.bodyColor,
    charSpace = 0,
  } = {}) => {
    pdf.setFont(font, style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.setCharSpace(charSpace);
  };

  const addLines = (text, options = {}) => {
    if (!text) {
      return;
    }

    const {
      gap = 13,
      align = "left",
      x = margin,
      width = contentWidth,
    } = options;

    setText(options);

    pdf.splitTextToSize(String(text), width).forEach((line) => {
      ensureSpace(gap);
      pdf.text(line, x, y, { align });
      y += gap;
    });

    pdf.setCharSpace(0);
  };

  const addHeading = (heading) => {
    y += t.sectionGap || 8;
    ensureSpace(28);

    setText({
      font: t.headingFont || t.font,
      style: "bold",
      size: t.headingSize || 11,
      color: t.headingColor,
      charSpace: t.headingSpacing || 0,
    });
    pdf.text(heading, margin, y);
    pdf.setCharSpace(0);

    if (t.headingRule) {
      y += 5;
      pdf.setDrawColor(...t.headingRule.color);
      pdf.setLineWidth(t.headingRule.width);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 14;
    } else {
      y += 15;
    }
  };

  // ---------------- header ----------------
  const name = data.name || "Your Name";
  const jobTitle = (data.jobTitle || "").toUpperCase();
  const contactLine = (data.contact || []).filter(Boolean).join("   |   ");

  const boxed = Boolean(t.headerFill || t.headerBar);
  const padX = t.headerFill ? 18 : t.headerBar ? 16 : 0;
  const padY = t.headerFill ? 14 : 0;
  const textWidth = contentWidth - padX * (t.headerFill ? 2 : 1);
  const textX = t.align === "center" ? pageWidth / 2 : margin + padX;
  const nameGap = t.nameSize + 6;

  setText({ style: "normal", size: 9.5 });
  const contactLines = contactLine
    ? pdf.splitTextToSize(contactLine, textWidth)
    : [];

  if (boxed) {
    const blockHeight =
      padY * 2 +
      nameGap +
      (jobTitle ? 15 : 0) +
      contactLines.length * 12.5 +
      2;

    ensureSpace(blockHeight);

    if (t.headerFill) {
      pdf.setFillColor(...t.headerFill);
      pdf.rect(margin, y, contentWidth, blockHeight, "F");
    }

    if (t.headerBar) {
      pdf.setFillColor(...t.headerBar);
      pdf.rect(margin, y, 4, blockHeight, "F");
    }

    y += padY + t.nameSize;
  } else {
    y += t.nameSize - 8;
  }

  addLines(name, {
    font: t.font,
    size: t.nameSize,
    style: "bold",
    gap: nameGap,
    align: t.align,
    x: textX,
    width: textWidth,
    color: t.nameColor,
  });

  if (jobTitle) {
    addLines(jobTitle, {
      font: t.font === "times" ? "helvetica" : t.font,
      size: 9.5,
      style: "bold",
      gap: 15,
      align: t.align,
      x: textX,
      width: textWidth,
      color: t.jobColor,
      charSpace: t.jobSpacing || 0.4,
    });
  }

  contactLines.forEach((line) => {
    setText({ size: 9.5, color: t.contactColor });
    ensureSpace(12.5);
    pdf.text(line, textX, y, { align: t.align });
    y += 12.5;
  });

  if (boxed) {
    y += padY + 12;
  } else if (t.headerRule === "double") {
    y += 6;
    pdf.setDrawColor(51, 51, 51);
    pdf.setLineWidth(1.6);
    pdf.line(margin, y, pageWidth - margin, y);
    pdf.setLineWidth(0.6);
    pdf.line(margin, y + 3.5, pageWidth - margin, y + 3.5);
    y += 20;
  } else if (t.headerRule) {
    y += 6;
    pdf.setDrawColor(...t.headerRule.color);
    pdf.setLineWidth(t.headerRule.width);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 18;
  } else {
    y += 14;
  }

  // ---------------- body ----------------
  const body = { size: bodySize, gap: 12.5, color: t.bodyColor };

  if (data.summary) {
    addHeading("PROFESSIONAL SUMMARY");
    addLines(data.summary, { ...body, gap: 13 });
    y += 6;
  }

  (data.sections || []).forEach((section) => {
    const hasEntries = section.entries && section.entries.length > 0;
    const hasLines = section.lines && section.lines.some(Boolean);

    if (!hasEntries && !hasLines) {
      return;
    }

    addHeading(section.heading);

    if (hasEntries) {
      section.entries.forEach((entry) => {
        if (entry.title) {
          addLines(entry.title, {
            size: 10.5,
            style: "bold",
            color: t.entryColor,
          });
        }

        (entry.bullets || []).forEach((bullet) => {
          addLines(`•  ${bullet}`, body);
        });

        y += 6;
      });
    }

    if (hasLines) {
      section.lines.filter(Boolean).forEach((line) => {
        addLines(line, body);
      });

      y += 6;
    }
  });

  pdf.setLineWidth(0.2);
  return pdf;
}

export function downloadResumePdf(data, fileName, template = "classic") {
  const pdf = buildResumePdf(data, template);

  const safeName = (
    fileName ||
    `${(data.name || "Resume").trim().replace(/\s+/g, "_")}_Improved_Resume`
  ).replace(/\.pdf$/i, "");

  pdf.save(`${safeName}.pdf`);
}

/*
 * Cover letter PDF: plain, ATS-friendly, real selectable text.
 * `text` is the letter exactly as shown in the editor.
 */
export function downloadLetterPdf(text, fileName) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 60;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 15;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 40);

  let y = margin;

  String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((paragraph) => {
      // Blank line = paragraph gap.
      if (!paragraph.trim()) {
        y += lineHeight * 0.7;
        return;
      }

      pdf.splitTextToSize(paragraph, contentWidth).forEach((line) => {
        if (y + lineHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }

        pdf.text(line, margin, y);
        y += lineHeight;
      });
    });

  const safeName = (fileName || "Cover_Letter").replace(/\.pdf$/i, "");

  pdf.save(`${safeName}.pdf`);
}

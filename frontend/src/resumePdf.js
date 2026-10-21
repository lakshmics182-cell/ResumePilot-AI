import { jsPDF } from "jspdf";

/*
 * Builds an ATS-friendly resume PDF from structured data.
 * The text is real (selectable and machine-readable), not an image.
 *
 * data = {
 *   name, contact: ["email", "phone", ...], summary,
 *   sections: [
 *     { heading, entries: [{ title, bullets: [] }] },
 *     { heading, lines: ["text", ...] },
 *   ],
 * }
 */
export function buildResumePdf(data) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const addLines = (
    text,
    {
      size = 10,
      style = "normal",
      gap = 13,
      color = [40, 36, 50],
      align = "left",
      x = margin,
    } = {}
  ) => {
    if (!text) {
      return;
    }

    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);

    pdf
      .splitTextToSize(String(text), contentWidth)
      .forEach((line) => {
        ensureSpace(gap);
        pdf.text(line, x, y, { align });
        y += gap;
      });
  };

  const addHeading = (heading) => {
    y += 8;
    ensureSpace(26);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(70, 55, 160);
    pdf.text(heading, margin, y);
    y += 5;

    pdf.setDrawColor(210, 205, 225);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 14;
  };

  // Header
  addLines(data.name || "Your Name", {
    size: 20,
    style: "bold",
    gap: 24,
    align: "center",
    x: pageWidth / 2,
    color: [20, 18, 30],
  });

  const contactLine = (data.contact || [])
    .filter(Boolean)
    .join("   |   ");

  if (contactLine) {
    addLines(contactLine, {
      size: 9.5,
      align: "center",
      x: pageWidth / 2,
      color: [110, 105, 125],
    });
  }

  y += 8;
  ensureSpace(4);
  pdf.setDrawColor(40, 36, 50);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 18;

  if (data.summary) {
    addHeading("PROFESSIONAL SUMMARY");
    addLines(data.summary, {
      size: 9.5,
      color: [70, 66, 80],
    });
    y += 6;
  }

  (data.sections || []).forEach((section) => {
    const hasEntries =
      section.entries && section.entries.length > 0;
    const hasLines =
      section.lines && section.lines.some(Boolean);

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
            color: [30, 28, 40],
          });
        }

        (entry.bullets || []).forEach((bullet) => {
          addLines(`•  ${bullet}`, {
            size: 9.5,
            gap: 12,
            color: [70, 66, 80],
          });
        });

        y += 6;
      });
    }

    if (hasLines) {
      section.lines.filter(Boolean).forEach((line) => {
        addLines(line, {
          size: 9.5,
          gap: 12,
          color: [70, 66, 80],
        });
      });

      y += 6;
    }
  });

  return pdf;
}

export function downloadResumePdf(data, fileName) {
  const pdf = buildResumePdf(data);

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

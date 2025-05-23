const EPub = require("epub");
const fs = require("fs");

const epubFile = "garant_grajdansky_kodeks_rf.epub";
const outputFile = "gk_rf_structured_flat.json";
const CHAR_LIMIT = 20_000_000;

const epub = new EPub(epubFile);
const structured = [];

let currentSection = "";
let currentSubsection = "";
let currentChapter = "";

/** Удаляет HTML и чистит текст */
function clean(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Определяет часть по номеру статьи */
function detectPart(articleNumber) {
  const num = parseInt(articleNumber, 10);
  if (num >= 1 && num <= 453) return "ГК РФ, часть 1";
  if (num >= 454 && num <= 1109) return "ГК РФ, часть 2";
  if (num >= 1110 && num <= 1186) return "ГК РФ, часть 3";
  if (num >= 1225 && num <= 1551) return "ГК РФ, часть 4";
  return "ГК РФ, неизвестная часть";
}

/** Основная логика парсинга */
function processByRegex(bigText) {
  const result = [];

  const lines = bigText.split(/(?=\s*(?:Раздел|Подраздел|Глава|Статья)\s)/g);

  for (const block of lines) {
    const trimmed = block.trim();

    if (/^Раздел\s/i.test(trimmed)) {
      currentSection = trimmed;
    } else if (/^Подраздел\s/i.test(trimmed)) {
      currentSubsection = trimmed;
    } else if (/^Глава\s/i.test(trimmed)) {
      currentChapter = trimmed;
    } else if (/^Статья\s+\d+/.test(trimmed)) {
      const articleMatch = trimmed.match(/^Статья\s+(\d+)[.:]?\s*(.+?)(?=\d+\.\s|$)/s);
      if (!articleMatch) continue;

      const article = articleMatch[1];
      const articleTitle = articleMatch[2].trim();
      const part = detectPart(article);

      const blockWithoutTitle = trimmed.replace(/^Статья\s+\d+[.:]?\s*.+?(?=\d+\.\s|$)/s, "").trim();
      const points = blockWithoutTitle.split(/(?=\d+\.\s)/g);

      for (const pointBlock of points) {
        const pointMatch = pointBlock.match(/^(\d+)\.\s+(.*)/s);
        if (pointMatch) {
          const point = pointMatch[1];
          const text = pointMatch[2].trim();

          result.push({
            document: "ГК РФ",
            part,
            section: currentSection,
            subsection: currentSubsection,
            chapter: currentChapter,
            article,
            article_title: articleTitle,
            point,
            text
          });
        } else if (pointBlock.length > 10) {
          result.push({
            document: "ГК РФ",
            part,
            section: currentSection,
            subsection: currentSubsection,
            chapter: currentChapter,
            article,
            article_title: articleTitle,
            point: null,
            text: pointBlock.trim()
          });
        }
      }
    }
  }

  return result;
}

/** Основной цикл загрузки */
epub.on("end", async () => {
  console.log(`📘 EPUB загружен. Глав в книге: ${epub.flow.length}`);

  let combinedText = "";

  for (let chapter of epub.flow) {
    if (combinedText.length >= CHAR_LIMIT) break;

    await new Promise((resolve, reject) => {
      epub.getChapter(chapter.id, (err, text) => {
        if (err) return reject(err);
        combinedText += clean(text) + " ";
        resolve();
      });
    });
  }

  const limitedText = combinedText.slice(0, CHAR_LIMIT);
  const structuredPart = processByRegex(limitedText);
  structured.push(...structuredPart);

  fs.writeFileSync(outputFile, JSON.stringify(structured, null, 2), "utf-8");
  console.log(`✅ Готово. Сохранено: ${structured.length} пунктов → ${outputFile}`);
});

epub.on("error", (err) => {
  console.error("❌ EPUB ошибка:", err);
});

epub.parse();
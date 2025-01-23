const XLSX = require('xlsx');
const cheerio = require('cheerio');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается. Используйте POST.' });
    }

    const htmlContent = req.body.html; // HTML-файл передаётся как текст

    if (!htmlContent) {
        return res.status(400).json({ error: 'HTML-файл не предоставлен.' });
    }

    // Парсинг HTML и извлечение текстов
    const $ = cheerio.load(htmlContent);
    const data = [['Original Text', 'Translation']];
    const processedTexts = new Set();

    $('*').each((index, element) => {
        const tag = $(element);

        // Пропускаем теги <script>
        if (element.type === 'tag' && element.tagName === 'script') {
            return;
        }

        // Извлекаем текстовые узлы
        if (element.type === 'text' && element.data) {
            const text = element.data.trim().replace(/\s+/g, ' ');
            if (text && !processedTexts.has(text)) {
                data.push([text, '']);
                processedTexts.add(text);
            }
        }

        // Извлекаем атрибуты
        ['alt', 'title', 'placeholder'].forEach(attr => {
            const attrValue = tag.attr(attr)?.trim().replace(/\s+/g, ' ');
            if (attrValue && !processedTexts.has(attrValue)) {
                data.push([attrValue, '']);
                processedTexts.add(attrValue);
            }
        });
    });

    // Создаём Excel-файл
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Translations');

    // Генерируем файл и отправляем в виде buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', 'attachment; filename="translations.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.status(200).send(excelBuffer);
}

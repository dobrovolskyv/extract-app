const XLSX = require('xlsx');
const cheerio = require('cheerio');
const fetch = require('node-fetch'); // Для загрузки HTML по ссылке

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается. Используйте POST.' });
    }

    let htmlContent;

    // Проверяем, пришёл ли HTML или URL
    if (req.body.html) {
        htmlContent = req.body.html; // HTML передаётся напрямую
    } else if (req.body.url) {
        try {
            // Загружаем HTML по указанной ссылке
            const response = await fetch(req.body.url);
            if (!response.ok) {
                return res.status(400).json({ error: 'Ошибка загрузки HTML по ссылке.' });
            }
            htmlContent = await response.text();
        } catch (error) {
            return res.status(500).json({ error: 'Ошибка при загрузке HTML.', details: error.message });
        }
    } else {
        return res.status(400).json({ error: 'Не предоставлен HTML или URL.' });
    }

    // Парсинг HTML и извлечение текстов
    const $ = cheerio.load(htmlContent);
    const data = [['Original Text', 'Translation']];
    const processedTexts = new Set();

    const traverseAndExtract = (element, index = 0) => {
        const tag = $(element);

        // Пропускаем теги <script>
        if (element.type === 'tag' && element.tagName === 'script') {
            return;
        }

        // Извлекаем текстовые узлы
        if (element.type === 'text' && element.data) {
            const text = element.data.trim().replace(/\s+/g, ' '); // Удаляем лишние пробелы
            if (text && !processedTexts.has(text)) {
                data.push([text, '']); // Добавляем текст в Excel
                processedTexts.add(text);
            }
        }

        // Извлекаем атрибуты
        if (element.type === 'tag') {
            ['alt', 'title', 'placeholder'].forEach(attr => {
                const attrValue = tag.attr(attr)?.trim().replace(/\s+/g, ' '); // Удаляем лишние пробелы
                if (attrValue && !processedTexts.has(attrValue)) {
                    data.push([attrValue, '']); // Добавляем атрибут в Excel
                    processedTexts.add(attrValue);
                }
            });

            // Обходим дочерние узлы
            let childIndex = 0;
            tag.contents().each((_, child) => {
                traverseAndExtract(child, `${index}_${childIndex}`);
                childIndex++;
            });
        }
    };

    // Обходим весь DOM
    $('*').each((index, element) => traverseAndExtract(element, index));

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

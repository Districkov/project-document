const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const UPLOADS_DIR = './uploads';
const FRONTEND_DIR = '../frontend';

// Создаем папки если нет
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
    console.log('✅ Папка uploads создана');
}

const DB_PATH = './database.json';

// База данных по умолчанию
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ documents: [] }, null, 2));
    console.log('✅ База данных создана');
}

function readDatabase() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log('❌ Ошибка чтения базы данных:', error);
        return { documents: [] };
    }
}

function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.log('❌ Ошибка записи в базу данных:', error);
        return false;
    }
}

// Функция для обработки JSON загрузки
function handleJsonUpload(req, res) {
    let body = '';
    
    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', () => {
        try {
            const data = JSON.parse(body || '{}');
            const db = readDatabase();
            
            const newDocument = {
                id: Date.now().toString(),
                name: data.documentName || 'Документ ' + Date.now(),
                originalName: data.originalName || 'document',
                filename: 'doc-' + Date.now() + '.txt',
                type: 'file',
                category: data.documentCategory || 'general',
                url: '/uploads/doc-' + Date.now() + '.txt',
                uploadDate: new Date().toISOString(),
                isNew: true
            };

            db.documents.unshift(newDocument);
            const writeSuccess = writeDatabase(db);

            if (writeSuccess) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    document: newDocument,
                    message: 'Документ добавлен'
                }));
            } else {
                throw new Error('Failed to save to database');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
    });
}

// Вспомогательные функции для парсинга multipart/form-data
function splitMultipartBody(body, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from('\r\n--' + boundary);
    let start = body.indexOf(boundaryBuffer) + boundaryBuffer.length + 2;
    
    if (start === -1) {
        const altBoundaryBuffer = Buffer.from('--' + boundary);
        start = body.indexOf(altBoundaryBuffer) + altBoundaryBuffer.length + 2;
    }
    
    while (start < body.length && start !== -1) {
        const end = body.indexOf(boundaryBuffer, start);
        if (end === -1) break;
        
        const part = body.slice(start, end - 2);
        parts.push(part);
        start = end + boundaryBuffer.length + 2;
    }
    
    return parts;
}

function parseMultipartParts(parts) {
    const result = {};
    
    for (const part of parts) {
        const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
        if (headerEnd === -1) continue;
        
        const headers = part.slice(0, headerEnd).toString();
        const content = part.slice(headerEnd + 4);
        
        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        
        if (nameMatch) {
            const name = nameMatch[1];
            
            if (filenameMatch) {
                result.file = {
                    filename: filenameMatch[1],
                    content: content
                };
            } else {
                result[name] = content.toString().trim();
            }
        }
    }
    
    return result;
}

// Функция для обработки загрузки файлов
function handleFileUpload(req, res) {
    const contentType = req.headers['content-type'];
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    
    if (!boundaryMatch) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'No boundary found' }));
        return;
    }
    
    const boundary = boundaryMatch[1];
    let body = Buffer.alloc(0);
    
    req.on('data', chunk => {
        body = Buffer.concat([body, chunk]);
    });

    req.on('end', () => {
        try {
            const parts = splitMultipartBody(body, boundary);
            
            if (parts.length === 0) {
                throw new Error('No parts found in multipart data');
            }
            
            const formData = parseMultipartParts(parts);
            
            const db = readDatabase();
            const file = formData.file;
            const documentName = formData.documentName || 'Документ ' + Date.now();
            const category = formData.documentCategory || 'general';
            
            let filename, fileType, fileUrl;

            if (file && file.filename && file.content && file.content.length > 0) {
                const fileExt = path.extname(file.filename) || '.bin';
                filename = Date.now() + '-' + Math.random().toString(36).substring(2) + fileExt;
                const filePath = path.join(UPLOADS_DIR, filename);
                
                fs.writeFileSync(filePath, file.content);
                
                fileType = fileExt.toLowerCase().replace('.', '') || 'file';
                if (fileType === 'jpeg') fileType = 'jpg';
                fileUrl = '/uploads/' + filename;
                
                console.log('✅ Файл сохранен:', filename, 'Размер:', file.content.length, 'байт');
            } else {
                filename = 'doc-' + Date.now() + '.txt';
                fileType = 'file';
                fileUrl = '/uploads/' + filename;
                
                const filePath = path.join(UPLOADS_DIR, filename);
                fs.writeFileSync(filePath, 'Тестовое содержимое документа');
                
                console.log('⚠️ Файл не получен, создан тестовый документ');
            }

            const newDocument = {
                id: Date.now().toString(),
                name: documentName,
                originalName: file ? file.filename : 'document',
                filename: filename,
                type: fileType,
                category: category,
                url: fileUrl,
                uploadDate: new Date().toISOString(),
                isNew: true
            };

            db.documents.unshift(newDocument);
            const writeSuccess = writeDatabase(db);

            if (writeSuccess) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    document: newDocument,
                    message: 'Документ успешно загружен'
                }));
                console.log('✅ Документ загружен:', newDocument.name);
            } else {
                throw new Error('Failed to save to database');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки файла:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
    });
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    console.log(`📨 Запрос: ${req.method} ${pathname}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API: Получить документы
    if (pathname === '/api/documents' && req.method === 'GET') {
        try {
            const db = readDatabase();
            console.log('📊 Документов в базе:', db.documents.length);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(db.documents));
        } catch (error) {
            console.error('❌ Ошибка получения документов:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Ошибка сервера' }));
        }
        return;
    }

    // API: Загрузить документ
    if (pathname === '/api/documents' && req.method === 'POST') {
        const contentType = req.headers['content-type'];
        
        if (contentType && contentType.includes('multipart/form-data')) {
            handleFileUpload(req, res);
        } else {
            handleJsonUpload(req, res);
        }
        return;
    }

    // API: Удалить документ
    if (pathname.startsWith('/api/documents/') && req.method === 'DELETE') {
        const documentId = pathname.split('/')[3];
        
        try {
            const db = readDatabase();
            const documentIndex = db.documents.findIndex(doc => doc.id === documentId);
            
            if (documentIndex === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Документ не найден' }));
                return;
            }

            const document = db.documents[documentIndex];
            
            try {
                const filePath = path.join(UPLOADS_DIR, document.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('✅ Файл удален:', document.filename);
                }
            } catch (error) {
                console.log('⚠️ Файл не найден, продолжаем...');
            }

            db.documents.splice(documentIndex, 1);
            const writeSuccess = writeDatabase(db);

            if (writeSuccess) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                throw new Error('Failed to update database');
            }
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // Обслуживание загруженных файлов
    if (pathname.startsWith('/uploads/') && req.method === 'GET') {
        const filename = pathname.replace('/uploads/', '');
        const filePath = path.join(UPLOADS_DIR, filename);
        
        console.log('📂 Запрос файла:', filename);
        
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const contentType = getContentType(ext);
                
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
                console.log('✅ Файл отправлен:', filename);
            } else {
                console.log('⚠️ Файл не найден, отдаем заглушку');
                const placeholder = `
                    <html>
                        <body style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0;">
                            <div style="text-align: center; padding: 20px; background: white; border-radius: 10px;">
                                <h2>📁 Файл "${filename}"</h2>
                                <p>Это тестовый файл</p>
                                <p>В реальной системе здесь был бы ваш документ</p>
                            </div>
                        </body>
                    </html>
                `;
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(placeholder);
            }
        } catch (error) {
            console.log('❌ Ошибка чтения файла:', error);
            res.writeHead(404);
            res.end('File not found');
        }
        return;
    }

    // Обслуживание статических файлов фронтенда
    if (req.method === 'GET') {
        let filePath = path.join(FRONTEND_DIR, pathname === '/' ? 'index.html' : pathname.slice(1));
        
        console.log('🔍 Поиск файла:', filePath);
        
        if (!fs.existsSync(filePath)) {
            console.log('⚠️ Файл не найден, пробуем index.html');
            filePath = path.join(FRONTEND_DIR, 'index.html');
        }

        try {
            const content = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = getContentType(ext);
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
            console.log('✅ Файл отправлен:', filePath);
        } catch (error) {
            console.log('❌ Файл не найден:', filePath);
            res.writeHead(404);
            res.end('File not found');
        }
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

function getContentType(ext) {
    const types = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf'
    };
    return types[ext] || 'application/octet-stream';
}

server.listen(PORT, () => {
    console.log('=== 📁 ДОКУМЕНТЫ ЗАПУЩЕНЫ ===');
    console.log(`🌐 Сайт: http://localhost:${PORT}`);
    console.log(`⚙️ Админка: http://localhost:${PORT}/admin.html`);
    
    const db = readDatabase();
    console.log(`📊 Документов в базе: ${db.documents.length}`);
    
    const uploadsFiles = fs.readdirSync(UPLOADS_DIR);
    console.log(`📂 Файлов в uploads: ${uploadsFiles.length}`);
    
    console.log('📁 Структура проекта:');
    console.log('   backend/  - серверные файлы');
    console.log('   frontend/ - клиентские файлы');
    console.log('✅ Реальная загрузка файлов включена');
    console.log('==============================');
});
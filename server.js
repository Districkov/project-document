const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { StringDecoder } = require('string_decoder');

const PORT = process.env.PORT || 10000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const FRONTEND_DIR = path.join(__dirname, 'frontend');
const ADMIN_PASSWORD = "admin123";

// Создаем необходимые папки
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('✅ Папка uploads создана');
}

if (!fs.existsSync(FRONTEND_DIR)) {
    fs.mkdirSync(FRONTEND_DIR, { recursive: true });
    console.log('✅ Папка frontend создана');
}

const DB_PATH = path.join(__dirname, 'database.json');

// Инициализация базы данных
function initDatabase() {
    if (!fs.existsSync(DB_PATH)) {
        const defaultData = {
            documents: [],
            settings: {
                adminPassword: ADMIN_PASSWORD
            }
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2));
        console.log('✅ База данных создана');
    }
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

// Вспомогательные функции
function getContentType(ext) {
    const types = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain; charset=utf-8'
    };
    return types[ext] || 'application/octet-stream';
}

function sendJSONResponse(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
    sendJSONResponse(res, statusCode, { 
        success: false, 
        error: message 
    });
}

function sendSuccess(res, data = {}) {
    sendJSONResponse(res, 200, { 
        success: true, 
        ...data 
    });
}

// Функции для обработки multipart/form-data (ЗАГРУЗКА ФАЙЛОВ)
function parseMultipartData(body, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
    
    let start = body.indexOf(boundaryBuffer) + boundaryBuffer.length + 2;
    
    while (start < body.length) {
        const end = body.indexOf(boundaryBuffer, start);
        const finalEnd = body.indexOf(endBoundaryBuffer, start);
        
        if (end === -1 && finalEnd === -1) break;
        
        const partEnd = end !== -1 ? end - 2 : finalEnd - 2;
        if (partEnd <= start) break;
        
        const part = body.slice(start, partEnd);
        parts.push(part);
        
        if (finalEnd !== -1) break;
        start = end + boundaryBuffer.length + 2;
    }
    
    return parts;
}

function parsePart(part) {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) return null;
    
    const headers = part.slice(0, headerEnd).toString();
    const content = part.slice(headerEnd + 4);
    
    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    
    return {
        name: nameMatch ? nameMatch[1] : null,
        filename: filenameMatch ? filenameMatch[1] : null,
        content: content
    };
}

// API обработчики
function handleAdminLogin(req, res) {
    let body = '';
    
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        try {
            const { password } = JSON.parse(body);
            
            if (password === ADMIN_PASSWORD) {
                sendSuccess(res, { message: 'Успешный вход' });
            } else {
                sendError(res, 401, 'Неверный пароль');
            }
        } catch (error) {
            sendError(res, 400, 'Неверный формат данных');
        }
    });
}

function handleGetDocuments(req, res) {
    try {
        const db = readDatabase();
        sendSuccess(res, { documents: db.documents });
    } catch (error) {
        sendError(res, 500, 'Ошибка получения документов');
    }
}

// ОБНОВЛЕННАЯ ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ ФАЙЛОВ
function handleFileUpload(req, res) {
    const contentType = req.headers['content-type'];
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    
    if (!boundaryMatch) {
        return sendError(res, 400, 'No boundary found');
    }
    
    const boundary = boundaryMatch[1];
    let body = Buffer.alloc(0);
    
    req.on('data', chunk => {
        body = Buffer.concat([body, chunk]);
    });
    
    req.on('end', () => {
        try {
            const parts = parseMultipartData(body, boundary);
            const formData = {};
            let fileData = null;
            
            for (const part of parts) {
                const partData = parsePart(part);
                if (!partData) continue;
                
                if (partData.filename) {
                    fileData = partData;
                } else if (partData.name) {
                    formData[partData.name] = partData.content.toString();
                }
            }
            
            const db = readDatabase();
            const documentName = formData.documentName || `Документ ${Date.now()}`;
            const category = formData.documentCategory || 'general';
            
            if (!fileData || !fileData.filename || fileData.content.length === 0) {
                return sendError(res, 400, 'Файл не был загружен');
            }
            
            const fileExt = path.extname(fileData.filename).toLowerCase();
            const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${fileExt}`;
            const filePath = path.join(UPLOADS_DIR, filename);
            
            // Сохраняем файл на диск
            fs.writeFileSync(filePath, fileData.content);
            
            const fileType = fileExt.replace('.', '') || 'file';
            const fileUrl = `/uploads/${filename}`;
            
            console.log(`✅ Файл сохранен: ${filename} (${fileData.content.length} байт, тип: ${fileType})`);
            
            const newDocument = {
                id: Date.now().toString(),
                name: documentName,
                originalName: fileData.filename,
                filename: filename,
                type: fileType,
                category: category,
                url: fileUrl,
                uploadDate: new Date().toISOString(),
                isNew: true
            };
            
            db.documents.unshift(newDocument);
            
            if (writeDatabase(db)) {
                sendSuccess(res, { 
                    document: newDocument,
                    message: 'Документ успешно загружен'
                });
                console.log(`✅ Документ добавлен: ${documentName}`);
            } else {
                throw new Error('Ошибка сохранения в базу данных');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки файла:', error);
            sendError(res, 500, error.message);
        }
    });
}

function handleDeleteDocument(req, res, documentId) {
    try {
        const db = readDatabase();
        const documentIndex = db.documents.findIndex(doc => doc.id === documentId);
        
        if (documentIndex === -1) {
            return sendError(res, 404, 'Документ не найден');
        }
        
        const document = db.documents[documentIndex];
        
        // Удаляем файл из папки uploads
        try {
            const filePath = path.join(UPLOADS_DIR, document.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`✅ Файл удален: ${document.filename}`);
            }
        } catch (fileError) {
            console.log('⚠️ Файл не найден, продолжаем удаление документа...');
        }
        
        db.documents.splice(documentIndex, 1);
        
        if (writeDatabase(db)) {
            sendSuccess(res, { message: 'Документ удален' });
        } else {
            throw new Error('Ошибка сохранения в базу данных');
        }
    } catch (error) {
        sendError(res, 500, 'Ошибка удаления документа');
    }
}

// Основной обработчик сервера
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    console.log(`📨 ${req.method} ${pathname}`);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // API routes
    if (pathname === '/api/admin/login' && req.method === 'POST') {
        handleAdminLogin(req, res);
        return;
    }
    
    if (pathname === '/api/documents' && req.method === 'GET') {
        handleGetDocuments(req, res);
        return;
    }
    
    if (pathname === '/api/documents' && req.method === 'POST') {
        handleFileUpload(req, res);
        return;
    }
    
    if (pathname.startsWith('/api/documents/') && req.method === 'DELETE') {
        const documentId = pathname.split('/')[3];
        handleDeleteDocument(req, res, documentId);
        return;
    }
    
    // ОБСЛУЖИВАНИЕ ЗАГРУЖЕННЫХ ФАЙЛОВ ИЗ UPLOADS
    if (pathname.startsWith('/uploads/') && req.method === 'GET') {
        const filename = pathname.replace('/uploads/', '');
        const filePath = path.join(UPLOADS_DIR, filename);
        
        console.log(`📂 Запрос файла: ${filename}`);
        
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const contentType = getContentType(ext);
                
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
                console.log(`✅ Файл отправлен: ${filename}`);
            } else {
                console.log(`❌ Файл не найден: ${filename}`);
                res.writeHead(404);
                res.end('File not found');
            }
        } catch (error) {
            console.log('❌ Ошибка чтения файла:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
        return;
    }
    
    // Статические файлы из папки frontend
    if (req.method === 'GET') {
        let filePath;
        
        if (pathname === '/') {
            filePath = path.join(FRONTEND_DIR, 'index.html');
        } else if (pathname === '/admin.html') {
            filePath = path.join(FRONTEND_DIR, 'admin.html');
        } else {
            const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
            filePath = path.join(FRONTEND_DIR, relativePath);
        }
        
        try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const content = fs.readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const contentType = getContentType(ext);
                
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            } else {
                // Для SPA - всегда возвращаем index.html
                const indexFile = path.join(FRONTEND_DIR, 'index.html');
                if (fs.existsSync(indexFile)) {
                    const content = fs.readFileSync(indexFile);
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(content);
                } else {
                    res.writeHead(404);
                    res.end('Not Found');
                }
            }
        } catch (error) {
            console.log('❌ Ошибка чтения файла:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
        return;
    }
    
    // 404 для всех остальных запросов
    res.writeHead(404);
    res.end('Not Found');
});

// Запуск сервера
initDatabase();

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    
    console.log('=== 🌐 СИСТЕМА УПРАВЛЕНИЯ ДОКУМЕНТАМИ ===');
    console.log(`📍 Порт: ${PORT}`);
    console.log(`📍 Локальный доступ: http://localhost:${PORT}`);
    console.log(`📍 Сетевой доступ: http://${localIP}:${PORT}`);
    console.log(`📍 Админка: http://localhost:${PORT}/admin.html`);
    console.log(`🔐 Пароль админки: ${ADMIN_PASSWORD}`);
    
    const db = readDatabase();
    console.log(`📊 Документов в базе: ${db.documents.length}`);
    
    let uploadsFiles = [];
    try {
        uploadsFiles = fs.readdirSync(UPLOADS_DIR);
    } catch (error) {
        console.log('📂 Папка uploads пуста');
    }
    console.log(`📂 Файлов в uploads: ${uploadsFiles.length}`);
    
    console.log('🚀 Сервер успешно запущен!');
    console.log('==========================================');
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Останавливаем сервер...');
    server.close(() => {
        console.log('✅ Сервер остановлен');
        process.exit(0);
    });
});
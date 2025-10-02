const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

function handleUploadDocument(req, res) {
    let body = '';
    
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const db = readDatabase();
            
            const newDocument = {
                id: Date.now().toString(),
                name: data.documentName || `Документ ${Date.now()}`,
                originalName: data.originalName || 'document',
                filename: `doc-${Date.now()}.txt`,
                type: data.fileType || 'file',
                category: data.documentCategory || 'general',
                url: `/api/documents/${Date.now()}`,
                uploadDate: new Date().toISOString(),
                isNew: true
            };
            
            db.documents.unshift(newDocument);
            
            if (writeDatabase(db)) {
                sendSuccess(res, { 
                    document: newDocument,
                    message: 'Документ успешно загружен'
                });
            } else {
                throw new Error('Ошибка сохранения в базу данных');
            }
        } catch (error) {
            sendError(res, 500, 'Ошибка загрузки документа');
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
        handleUploadDocument(req, res);
        return;
    }
    
    if (pathname.startsWith('/api/documents/') && req.method === 'DELETE') {
        const documentId = pathname.split('/')[3];
        handleDeleteDocument(req, res, documentId);
        return;
    }
    
    // Статические файлы из папки frontend
if (req.method === 'GET') {
    let filePath;
    
    // Убираем начальный слэш для создания корректного пути
    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    filePath = path.join(FRONTEND_DIR, relativePath);
    
    console.log(`📁 Поиск файла: ${filePath}`);
    
    try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const content = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = getContentType(ext);
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
            console.log(`✅ Файл отправлен: ${pathname}`);
        } else {
            console.log(`❌ Файл не найден: ${filePath}`);
            
            // Для HTML файлов возвращаем index.html (SPA)
            if (pathname === '/' || pathname === '/admin.html' || pathname.endsWith('.html')) {
                const indexFile = path.join(FRONTEND_DIR, pathname === '/admin.html' ? 'admin.html' : 'index.html');
                if (fs.existsSync(indexFile)) {
                    const content = fs.readFileSync(indexFile);
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(content);
                    console.log(`✅ Отправлен HTML для: ${pathname}`);
                } else {
                    res.writeHead(404);
                    res.end('Not Found');
                }
            } else {
                // Для остальных файлов - 404
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
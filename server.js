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
        
        if (pathname === '/') {
            filePath = path.join(FRONTEND_DIR, 'index.html');
        } else if (pathname === '/admin.html') {
            filePath = path.join(FRONTEND_DIR, 'admin.html');
        } else {
            // Убираем начальный слэш для создания корректного пути
            const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
            filePath = path.join(FRONTEND_DIR, relativePath);
        }
        
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
                
                // Пробуем index.html для SPA роутинга
                const indexFile = path.join(FRONTEND_DIR, 'index.html');
                if (fs.existsSync(indexFile)) {
                    const content = fs.readFileSync(indexFile);
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(content);
                    console.log(`✅ Отправлен index.html для: ${pathname}`);
                } else {
                    // Файл не найден
                    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>404 - Не найдено</title>
                            <style>
                                body { 
                                    font-family: Arial, sans-serif; 
                                    margin: 40px; 
                                    text-align: center; 
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    color: white;
                                    min-height: 100vh;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                }
                                .container { 
                                    max-width: 600px; 
                                    background: rgba(255,255,255,0.95);
                                    color: #333;
                                    padding: 40px;
                                    border-radius: 15px;
                                    box-shadow: 0 15px 35px rgba(0,0,0,0.1);
                                }
                                h1 { color: #e74c3c; margin-bottom: 20px; }
                                a { 
                                    display: inline-block; 
                                    margin-top: 20px; 
                                    padding: 12px 24px; 
                                    background: #3498db; 
                                    color: white; 
                                    text-decoration: none; 
                                    border-radius: 8px;
                                    transition: all 0.3s ease;
                                }
                                a:hover { background: #2980b9; transform: translateY(-2px); }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1>❌ 404 - Файл не найден</h1>
                                <p>Запрошенный файл не существует: <strong>${pathname}</strong></p>
                                <p>Проверьте правильность URL или вернитесь на главную страницу</p>
                                <a href="/">🏠 Вернуться на главную</a>
                            </div>
                        </body>
                        </html>
                    `);
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
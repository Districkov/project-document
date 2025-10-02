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

// Простой парсер multipart/form-data
function parseMultipartFormData(buffer, contentType) {
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return null;

    const parts = buffer.split('--' + boundary);
    const result = {};

    for (const part of parts) {
        if (part.includes('Content-Disposition')) {
            const lines = part.split('\r\n');
            let name = null;
            let filename = null;
            let dataStart = -1;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.includes('Content-Disposition')) {
                    const nameMatch = line.match(/name="([^"]+)"/);
                    if (nameMatch) name = nameMatch[1];
                    
                    const filenameMatch = line.match(/filename="([^"]+)"/);
                    if (filenameMatch) filename = filenameMatch[1];
                }
                
                if (line === '' && i + 1 < lines.length) {
                    dataStart = i + 1;
                    break;
                }
            }

            if (name && dataStart !== -1) {
                const data = lines.slice(dataStart, -1).join('\r\n');
                if (filename) {
                    result[name] = {
                        filename: filename,
                        data: Buffer.from(data, 'binary'),
                        isFile: true
                    };
                } else {
                    result[name] = data.trim();
                }
            }
        }
    }

    return result;
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
            console.error('❌ Ошибка входа:', error);
            sendError(res, 400, 'Неверный формат данных');
        }
    });
}

function handleGetDocuments(req, res) {
    try {
        const db = readDatabase();
        console.log('📊 Отправляем документы:', db.documents.length);
        sendSuccess(res, { documents: db.documents });
    } catch (error) {
        console.error('❌ Ошибка получения документов:', error);
        sendError(res, 500, 'Ошибка получения документов');
    }
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ С ПОДДЕРЖКОЙ ФАЙЛОВ
function handleUploadDocument(req, res) {
    const contentType = req.headers['content-type'] || '';
    const chunks = [];

    req.on('data', chunk => {
        chunks.push(chunk);
    });

    req.on('end', () => {
        try {
            const buffer = Buffer.concat(chunks);
            
            let documentName, documentCategory, uploadedFile;

            if (contentType.includes('multipart/form-data')) {
                console.log('📤 Обработка multipart/form-data');
                const formData = parseMultipartFormData(buffer, contentType);
                
                if (!formData) {
                    throw new Error('Неверный формат form-data');
                }

                documentName = formData.documentName;
                documentCategory = formData.documentCategory;
                uploadedFile = formData.documentFile;
                
            } else {
                // Для обратной совместимости с JSON
                console.log('📤 Обработка JSON данных');
                const data = JSON.parse(buffer.toString() || '{}');
                documentName = data.documentName;
                documentCategory = data.documentCategory;
            }

            // Валидация
            if (!documentName) {
                return sendError(res, 400, 'Не указано название документа');
            }

            if (!documentCategory) {
                documentCategory = 'general';
            }

            const db = readDatabase();
            let filename, fileType, originalName;

            if (uploadedFile && uploadedFile.isFile) {
                // Сохраняем реальный файл
                originalName = uploadedFile.filename;
                fileType = path.extname(originalName).toLowerCase().substring(1) || 'file';
                filename = 'doc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8) + path.extname(originalName);
                const filePath = path.join(UPLOADS_DIR, filename);
                
                // Сохраняем файл с реальными данными
                fs.writeFileSync(filePath, uploadedFile.data);
                console.log('✅ Реальный файл сохранен в uploads:', filename, 'Размер:', uploadedFile.data.length, 'байт');

            } else {
                // Создаем тестовый файл (для обратной совместимости)
                originalName = 'document.txt';
                fileType = 'txt';
                filename = 'doc-' + Date.now() + '.txt';
                const filePath = path.join(UPLOADS_DIR, filename);
                fs.writeFileSync(filePath, 'Это тестовый файл, созданный сервером');
                console.log('✅ Тестовый файл создан в uploads:', filename);
            }

            const newDocument = {
                id: Date.now().toString(),
                name: documentName,
                originalName: originalName,
                filename: filename,
                type: fileType,
                category: documentCategory,
                url: '/uploads/' + filename,
                uploadDate: new Date().toISOString(),
                isNew: true
            };

            db.documents.unshift(newDocument);
            const writeSuccess = writeDatabase(db);

            if (writeSuccess) {
                console.log('✅ Документ добавлен в базу:', newDocument.name);
                sendSuccess(res, { 
                    document: newDocument,
                    message: 'Документ успешно загружен'
                });
            } else {
                throw new Error('Ошибка сохранения в базу данных');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки документа:', error);
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
        
        // Пытаемся удалить файл если он существует
        try {
            const filePath = path.join(UPLOADS_DIR, document.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('✅ Файл удален из uploads:', document.filename);
            } else {
                console.log('⚠️ Файл не найден в uploads:', document.filename);
            }
        } catch (error) {
            console.log('⚠️ Ошибка при удалении файла:', error.message);
        }

        db.documents.splice(documentIndex, 1);
        const writeSuccess = writeDatabase(db);

        if (writeSuccess) {
            sendSuccess(res, { message: 'Документ удален' });
        } else {
            throw new Error('Ошибка обновления базы данных');
        }
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
        sendError(res, 500, error.message);
    }
}

// Функция для статических файлов
function serveStaticFile(res, filePath) {
    try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const content = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = getContentType(ext);
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
            return true;
        }
        return false;
    } catch (error) {
        console.log('❌ Ошибка чтения файла:', error);
        return false;
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
    
    // Обслуживание загруженных файлов
    if (pathname.startsWith('/uploads/') && req.method === 'GET') {
        const filename = pathname.replace('/uploads/', '');
        const filePath = path.join(UPLOADS_DIR, filename);
        
        console.log('📂 Запрос файла из uploads:', filename);
        
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const content = fs.readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const contentType = getContentType(ext);
                
                res.writeHead(200, { 
                    'Content-Type': contentType,
                    'Content-Length': stats.size
                });
                res.end(content);
                console.log('✅ Файл отправлен:', filename, 'Размер:', stats.size, 'байт');
            } else {
                console.log('❌ Файл не найден в uploads:', filename);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
            }
        } catch (error) {
            console.log('❌ Ошибка чтения файла:', error);
            res.writeHead(404);
            res.end('File not found');
        }
        return;
    }
    
    // Статические файлы фронтенда
    if (req.method === 'GET') {
        let filePath;
        let served = false;

        // Основной путь - ищем в папке frontend
        if (pathname === '/') {
            filePath = path.join(FRONTEND_DIR, 'index.html');
        } else {
            filePath = path.join(FRONTEND_DIR, pathname.slice(1));
        }

        // Пробуем основной путь
        if (serveStaticFile(res, filePath)) {
            served = true;
        } else {
            // Если не нашли, пробуем альтернативные пути
            const alternativePaths = [
                path.join(__dirname, pathname === '/' ? 'index.html' : pathname.slice(1)),
                path.join(FRONTEND_DIR, 'index.html'),
                path.join(FRONTEND_DIR, 'admin.html'),
                path.join(__dirname, 'index.html'),
                path.join(__dirname, 'admin.html')
            ];

            for (const tryPath of alternativePaths) {
                if (serveStaticFile(res, tryPath)) {
                    served = true;
                    break;
                }
            }
        }

        if (!served) {
            console.log('❌ Файл не найден:', pathname);
            res.writeHead(404);
            res.end('Not found');
        }
        return;
    }
    
    res.writeHead(404);
    res.end('Not found');
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
    
    // Показываем содержимое папки uploads
    let uploadsFiles = [];
    try {
        uploadsFiles = fs.readdirSync(UPLOADS_DIR);
        console.log(`📂 Файлов в uploads: ${uploadsFiles.length}`);
        if (uploadsFiles.length > 0) {
            console.log('📄 Содержимое uploads:');
            uploadsFiles.forEach(file => {
                const filePath = path.join(UPLOADS_DIR, file);
                const stats = fs.statSync(filePath);
                console.log(`   - ${file} (${stats.size} байт)`);
            });
        }
    } catch (error) {
        console.log('📂 Папка uploads пуста');
    }
    
    console.log('🚀 Сервер готов к работе!');
    console.log('====================================');
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

// Обработка graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Останавливаем сервер...');
    server.close(() => {
        console.log('✅ Сервер остановлен');
        process.exit(0);
    });
});
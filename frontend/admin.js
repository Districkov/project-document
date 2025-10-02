let documents = [];
let isAuthenticated = false;

// DOM элементы
const elements = {
    loginSection: document.getElementById('loginSection'),
    adminContent: document.getElementById('adminContent'),
    loginForm: document.getElementById('loginForm'),
    adminPassword: document.getElementById('adminPassword'),
    uploadForm: document.getElementById('uploadForm'),
    documentName: document.getElementById('documentName'),
    documentFile: document.getElementById('documentFile'),
    documentCategory: document.getElementById('documentCategory'),
    documentsList: document.getElementById('documentsList')
};

// Инициализация
async function initAdmin() {
    setupEventListeners();
    checkAuth();
}

// Проверка авторизации
function checkAuth() {
    const savedAuth = localStorage.getItem('adminAuthenticated');
    if (savedAuth === 'true') {
        isAuthenticated = true;
        showAdminContent();
    } else {
        showLoginForm();
    }
}

// Показать форму входа
function showLoginForm() {
    elements.loginSection.style.display = 'block';
    elements.adminContent.style.display = 'none';
    isAuthenticated = false;
}

// Показать контент админки
function showAdminContent() {
    elements.loginSection.style.display = 'none';
    elements.adminContent.style.display = 'block';
    isAuthenticated = true;
    loadDocuments();
}

// Настройка обработчиков
function setupEventListeners() {
    elements.loginForm.addEventListener('submit', handleLogin);
    if (elements.uploadForm) {
        elements.uploadForm.addEventListener('submit', handleFileUpload);
    }
    
    // Автозаполнение имени файла
    elements.documentFile.addEventListener('change', function(e) {
        if (e.target.files.length > 0 && !elements.documentName.value) {
            const fileName = e.target.files[0].name;
            // Убираем расширение файла
            const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
            elements.documentName.value = nameWithoutExt;
        }
    });
}

// Обработка входа
async function handleLogin(e) {
    e.preventDefault();
    
    const password = elements.adminPassword.value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            throw new Error('Ошибка сети');
        }

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('adminAuthenticated', 'true');
            isAuthenticated = true;
            showAdminContent();
        } else {
            alert('❌ Неверный пароль!');
            elements.adminPassword.value = '';
        }
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        alert('❌ Ошибка при входе. Проверьте подключение к серверу.');
    }
}

// Загрузка документов
async function loadDocuments() {
    if (!isAuthenticated) return;
    
    try {
        const response = await fetch('/api/documents');
        if (!response.ok) throw new Error('Ошибка загрузки');
        documents = await response.json();
        renderDocumentsList();
    } catch (error) {
        console.error('Ошибка загрузки документов:', error);
        documents = [];
        renderDocumentsList();
    }
}

// Отображение списка документов
function renderDocumentsList() {
    if (!isAuthenticated) return;
    
    if (documents.length === 0) {
        elements.documentsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <h3>Нет загруженных документов</h3>
                <p>Загрузите первый документ</p>
            </div>
        `;
        return;
    }
    
    elements.documentsList.innerHTML = documents.map(doc => `
        <div class="document-card">
            <div class="preview-content">
                ${getDocumentPreview(doc)}
            </div>
            <div class="document-info">
                <div class="document-name">${escapeHtml(doc.name)}</div>
                <div class="document-meta">
                    ${getCategoryName(doc.category)} • ${new Date(doc.uploadDate).toLocaleDateString('ru-RU')}
                </div>
                <div class="document-actions">
                    <button onclick="previewDocument('${doc.id}')" class="btn-view">
                        👁️ Просмотр
                    </button>
                    <button onclick="confirmDelete('${doc.id}')" class="btn-delete">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Получение превью документа
function getDocumentPreview(doc) {
    if (doc.type === 'pdf') {
        return `
            <div class="pdf-preview">
                <iframe src="${doc.url}" class="preview-iframe"></iframe>
                <div class="preview-overlay">
                    <div class="pdf-icon">📄</div>
                </div>
            </div>
        `;
    } else if (['jpg', 'jpeg', 'png'].includes(doc.type)) {
        return `<img src="${doc.url}" alt="${doc.name}" class="preview-thumbnail" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="preview-icon-large" style="display: none;">${getDocumentIcon(doc.type)}</div>`;
    } else {
        return `
            <div class="preview-icon-large">${getDocumentIcon(doc.type)}</div>
        `;
    }
}

// Получение названия категории
function getCategoryName(category) {
    const categories = {
        'general': 'Общие документы',
        'contracts': 'Договоры',
        'reports': 'Отчеты',
        'presentations': 'Презентации'
    };
    return categories[category] || category;
}

// Получение иконки для типа файла
function getDocumentIcon(type) {
    const icons = {
        'pdf': '📄',
        'doc': '📝',
        'docx': '📝',
        'ppt': '📊',
        'pptx': '📊',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'file': '📁'
    };
    return icons[type] || '📁';
}

// Загрузка файла
async function handleFileUpload(e) {
    e.preventDefault();
    
    if (!isAuthenticated) {
        alert('❌ Необходимо войти в систему');
        return;
    }
    
    const name = elements.documentName.value.trim();
    const file = elements.documentFile.files[0];
    const category = elements.documentCategory.value;

    if (!file) {
        alert('❌ Пожалуйста, выберите файл');
        return;
    }

    if (!name) {
        alert('❌ Пожалуйста, введите название документа');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('documentName', name);
        formData.append('documentCategory', category);
        formData.append('documentFile', file);

        const response = await fetch('/api/documents', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }

        const result = await response.json();

        if (result.success) {
            alert('✅ Документ успешно загружен!');
            elements.uploadForm.reset();
            await loadDocuments();
        } else {
            alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('❌ Ошибка при загрузке документа. Проверьте подключение к серверу.');
    }
}

// Просмотр документа
function previewDocument(docId) {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
        window.open(doc.url, '_blank');
    }
}

// Подтверждение удаления
function confirmDelete(docId) {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    
    if (confirm(`Вы уверены, что хотите удалить документ "${doc.name}"?`)) {
        deleteDocument(docId);
    }
}

// Удаление документа
async function deleteDocument(docId) {
    if (!isAuthenticated) {
        alert('❌ Необходимо войти в систему');
        return;
    }
    
    try {
        const response = await fetch(`/api/documents/${docId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Ошибка удаления');
        }

        const result = await response.json();

        if (result.success) {
            alert('✅ Документ удален!');
            await loadDocuments();
        } else {
            alert('❌ Ошибка при удалении');
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('❌ Ошибка при удалении документа');
    }
}

// Экранирование HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Инициализация
document.addEventListener('DOMContentLoaded', initAdmin);
let documents = [];

// DOM элементы
const elements = {
    uploadForm: document.getElementById('uploadForm'),
    documentName: document.getElementById('documentName'),
    documentFile: document.getElementById('documentFile'),
    documentCategory: document.getElementById('documentCategory'),
    documentsList: document.getElementById('documentsList')
};

// Инициализация админ-панели
async function initAdmin() {
    setupEventListeners();
    await loadDocumentsList();
}

// Настройка обработчиков событий
function setupEventListeners() {
    elements.uploadForm.addEventListener('submit', handleFileUpload);
}

// Загрузка списка документов
async function loadDocumentsList() {
    try {
        console.log('🔄 Загрузка списка документов...');
        const response = await fetch('/api/documents');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        documents = await response.json();
        console.log(`✅ Загружено ${documents.length} документов`);
        renderDocumentsList();
    } catch (error) {
        console.error('❌ Ошибка загрузки документов:', error);
        documents = [];
        renderDocumentsList();
    }
}

// Отображение списка документов
function renderDocumentsList() {
    if (documents.length === 0) {
        elements.documentsList.innerHTML = `
            <div style="text-align: center; color: #7f8c8d; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📂</div>
                <h3>Нет загруженных документов</h3>
                <p>Нажмите "Загрузить документ" чтобы добавить первый документ</p>
            </div>
        `;
        return;
    }
    
    elements.documentsList.innerHTML = documents.map(doc => `
        <div class="preview-card">
            <div class="preview-icon">${getDocumentIcon(doc.type)}</div>
            <div class="preview-title">${escapeHtml(doc.name)}</div>
            <div class="preview-meta">
                ${doc.category} • ${new Date(doc.uploadDate).toLocaleDateString('ru-RU')}
            </div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button onclick="previewDocument('${doc.id}')" 
                        style="flex: 1; padding: 8px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    👁️ Просмотр
                </button>
                <button onclick="deleteDocument('${doc.id}')" 
                        style="flex: 1; padding: 8px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    🗑️ Удалить
                </button>
            </div>
        </div>
    `).join('');
}

// Обработка загрузки файла
async function handleFileUpload(e) {
    e.preventDefault();
    
    const name = elements.documentName.value.trim() || 'Документ ' + new Date().toLocaleDateString();
    const file = elements.documentFile.files[0];
    const category = elements.documentCategory.value;

    if (!file) {
        alert('❌ Пожалуйста, выберите файл');
        return;
    }

    try {
        console.log('📤 Отправка файла на сервер...');
        
        const formData = new FormData();
        formData.append('documentName', name);
        formData.append('documentCategory', category);
        formData.append('file', file);

        const response = await fetch('/api/documents', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ ' + (result.message || 'Документ успешно загружен!'));
            elements.uploadForm.reset();
            await loadDocumentsList();
        } else {
            alert('❌ Ошибка: ' + result.error);
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('❌ Ошибка при загрузке документа: ' + error.message);
    }
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

// Просмотр документа
function previewDocument(docId) {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    
    window.open(doc.url, '_blank');
}

// Удаление документа
async function deleteDocument(docId) {
    if (confirm('Вы уверены, что хотите удалить этот документ?')) {
        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                alert('✅ Документ удален!');
                await loadDocumentsList();
            } else {
                alert('❌ Ошибка при удалении');
            }
        } catch (error) {
            console.error('❌ Ошибка:', error);
            alert('❌ Ошибка при удалении документа');
        }
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

// Инициализация админ-панели
document.addEventListener('DOMContentLoaded', initAdmin);
const API_BASE = 'http://localhost:3000/api';
let documents = [];

// Загрузка документов с сервера
async function loadDocuments() {
    try {
        const response = await fetch(`${API_BASE}/documents`);
        documents = await response.json();
        renderDocumentsPreview();
    } catch (error) {
        console.error('Ошибка загрузки документов:', error);
        documents = [];
        renderDocumentsPreview();
    }
}

// Отображение превью документов
function renderDocumentsPreview() {
    const container = document.getElementById('documentsPreview');
    const emptyState = document.getElementById('emptyState');
    
    if (documents.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    container.style.display = 'grid';
    emptyState.style.display = 'none';
    
    container.innerHTML = documents.map(doc => `
        <div class="preview-card" onclick="openDocument('${doc.id}')">
            ${doc.isNew ? '<div class="preview-badge">NEW</div>' : ''}
            <div class="preview-icon">${getDocumentIcon(doc.type)}</div>
            <div class="preview-title">${escapeHtml(doc.name)}</div>
            <div class="preview-meta">
                ${doc.category} • ${new Date(doc.uploadDate).toLocaleDateString('ru-RU')}
            </div>
        </div>
    `).join('');
}

// Открытие документа в модальном окне
function openDocument(docId) {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    
    const modal = document.getElementById('documentModal');
    const modalTitle = document.getElementById('modalTitle');
    const documentViewer = document.getElementById('documentViewer');
    
    modalTitle.textContent = doc.name;
    
    if (doc.type === 'pdf') {
        documentViewer.innerHTML = `
            <iframe src="${doc.url}" class="document-iframe" title="${doc.name}"></iframe>
        `;
    } else if (['jpg', 'jpeg', 'png'].includes(doc.type)) {
        documentViewer.innerHTML = `
            <img src="${doc.url}" alt="${doc.name}" class="document-image">
        `;
    } else {
        documentViewer.innerHTML = `
            <div class="unsupported-format">
                <div style="font-size: 48px; margin-bottom: 20px;">📄</div>
                <h3>Формат файла: .${doc.type}</h3>
                <p>Для просмотра скачайте файл</p>
                <a href="${doc.url}" download="${doc.originalName}" 
                   style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px;">
                    📥 Скачать файл
                </a>
            </div>
        `;
    }
    
    modal.style.display = 'block';
}

// Закрытие модального окна
function setupModal() {
    const modal = document.getElementById('documentModal');
    const closeBtn = document.getElementById('closeModal');
    
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    }
    
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
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
document.addEventListener('DOMContentLoaded', function() {
    loadDocuments();
    setupModal();
});
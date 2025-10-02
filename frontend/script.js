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
            <div class="preview-content">
                ${getDocumentPreview(doc)}
            </div>
            <div class="preview-title">${escapeHtml(doc.name)}</div>
            <div class="preview-meta">
                ${getCategoryName(doc.category)} • ${new Date(doc.uploadDate).toLocaleDateString('ru-RU')}
            </div>
        </div>
    `).join('');
}

// Получение превью документа (функция из админской части)
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

// Открытие документа в полноэкранном модальном окне
function openDocument(docId) {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    
    const modal = document.getElementById('documentModal');
    const modalTitle = document.getElementById('modalTitle');
    const documentViewer = document.getElementById('documentViewer');
    
    // Очищаем предыдущий контент
    modalTitle.innerHTML = '';
    documentViewer.innerHTML = '';
    
    // Создаем заголовок с кнопками
    const titleText = document.createElement('span');
    titleText.textContent = doc.name;
    titleText.style.flex = '1';
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = 'display: flex; gap: 10px; margin-left: 15px;';
    
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.textContent = '⛶ Полный экран';
    fullscreenBtn.className = 'fullscreen-btn';
    fullscreenBtn.onclick = toggleFullscreen;
    
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = '📥 Скачать';
    downloadBtn.className = 'download-btn';
    downloadBtn.onclick = () => downloadDocument(doc.id);
    
    buttonsContainer.appendChild(fullscreenBtn);
    buttonsContainer.appendChild(downloadBtn);
    
    modalTitle.appendChild(titleText);
    modalTitle.appendChild(buttonsContainer);
    
    // Загружаем контент документа
    if (doc.type === 'pdf') {
        documentViewer.innerHTML = `
            <iframe src="${doc.url}" class="document-iframe" title="${doc.name}"></iframe>
        `;
    } else if (['jpg', 'jpeg', 'png'].includes(doc.type)) {
        documentViewer.innerHTML = `
            <img src="${doc.url}" alt="${doc.name}" class="document-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7imYIg0LjQvdGC0LXRgNC10YHQvdC+0LU8L3RleHQ+PC9zdmc+'">
        `;
    } else {
        documentViewer.innerHTML = `
            <div class="unsupported-format">
                <div style="font-size: 48px; margin-bottom: 20px;">📄</div>
                <h3>Формат файла: .${doc.type}</h3>
                <p>Для просмотра скачайте файл</p>
                <button onclick="downloadDocument('${doc.id}')" 
                        style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; border: none; cursor: pointer;">
                    📥 Скачать файл
                </button>
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
        modal.classList.remove('modal-fullscreen');
    }
    
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
            modal.classList.remove('modal-fullscreen');
        }
    }
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
            modal.classList.remove('modal-fullscreen');
        }
    });
}

// Функция для переключения полноэкранного режима
function toggleFullscreen() {
    const modal = document.getElementById('documentModal');
    modal.classList.toggle('modal-fullscreen');
}

// Функция для скачивания документа
function downloadDocument(docId) {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
        const link = document.createElement('a');
        link.href = doc.url;
        link.download = doc.originalName || doc.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

// Поиск документов
function setupSearch() {
    const header = document.querySelector('header');
    const existingSearch = header.querySelector('input[type="text"]');
    if (existingSearch) return;
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '🔍 Поиск документов...';
    searchInput.style.cssText = `
        width: 100%;
        max-width: 400px;
        margin: 20px auto;
        padding: 12px 20px;
        border: 2px solid #e9ecef;
        border-radius: 25px;
        font-size: 1rem;
        display: block;
        outline: none;
        transition: border-color 0.3s ease;
    `;
    
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredDocs = documents.filter(doc => 
            doc.name.toLowerCase().includes(searchTerm) ||
            getCategoryName(doc.category).toLowerCase().includes(searchTerm)
        );
        renderFilteredDocuments(filteredDocs);
    });
    
    header.appendChild(searchInput);
}

// Отображение отфильтрованных документов
function renderFilteredDocuments(filteredDocs) {
    const container = document.getElementById('documentsPreview');
    const emptyState = document.getElementById('emptyState');
    
    if (filteredDocs.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <div class="empty-icon">🔍</div>
            <h3>Документы не найдены</h3>
            <p>Попробуйте изменить поисковый запрос</p>
        `;
        return;
    }
    
    container.style.display = 'grid';
    emptyState.style.display = 'none';
    
    container.innerHTML = filteredDocs.map(doc => `
        <div class="preview-card" onclick="openDocument('${doc.id}')">
            ${doc.isNew ? '<div class="preview-badge">NEW</div>' : ''}
            <div class="preview-content">
                ${getDocumentPreview(doc)}
            </div>
            <div class="preview-title">${escapeHtml(doc.name)}</div>
            <div class="preview-meta">
                ${getCategoryName(doc.category)} • ${new Date(doc.uploadDate).toLocaleDateString('ru-RU')}
            </div>
        </div>
    `).join('');
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    loadDocuments();
    setupModal();
    setupSearch();
});
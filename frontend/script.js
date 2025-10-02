class DocumentViewer {
    constructor() {
        this.documents = [];
        this.filteredDocuments = [];
        this.apiBase = '/api';
        
        this.init();
    }

    async init() {
        await this.loadDocuments();
        this.setupEventListeners();
        this.setupModal();
        this.setupSearch();
    }

    // Загрузка документов с сервера
    async loadDocuments() {
        try {
            const response = await fetch(`${this.apiBase}/documents`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.documents = result.documents || [];
                this.filteredDocuments = [...this.documents];
                this.renderDocuments();
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки документов:', error);
            this.showError('Не удалось загрузить документы. Проверьте подключение к серверу.');
            this.documents = [];
            this.filteredDocuments = [];
            this.renderDocuments();
        }
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Автообновление каждые 30 секунд
        setInterval(() => this.loadDocuments(), 30000);
    }

    // Настройка поиска
    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            this.filterDocuments(searchTerm);
        });

        // Очистка поиска при нажатии Escape
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.target.value = '';
                this.filterDocuments('');
            }
        });
    }

    // Фильтрация документов
    filterDocuments(searchTerm) {
        if (!searchTerm) {
            this.filteredDocuments = [...this.documents];
        } else {
            this.filteredDocuments = this.documents.filter(doc => 
                doc.name.toLowerCase().includes(searchTerm) ||
                this.getCategoryName(doc.category).toLowerCase().includes(searchTerm) ||
                (doc.originalName && doc.originalName.toLowerCase().includes(searchTerm))
            );
        }
        this.renderDocuments();
    }

    // Отображение документов
    renderDocuments() {
        const container = document.getElementById('documentsGrid');
        const emptyState = document.getElementById('emptyState');

        if (this.filteredDocuments.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            
            const searchInput = document.getElementById('searchInput');
            const searchTerm = searchInput.value.trim();
            
            if (searchTerm) {
                emptyState.innerHTML = `
                    <div class="empty-icon">🔍</div>
                    <h3>Документы не найдены</h3>
                    <p>По запросу "${this.escapeHtml(searchTerm)}" ничего не найдено</p>
                    <button onclick="documentViewer.clearSearch()" class="btn-primary">
                        Показать все документы
                    </button>
                `;
            } else {
                emptyState.innerHTML = `
                    <div class="empty-icon">📂</div>
                    <h3>Документы не найдены</h3>
                    <p>Документы появятся здесь после их загрузки через админ-панель</p>
                    <a href="admin.html" class="btn-primary">Перейти в админ-панель</a>
                `;
            }
            return;
        }

        container.style.display = 'grid';
        emptyState.style.display = 'none';

        container.innerHTML = this.filteredDocuments.map(doc => `
            <div class="document-card" onclick="documentViewer.openDocument('${doc.id}')">
                ${doc.isNew ? '<div class="preview-badge">NEW</div>' : ''}
                <div class="preview-content">
                    ${this.getDocumentPreview(doc)}
                </div>
                <div class="document-info">
                    <div class="document-name">${this.escapeHtml(doc.name)}</div>
                    <div class="document-meta">
                        ${this.getCategoryName(doc.category)} • 
                        ${new Date(doc.uploadDate).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        })}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Получение превью документа
    getDocumentPreview(doc) {
        const fileType = doc.type.toLowerCase();
        
        if (fileType === 'pdf') {
            return `
                <div class="pdf-preview">
                    <div class="preview-overlay">
                        <div class="pdf-icon">📄</div>
                    </div>
                </div>
            `;
        } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileType)) {
            return `
                <img src="${doc.url}" alt="${this.escapeHtml(doc.name)}" 
                     class="preview-thumbnail"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="preview-icon-large" style="display: none;">${this.getDocumentIcon(fileType)}</div>
            `;
        } else {
            return `
                <div class="preview-icon-large">${this.getDocumentIcon(fileType)}</div>
            `;
        }
    }

    // Получение иконки для типа файла
    getDocumentIcon(type) {
        const icons = {
            'pdf': '📄',
            'doc': '📝',
            'docx': '📝',
            'ppt': '📊',
            'pptx': '📊',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️',
            'txt': '📄',
            'file': '📁'
        };
        return icons[type] || '📁';
    }

    // Получение названия категории
    getCategoryName(category) {
        const categories = {
            'general': '📄 Общие документы',
            'contracts': '📝 Договоры',
            'reports': '📊 Отчеты',
            'presentations': '🎯 Презентации',
            'instructions': '📖 Инструкции'
        };
        return categories[category] || category;
    }

    // Открытие документа
    openDocument(docId) {
        const doc = this.documents.find(d => d.id === docId);
        if (!doc) {
            this.showError('Документ не найден');
            return;
        }

        const modal = document.getElementById('documentModal');
        const modalTitle = document.getElementById('modalTitle');
        const documentViewer = document.getElementById('documentViewer');
        const downloadBtn = document.getElementById('downloadBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');

        // Настройка заголовка
        modalTitle.textContent = doc.name;

        // Настройка кнопки скачивания
        downloadBtn.onclick = () => this.downloadDocument(docId);

        // Настройка кнопки полноэкранного режима
        fullscreenBtn.onclick = () => this.toggleFullscreen();

        // Загрузка контента документа
        this.loadDocumentContent(doc, documentViewer);

        // Показ модального окна
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    // Загрузка контента документа
    loadDocumentContent(doc, container) {
        const fileType = doc.type.toLowerCase();

        if (fileType === 'pdf') {
            container.innerHTML = `
                <iframe src="${doc.url}" 
                        class="document-iframe" 
                        title="${this.escapeHtml(doc.name)}"
                        onload="this.style.opacity='1'"
                        style="opacity:0; transition: opacity 0.3s ease;">
                </iframe>
            `;
        } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileType)) {
            container.innerHTML = `
                <img src="${doc.url}" 
                     alt="${this.escapeHtml(doc.name)}" 
                     class="document-image"
                     onload="this.style.opacity='1'"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7imYIg0LjQvdGC0LXRgNC10YHQvdC+0LU8L3RleHQ+PC9zdmc+'"
                     style="opacity:0; transition: opacity 0.3s ease;">
            `;
        } else {
            container.innerHTML = `
                <div class="unsupported-format">
                    <div style="font-size: 64px; margin-bottom: 20px;">${this.getDocumentIcon(fileType)}</div>
                    <h3>Формат файла: .${fileType}</h3>
                    <p>Данный формат файла не поддерживается для просмотра в браузере</p>
                    <p>Скачайте файл для просмотра на вашем устройстве</p>
                    <button onclick="documentViewer.downloadDocument('${doc.id}')" 
                            class="btn-primary" style="margin-top: 20px;">
                        📥 Скачать файл
                    </button>
                </div>
            `;
        }
    }

    // Скачивание документа
    downloadDocument(docId) {
        const doc = this.documents.find(d => d.id === docId);
        if (doc && doc.url) {
            const link = document.createElement('a');
            link.href = doc.url;
            link.download = doc.originalName || doc.name;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('📥 Начато скачивание документа', 'success');
        } else {
            this.showError('Не удалось скачать документ');
        }
    }

    // Переключение полноэкранного режима
    toggleFullscreen() {
        const modal = document.getElementById('documentModal');
        modal.classList.toggle('modal-fullscreen');
        
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (modal.classList.contains('modal-fullscreen')) {
            fullscreenBtn.textContent = '⛶ Выйти из полного экрана';
        } else {
            fullscreenBtn.textContent = '⛶ Полный экран';
        }
    }

    // Настройка модального окна
    setupModal() {
        const modal = document.getElementById('documentModal');
        const closeBtn = document.getElementById('closeModal');

        // Закрытие по кнопке
        closeBtn.onclick = () => this.closeModal();

        // Закрытие по клику вне окна
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        };

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                this.closeModal();
            }
        });
    }

    // Закрытие модального окна
    closeModal() {
        const modal = document.getElementById('documentModal');
        modal.style.display = 'none';
        modal.classList.remove('modal-fullscreen');
        document.body.style.overflow = 'auto';
        
        // Сброс текста кнопки полноэкранного режима
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        fullscreenBtn.textContent = '⛶ Полный экран';
    }

    // Очистка поиска
    clearSearch() {
        const searchInput = document.getElementById('searchInput');
        searchInput.value = '';
        this.filterDocuments('');
        searchInput.focus();
    }

    // Показать уведомление
    showNotification(message, type = 'info') {
        // Удаляем существующие уведомления
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1001;
            animation: slideInRight 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Автоматическое скрытие
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }

    // Показать ошибку
    showError(message) {
        this.showNotification(`❌ ${message}`, 'error');
    }

    // Экранирование HTML
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Добавляем CSS для анимаций уведомлений
const notificationStyles = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification.success { background: #27ae60; }
    .notification.error { background: #e74c3c; }
    .notification.info { background: #3498db; }
`;

// Добавляем стили в документ
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Инициализация при загрузке страницы
let documentViewer;

document.addEventListener('DOMContentLoaded', () => {
    documentViewer = new DocumentViewer();
});
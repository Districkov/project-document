class AdminPanel {
    constructor() {
        this.documents = [];
        this.isAuthenticated = false;
        this.apiBase = '/api';
        
        this.elements = {
            loginSection: document.getElementById('loginSection'),
            adminContent: document.getElementById('adminContent'),
            loginForm: document.getElementById('loginForm'),
            adminPassword: document.getElementById('adminPassword'),
            uploadForm: document.getElementById('uploadForm'),
            documentName: document.getElementById('documentName'),
            documentFile: document.getElementById('documentFile'),
            documentCategory: document.getElementById('documentCategory'),
            documentsList: document.getElementById('documentsList'),
            documentsCount: document.getElementById('documentsCount')
        };

        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkAuth();
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Форма входа
        this.elements.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        
        // Форма загрузки
        if (this.elements.uploadForm) {
            this.elements.uploadForm.addEventListener('submit', (e) => this.handleFileUpload(e));
        }
        
        // Автозаполнение имени из файла
        this.elements.documentFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0 && !this.elements.documentName.value) {
                const fileName = e.target.files[0].name;
                const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
                this.elements.documentName.value = nameWithoutExt;
            }
        });

        // Выход по Ctrl+D (для разработки)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                this.logout();
            }
        });
    }

    // Проверка авторизации
    async checkAuth() {
        const savedAuth = localStorage.getItem('adminAuthenticated');
        if (savedAuth === 'true') {
            try {
                await this.verifyAuth();
                this.isAuthenticated = true;
                this.showAdminContent();
            } catch (error) {
                console.log('Сессия устарела, требуется повторный вход');
                this.logout();
            }
        } else {
            this.showLoginForm();
        }
    }

    // Проверка авторизации на сервере
    async verifyAuth() {
        await this.loadDocuments();
    }

    // Показать форму входа
    showLoginForm() {
        this.elements.loginSection.style.display = 'block';
        this.elements.adminContent.style.display = 'none';
        this.isAuthenticated = false;
        this.elements.adminPassword.focus();
    }

    // Показать контент админки
    showAdminContent() {
        this.elements.loginSection.style.display = 'none';
        this.elements.adminContent.style.display = 'block';
        this.isAuthenticated = true;
        this.loadDocuments();
    }

    // Обработка входа
    async handleLogin(e) {
        e.preventDefault();
        
        const password = this.elements.adminPassword.value.trim();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        if (!password) {
            this.showNotification('❌ Введите пароль', 'error');
            return;
        }

        // Показываем индикатор загрузки
        submitBtn.innerHTML = '<div class="loading"></div> Вход...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${this.apiBase}/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const result = await response.json();

            if (result.success) {
                localStorage.setItem('adminAuthenticated', 'true');
                this.isAuthenticated = true;
                this.showAdminContent();
                this.showNotification('✅ Успешный вход в систему', 'success');
            } else {
                throw new Error(result.error || 'Неверный пароль');
            }
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
            this.elements.adminPassword.value = '';
            this.elements.adminPassword.focus();
        } finally {
            // Восстанавливаем кнопку
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    // Выход из системы
    logout() {
        localStorage.removeItem('adminAuthenticated');
        this.isAuthenticated = false;
        this.showLoginForm();
        this.showNotification('🔒 Вы вышли из системы', 'info');
    }

    // Загрузка документов
    async loadDocuments() {
        if (!this.isAuthenticated) return;
        
        try {
            const response = await fetch(`${this.apiBase}/documents`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.documents = result.documents || [];
                this.renderDocumentsList();
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки документов:', error);
            this.showNotification('❌ Не удалось загрузить документы', 'error');
            this.documents = [];
            this.renderDocumentsList();
        }
    }

    // Отображение списка документов
    renderDocumentsList() {
        if (!this.isAuthenticated) return;
        
        const count = this.documents.length;
        this.elements.documentsCount.textContent = `${count} ${this.getPluralForm(count, ['документ', 'документа', 'документов'])}`;
        
        if (this.documents.length === 0) {
            this.elements.documentsList.innerHTML = `
                <div class="empty-state" style="display: block; margin: 40px 0;">
                    <div class="empty-icon">📂</div>
                    <h3>Нет загруженных документов</h3>
                    <p>Загрузите первый документ с помощью формы выше</p>
                </div>
            `;
            return;
        }
        
        this.elements.documentsList.innerHTML = this.documents.map(doc => `
            <div class="document-card">
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
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </div>
                    <div class="document-meta">
                        ${doc.originalName} • ${doc.type.toUpperCase()}
                    </div>
                    <div class="document-actions">
                        <button onclick="adminPanel.previewDocument('${doc.id}')" class="btn-view">
                            👁️ Просмотр
                        </button>
                        <button onclick="adminPanel.confirmDelete('${doc.id}')" class="btn-delete">
                            🗑️ Удалить
                        </button>
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

    // ИСПРАВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ ФАЙЛОВ - ОТПРАВЛЯЕТ FORMData
    async handleFileUpload(e) {
        e.preventDefault();
        
        if (!this.isAuthenticated) {
            this.showNotification('❌ Необходимо войти в систему', 'error');
            return;
        }
        
        const name = this.elements.documentName.value.trim();
        const file = this.elements.documentFile.files[0];
        const category = this.elements.documentCategory.value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        // Валидация
        if (!file) {
            this.showNotification('❌ Выберите файл для загрузки', 'error');
            return;
        }

        if (!name) {
            this.showNotification('❌ Введите название документа', 'error');
            return;
        }

        // Проверка размера файла (максимум 50MB)
        if (file.size > 50 * 1024 * 1024) {
            this.showNotification('❌ Файл слишком большой (максимум 50MB)', 'error');
            return;
        }

        // Показываем индикатор загрузки
        submitBtn.innerHTML = '<div class="loading"></div> Загрузка...';
        submitBtn.disabled = true;

        try {
            // ИСПОЛЬЗУЕМ FormData для отправки реального файла
            const formData = new FormData();
            formData.append('documentName', name);
            formData.append('documentCategory', category);
            formData.append('documentFile', file);

            console.log('📤 Отправка файла:', file.name, 'Размер:', file.size, 'байт');

            const response = await fetch(`${this.apiBase}/documents`, {
                method: 'POST',
                body: formData // НЕ указываем Content-Type - браузер сам установит
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Ошибка сервера:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showNotification('✅ Документ успешно загружен!', 'success');
                this.elements.uploadForm.reset();
                await this.loadDocuments();
            } else {
                throw new Error(result.error || 'Ошибка при загрузке');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
        } finally {
            // Восстанавливаем кнопку
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    // Просмотр документа
    previewDocument(docId) {
        const doc = this.documents.find(d => d.id === docId);
        if (doc && doc.url) {
            window.open(doc.url, '_blank');
        } else {
            this.showNotification('❌ Не удалось открыть документ', 'error');
        }
    }

    // Подтверждение удаления
    confirmDelete(docId) {
        const doc = this.documents.find(d => d.id === docId);
        if (!doc) return;
        
        if (confirm(`Вы уверены, что хотите удалить документ "${doc.name}"?\n\nФайл: ${doc.originalName}\nЭто действие нельзя отменить.`)) {
            this.deleteDocument(docId);
        }
    }

    // Удаление документа
    async deleteDocument(docId) {
        if (!this.isAuthenticated) {
            this.showNotification('❌ Необходимо войти в систему', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/documents/${docId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('✅ Документ удален', 'success');
                await this.loadDocuments();
            } else {
                throw new Error(result.error || 'Ошибка при удалении');
            }
        } catch (error) {
            console.error('❌ Ошибка удаления:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
        }
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
            max-width: 400px;
            word-wrap: break-word;
        `;

        // Цвета для разных типов уведомлений
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            info: '#3498db'
        };

        notification.style.background = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Автоматическое скрытие
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 4000);
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

    // Получение правильной формы слова
    getPluralForm(number, forms) {
        const cases = [2, 0, 1, 1, 1, 2];
        return forms[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[Math.min(number % 10, 5)]];
    }
}

// Добавляем CSS для индикатора загрузки и уведомлений
const adminStyles = `
    .loading {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .documents-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 25px;
        margin-top: 20px;
    }

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

    .document-card {
        background: white;
        border-radius: 12px;
        padding: 0;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        cursor: pointer;
        transition: all 0.3s ease;
        border: 3px solid transparent;
        overflow: hidden;
        position: relative;
    }

    .document-card:hover {
        transform: translateY(-8px);
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
        border-color: #3498db;
    }

    .preview-content {
        height: 160px;
        background: #f8f9fa;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
    }

    .preview-thumbnail {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .pdf-preview {
        width: 100%;
        height: 100%;
        position: relative;
    }

    .preview-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(52, 152, 219, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .pdf-icon {
        font-size: 2.5rem;
        background: rgba(255, 255, 255, 0.9);
        padding: 15px;
        border-radius: 50%;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }

    .preview-icon-large {
        font-size: 3.5rem;
        opacity: 0.7;
    }

    .document-info {
        padding: 20px;
    }

    .document-name {
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 8px;
        font-size: 1.1rem;
        line-height: 1.4;
        word-break: break-word;
    }

    .document-meta {
        color: #7f8c8d;
        font-size: 0.9rem;
        margin-bottom: 8px;
    }

    .document-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
    }

    .btn-view, .btn-delete {
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.3s ease;
        font-size: 0.9rem;
    }

    .btn-view {
        background: #3498db;
        color: white;
    }

    .btn-view:hover {
        background: #2980b9;
    }

    .btn-delete {
        background: #e74c3c;
        color: white;
    }

    .btn-delete:hover {
        background: #c0392b;
    }
`;

// Добавляем стили в документ
const adminStyleSheet = document.createElement('style');
adminStyleSheet.textContent = adminStyles;
document.head.appendChild(adminStyleSheet);

// Инициализация админ-панели
let adminPanel;

document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
});
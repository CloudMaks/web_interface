// API базовый URL
const API_BASE = '';

// Утилиты для работы с API
// auth.js
// auth.js - функция apiRequest
async function apiRequest(endpoint, options = {}) {
    const url = endpoint; // относительный путь
    const config = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    try {
        const response = await fetch(url, config);
        
        // Сначала пытаемся получить JSON, даже если статус не 200
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            data = { success: false, error: `HTTP ${response.status}` };
        }
        
        // Если 401 и не на странице логина - редирект
        if (response.status === 401 && !window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
            return null;
        }
        
        // Возвращаем данные, даже если статус не OK
        return data;
        
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Проверка авторизации
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/check-auth`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
                sessionStorage.setItem('currentUser', JSON.stringify(data.user));
                return data.user;
            }
        }
        return null;
    } catch (error) {
        console.error('Auth check error:', error);
        return null;
    }
}

// Перенаправление если не авторизован
async function requireAuth(requiredRole = null) {
    const user = await checkAuth();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    
    if (requiredRole && user.role !== requiredRole) {
        window.location.href = 'login.html';
        return null;
    }
    
    return user;
}

// Вход в систему
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
                showNotification('Заполните все поля', 'error');
                return;
            }
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const submitText = submitBtn.querySelector('#submitText');
            const submitSpinner = submitBtn.querySelector('#submitSpinner');
            
            submitText.style.display = 'none';
            submitSpinner.style.display = 'block';
            submitBtn.disabled = true;
            
            try {
                const response = await apiRequest('/api/login', {
                    method: 'POST',
                    body: JSON.stringify({ username, password })
                });
                
                if (response.success) {
                    showNotification(response.message, 'success');
                    sessionStorage.setItem('currentUser', JSON.stringify(response.user));
                    
                    // Перенаправление на соответствующий дашборд
                    setTimeout(() => {
                        window.location.href = `${response.user.role}-dashboard.html`;
                    }, 1000);
                } else {
                    showNotification(response.error || 'Ошибка входа', 'error');
                    submitText.style.display = 'block';
                    submitSpinner.style.display = 'none';
                    submitBtn.disabled = false;
                }
            } catch (error) {
                showNotification('Ошибка соединения', 'error');
                submitText.style.display = 'block';
                submitSpinner.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }
    
    // Заполнение демо-аккаунтов
    document.querySelectorAll('.demo-account').forEach(account => {
        account.style.cursor = 'pointer';
        account.addEventListener('click', function() {
            const text = this.textContent;
            const match = text.match(/(\w+)\s+\/\s+(\w+)/);
            if (match) {
                document.getElementById('username').value = match[1];
                document.getElementById('password').value = match[2];
                showNotification(`Заполнены данные для: ${match[1]}`, 'info');
            }
        });
    });
});

// Выход из системы
async function logout() {
    try {
        await apiRequest('/api/logout', {
            method: 'POST'
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }
}

// Уведомления
function showNotification(message, type = 'info') {
    // Удаляем существующие уведомления
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        animation: slideIn 0.3s ease;
    `;
    
    // Добавляем стили для типа уведомления
    const styles = {
        error: {
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444'
        },
        success: {
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#22c55e'
        },
        info: {
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#3b82f6'
        },
        warning: {
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: '#eab308'
        }
    };
    
    Object.assign(notification.style, styles[type] || styles.info);
    
    document.body.appendChild(notification);
    
    // Автоматическое скрытие
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function getNotificationIcon(type) {
    const icons = {
        error: 'exclamation-circle',
        success: 'check-circle',
        info: 'info-circle',
        warning: 'exclamation-triangle'
    };
    return icons[type] || 'info-circle';
}

// Добавляем анимации для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
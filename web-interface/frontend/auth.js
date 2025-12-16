// auth.js - теперь работает с API
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registerLink = document.getElementById('registerLink');

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            if (!username || !password) {
                showMessage('Заполните все поля', 'error');
                return;
            }

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
            submitBtn.disabled = true;

            try {
                const result = await apiService.login(username, password);
                
                if (result.success) {
                    showMessage(result.message, 'success');
                    
                    // Сохраняем пользователя для фронтенда
                    sessionStorage.setItem('currentUser', JSON.stringify(result.user));
                    
                    setTimeout(() => {
                        window.location.href = `${result.user.role}-dashboard.html`;
                    }, 1000);
                } else {
                    showMessage(result.error, 'error');
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error('Login error:', error);
                showMessage('Ошибка соединения с сервером', 'error');
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Демо-аккаунты
    document.querySelectorAll('.demo-account').forEach(account => {
        account.style.cursor = 'pointer';
        account.addEventListener('click', function() {
            const text = this.textContent;
            const match = text.match(/(\w+)\s+\/\s+(\w+)/);
            if (match) {
                document.getElementById('username').value = match[1];
                document.getElementById('password').value = match[2];
                showMessage(`Заполнены данные для: ${match[1]}`, 'info');
            }
        });
    });

    // Регистрация
    if (registerLink) {
        registerLink.addEventListener('click', function(e) {
            e.preventDefault();
            showMessage('Для получения доступа обратитесь к преподавателю', 'info');
        });
    }
});

// Функция выхода
async function logout() {
    try {
        await apiService.logout();
        sessionStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Fallback
        sessionStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }
}

// Проверка авторизации
async function checkAuth(requiredRole = null) {
    try {
        const result = await apiService.checkAuth();
        
        if (result.authenticated) {
            if (requiredRole && result.user.role !== requiredRole) {
                window.location.href = 'login.html';
                return null;
            }
            sessionStorage.setItem('currentUser', JSON.stringify(result.user));
            return result.user;
        } else {
            window.location.href = 'login.html';
            return null;
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = 'login.html';
        return null;
    }
}

// Вспомогательные функции
function showMessage(message, type) {
    const existingMessage = document.querySelector('.auth-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `auth-message auth-message-${type}`;
    messageDiv.innerHTML = `
        <i class="fas fa-${getMessageIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    messageDiv.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        font-weight: 500;
        font-size: 0.9rem;
        animation: slideIn 0.3s ease;
    `;
    
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
        }
    };

    Object.assign(messageDiv.style, styles[type]);
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.insertBefore(messageDiv, loginForm.firstChild);
    }

    if (type === 'info') {
        setTimeout(() => {
            messageDiv.remove();
        }, 4000);
    }
}

function getMessageIcon(type) {
    const icons = {
        error: 'exclamation-circle',
        success: 'check-circle',
        info: 'info-circle'
    };
    return icons[type];
}

// Добавь в auth.js эту функцию для главной страницы
function updateMainNavigation(user) {
    // Та же логика что и в script.js
    const nav = document.querySelector('.nav ul');
    if (!nav) return;
    
    const loginButton = nav.querySelector('a[href="login.html"]');
    if (loginButton) {
        loginButton.textContent = 'Личный кабинет';
        loginButton.href = `${user.role}-dashboard.html`;
        loginButton.classList.remove('btn-outline');
        loginButton.classList.add('btn-primary');
    }
}


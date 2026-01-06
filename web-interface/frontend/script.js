// Скрипт для главной страницы
document.addEventListener('DOMContentLoaded', function() {
    // Плавная прокрутка для навигационных ссылок
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            
            // Если это якорная ссылка (начинается с #), выполняем плавную прокрутку
            if (targetId.startsWith('#')) {
                e.preventDefault();
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // Проверяем авторизацию для обновления навигации
    checkAuthForNavigation();
});

async function checkAuthForNavigation() {
    try {
        const response = await fetch('/api/check-auth', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
                updateNavigationForAuth(data.user);
                updateHeroButtonsForAuth(data.user);
            }
        }
    } catch (error) {
        console.log('Auth check for navigation:', error);
    }
}

function updateHeroButtonsForAuth(user) {
    // Обновляем кнопки в hero секции
    const heroButtons = document.querySelector('.hero-buttons');
    if (!heroButtons) return;
    
    // Находим все кнопки с ссылкой на login.html
    const loginButtons = heroButtons.querySelectorAll('a[href="login.html"]');
    
    loginButtons.forEach(button => {
        if (user.role === 'student') {
            button.href = 'student-dashboard.html';
            button.textContent = 'Личный кабинет';
        } else if (user.role === 'teacher') {
            button.href = 'teacher-dashboard.html';
            button.textContent = 'Личный кабинет';
        }
    });
    
    // Также обновляем кнопку в CTA секции
    const ctaButton = document.querySelector('.cta a[href="login.html"]');
    if (ctaButton) {
        if (user.role === 'student') {
            ctaButton.href = 'student-dashboard.html';
            ctaButton.textContent = 'Личный кабинет';
        } else if (user.role === 'teacher') {
            ctaButton.href = 'teacher-dashboard.html';
            ctaButton.textContent = 'Личный кабинет';
        }
    }
}

function updateNavigationForAuth(user) {
    const nav = document.querySelector('.nav ul');
    if (!nav) return;
    
    const loginButton = nav.querySelector('a[href="login.html"]');
    if (loginButton) {
        // Удаляем старую кнопку входа
        loginButton.remove();
        
        // Создаем выпадающее меню пользователя
        const userMenu = document.createElement('li');
        userMenu.className = 'user-menu';
        
        // Определяем ссылку на ЛК в зависимости от роли
        const dashboardLink = user.role === 'student' ? 'student-dashboard.html' : 'teacher-dashboard.html';
        
        userMenu.innerHTML = `
            <a href="${dashboardLink}" class="user-name-link">
                <span class="user-name">${user.name}</span>
                <i class="fas fa-chevron-down"></i>
            </a>
            <div class="user-dropdown">
                <a href="#" class="logout-link"><i class="fas fa-sign-out-alt"></i> Выйти</a>
            </div>
        `;
        
        // Находим место для вставки
        nav.appendChild(userMenu);
        
        // Добавляем обработчик для выхода
        const logoutLink = userMenu.querySelector('.logout-link');
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
        
        // Добавляем обработчик для клика на имя (на всякий случай)
        const userNameLink = userMenu.querySelector('.user-name-link');
        userNameLink.addEventListener('click', function(e) {
            // Позволяем обычный переход по ссылке
            // Не нужно предотвращать стандартное поведение
        });
    }
}

async function logout() {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Перенаправляем на главную страницу
        window.location.href = 'index.html';
    }
}

// Простая анимация для карточек
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Наблюдаем за карточками
document.querySelectorAll('.about-card, .feature-item, .lab-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});
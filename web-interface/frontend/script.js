// script.js - для главной страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏠 Главная страница загружена');
    
    initNavigation();
    initAnimations();
    initHeaderEffects();
    updateNavigationForAuth(); // ОБНОВЛЯЕМ НАВИГАЦИЮ ДЛЯ АВТОРИЗОВАННЫХ
});

// Инициализация навигации
function initNavigation() {
    // Плавная прокрутка к якорям
    const navLinks = document.querySelectorAll('.nav-link');
    
    for (let link of navLinks) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    }
}

// Анимации
function initAnimations() {
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
    const animatedElements = document.querySelectorAll('.about-card, .feature-item, .scenario-card');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Добавляем интерактивность к карточкам
    const cards = document.querySelectorAll('.about-card, .scenario-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Эффекты шапки
function initHeaderEffects() {
    const header = document.querySelector('.header');
    if (!header) return;

    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            header.style.background = 'rgba(15, 23, 42, 0.95)';
            header.style.backdropFilter = 'blur(10px)';
        } else {
            header.style.background = 'var(--bg-secondary)';
            header.style.backdropFilter = 'none';
        }

        lastScrollY = window.scrollY;
    });
}

// ОБНОВЛЯЕМ НАВИГАЦИЮ ДЛЯ АВТОРИЗОВАННЫХ ПОЛЬЗОВАТЕЛЕЙ
async function updateNavigationForAuth() {
    try {
        const user = await checkAuthSoft();
        if (user) {
            updateNavigationForLoggedInUser(user);
            updateHeroSectionForAuth(user); // ОБНОВЛЯЕМ ГЕРОЙ-СЕКЦИЮ
        }
    } catch (error) {
        console.log('Ошибка проверки авторизации:', error);
    }
}

// Мягкая проверка авторизации для главной страницы
async function checkAuthSoft() {
    try {
        // Сначала проверяем sessionStorage
        const storedUser = sessionStorage.getItem('currentUser');
        if (storedUser) {
            console.log('👤 Пользователь из sessionStorage:', JSON.parse(storedUser).name);
            return JSON.parse(storedUser);
        }
        
        // Затем проверяем API, но не редиректим при ошибке
        const response = await fetch('/api/check-auth', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.authenticated) {
                console.log('👤 Пользователь из API:', result.user.name);
                sessionStorage.setItem('currentUser', JSON.stringify(result.user));
                return result.user;
            }
        }
        console.log('👤 Пользователь не авторизован');
        return null;
    } catch (error) {
        console.log('Ошибка мягкой проверки авторизации:', error);
        return null;
    }
}

// ОБНОВЛЯЕМ НАВИГАЦИЮ ДЛЯ АВТОРИЗОВАННОГО ПОЛЬЗОВАТЕЛЯ
// ОБНОВЛЯЕМ НАВИГАЦИЮ ДЛЯ АВТОРИЗОВАННОГО ПОЛЬЗОВАТЕЛЯ
function updateNavigationForLoggedInUser(user) {
    console.log('🔄 Обновляем навигацию для:', user.name);
    
    const nav = document.querySelector('.nav ul');
    if (!nav) {
        console.error('❌ Навигация не найдена');
        return;
    }
    
    // Находим кнопку "Войти"
    const loginButton = nav.querySelector('a[href="login.html"]');
    if (loginButton) {
        console.log('✅ Нашли кнопку входа, меняем на "Личный кабинет"');
        
        // Меняем на "Личный кабинет" которая ведет в личный кабинет
        loginButton.textContent = 'Личный кабинет';
        loginButton.href = `${user.role}-dashboard.html`;
        loginButton.classList.remove('btn-outline');
        loginButton.classList.add('btn-primary');
        
        // Добавляем кнопку выхода
        const logoutItem = document.createElement('li');
        logoutItem.innerHTML = `
            <a href="#" class="btn btn-outline" onclick="logoutFromMain(); return false;">
                <i class="fas fa-sign-out-alt"></i> Выйти
            </a>
        `;
        nav.appendChild(logoutItem);
        
        console.log('✅ Навигация обновлена');
    } else {
        console.error('❌ Кнопка входа не найдена в навигации');
    }
}

// ОБНОВЛЯЕМ ГЕРОЙ-СЕКЦИЮ ДЛЯ АВТОРИЗОВАННЫХ ПОЛЬЗОВАТЕЛЕЙ
function updateHeroSectionForAuth(user) {
    console.log('🎯 Обновляем герой-секцию для:', user.name);
    
    const heroSection = document.querySelector('.hero');
    if (!heroSection) {
        console.error('❌ Герой-секция не найдена');
        return;
    }
    
    // Находим кнопку "Начать сейчас" в герой-секции
    const startButton = heroSection.querySelector('a[href="login.html"]');
    if (startButton) {
        console.log('✅ Меняем кнопку "Начать сейчас" на личный кабинет');
        startButton.textContent = 'Продолжить обучение';
        startButton.href = `${user.role}-dashboard.html`;
    }
    
    // Находим кнопку "Войти в систему" в CTA секции
    const ctaSection = document.querySelector('.cta');
    if (ctaSection) {
        const ctaButton = ctaSection.querySelector('a[href="login.html"]');
        if (ctaButton) {
            console.log('✅ Меняем кнопку в CTA на "Начать"');
            ctaButton.textContent = 'Начать';
            ctaButton.href = `${user.role}-dashboard.html`;
        }
    }
    
    console.log('✅ Герой-секция обновлена');
}

// Функция выхода для главной страницы
async function logoutFromMain() {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        sessionStorage.removeItem('currentUser');
        // Обновляем страницу чтобы показать изменения
        window.location.reload();
    }
}
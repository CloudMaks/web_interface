// student-dashboard.js - исправленная версия
let currentLabs = [];

document.addEventListener('DOMContentLoaded', async function() {
    await initializeStudentDashboard();
});

async function initializeStudentDashboard() {
    try {
        const user = await checkAuth('student');
        if (!user) return;

        loadUserData(user);
        await loadStudentData();
        setupEventListeners();
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showNotification('Ошибка загрузки dashboard', 'error');
    }
}

function loadUserData(user) {
    document.getElementById('userName').textContent = user.name;
    document.getElementById('studentName').textContent = user.name;
    document.getElementById('studentGroup').textContent = `Группа: ${user.group}`;
}

async function loadStudentData() {
    try {
        console.log('👤 Загружаем данные студента...');
        
        const labsResult = await apiService.getLabs();
        console.log('📚 Ответ с лабораторными:', labsResult);
        
        if (labsResult && labsResult.success && labsResult.labs) {
            currentLabs = labsResult.labs;
            console.log('✅ Лабораторные загружены:', currentLabs.length, 'работ');
            
            // Добавляем статусы для совместимости
            currentLabs.forEach(lab => {
                if (!lab.status) {
                    lab.status = 'not_started';
                }
            });
            
            updateStatistics(currentLabs);
            renderLabs('all');
            initProgressChart(currentLabs);
        } else {
            console.error('❌ Нет данных в ответе');
            loadMockData();
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
        loadMockData();
    }
}

function updateStatistics(labs) {
    const totalLabs = labs.length;
    const completedLabs = labs.filter(lab => lab.status === 'completed').length;
    const successRate = totalLabs > 0 ? Math.round((completedLabs / totalLabs) * 100) : 0;
    
    document.getElementById('totalLabs').textContent = totalLabs;
    document.getElementById('completedLabs').textContent = completedLabs;
    document.getElementById('successRate').textContent = `${successRate}%`;
    
    document.getElementById('completedCount').textContent = `${completedLabs} из ${totalLabs}`;
    
    const completedWithScore = labs.filter(lab => lab.score);
    const averageGrade = completedWithScore.length > 0 
        ? (completedWithScore.reduce((sum, lab) => sum + lab.score, 0) / completedWithScore.length).toFixed(1)
        : '0.0';
    
    document.getElementById('averageGrade').textContent = averageGrade;
    document.getElementById('lastActivity').textContent = new Date().toLocaleDateString('ru-RU');
}

function renderLabs(filter = 'all') {
    const container = document.getElementById('labsContainer');
    console.log('🔍 Контейнер labsContainer:', container);
    
    if (!container) {
        console.error('❌ Контейнер labsContainer не найден!');
        return;
    }
    
    container.innerHTML = '';
    
    console.log('📊 Все лабораторные:', currentLabs);
    console.log('🎯 Фильтр:', filter);
    
    const filteredLabs = filter === 'all' 
        ? currentLabs 
        : currentLabs.filter(lab => lab.status === filter);
    
    console.log('✅ Отфильтрованные лабораторные:', filteredLabs);
    
    if (filteredLabs.length === 0) {
        console.log('⚠️ Нет лабораторных для отображения');
        container.innerHTML = '<div class="no-labs">Нет лабораторных работ</div>';
        return;
    }
    
    console.log('🎨 Создаем карточки...');
    filteredLabs.forEach(lab => {
        const labCard = createLabCard(lab);
        container.appendChild(labCard);
    });
    
    console.log('✅ Карточки созданы!');
}

function createLabCard(lab) {
    console.log('🎴 Создаем карточку для:', lab.title);
    
    const card = document.createElement('div');
    card.className = `lab-card ${lab.status}`;
    card.innerHTML = `
        <div class="lab-header">
            <h3 class="lab-title">${lab.title}</h3>
            <span class="lab-status status-${lab.status}">
                ${getStatusText(lab.status)}
            </span>
        </div>
        <p class="lab-description">${lab.description}</p>
        <div class="lab-meta">
            <span class="lab-difficulty difficulty-${lab.difficulty}">
                <i class="fas fa-${getDifficultyIcon(lab.difficulty)}"></i>
                ${getDifficultyText(lab.difficulty)}
            </span>
            <span class="lab-due">Срок: ${lab.due_date ? new Date(lab.due_date).toLocaleDateString('ru-RU') : 'не указан'}</span>
        </div>
        ${lab.score ? `<div class="lab-score">Оценка: <strong>${lab.score}/100</strong></div>` : ''}
    `;
    
    card.addEventListener('click', () => openLabModal(lab));
    return card;
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function getStatusText(status) {
    const statusMap = {
        'completed': 'Выполнено',
        'submitted': 'На проверке',
        'not_started': 'Не начато',
        'pending': 'В процессе'
    };
    return statusMap[status] || status;
}

function getDifficultyText(difficulty) {
    const difficultyMap = {
        'easy': 'Легкая',
        'medium': 'Средняя', 
        'hard': 'Сложная'
    };
    return difficultyMap[difficulty] || difficulty;
}

function getDifficultyIcon(difficulty) {
    const iconMap = {
        'easy': 'smile',
        'medium': 'meh',
        'hard': 'frown'
    };
    return iconMap[difficulty] || 'question';
}

// МОДАЛЬНОЕ ОКНО ЛАБОРАТОРНОЙ
function openLabModal(lab) {
    const modal = document.getElementById('labModal');
    const title = document.getElementById('modalLabTitle');
    const description = document.getElementById('modalLabDescription');
    const instructions = document.getElementById('modalLabInstructions');
    
    if (!modal || !title) {
        // Если модального окна нет, переходим на страницу лабораторной
        window.location.href = `lab-workspace.html?id=${lab.id}`;
        return;
    }
    
    title.textContent = lab.title;
    description.textContent = lab.description;
    
    if (instructions) {
        instructions.innerHTML = '';
        if (lab.instructions && lab.instructions.length > 0) {
            lab.instructions.forEach(instruction => {
                const li = document.createElement('li');
                li.textContent = instruction;
                instructions.appendChild(li);
            });
        } else {
            instructions.innerHTML = '<li>Инструкции будут доступны на странице лабораторной работы</li>';
        }
    }
    
    modal.style.display = 'block';
}

// ЗАГЛУШКА ДАННЫХ
function loadMockData() {
    console.log('🔄 Загружаем тестовые данные...');
    currentLabs = [
        {
            id: 1,
            title: "SQL-инъекции: основы",
            description: "Изучение механизмов SQL-инъекций и методов защиты",
            difficulty: "easy",
            status: "completed",
            score: 95,
            due_date: "2024-02-15"
        },
        {
            id: 2,
            title: "XSS атаки и защита", 
            description: "Исследование межсайтового скриптинга",
            difficulty: "medium",
            status: "not_started",
            score: null,
            due_date: "2024-02-28"
        }
    ];
    
    updateStatistics(currentLabs);
    renderLabs(currentLabs);
    initProgressChart(currentLabs);
}

// ГРАФИК ПРОГРЕССА
function initProgressChart(labs) {
    const ctx = document.getElementById('progressChart');
    if (!ctx) {
        console.log('📊 График прогресса не найден');
        return;
    }
    
    const completedLabs = labs.filter(lab => lab.status === 'completed').length;
    const pendingLabs = labs.filter(lab => lab.status === 'pending' || lab.status === 'submitted').length;
    const notStartedLabs = labs.filter(lab => lab.status === 'not_started').length;
    
    try {
        new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Выполнено', 'В процессе', 'Не начато'],
                datasets: [{
                    data: [completedLabs, pendingLabs, notStartedLabs],
                    backgroundColor: [
                        '#22c55e',
                        '#eab308', 
                        '#64748b'
                    ],
                    borderWidth: 2,
                    borderColor: '#1e293b'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#f8fafc',
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
        console.log('📈 График прогресса создан');
    } catch (error) {
        console.error('❌ Ошибка создания графика:', error);
    }
}

// УВЕДОМЛЕНИЯ
function showNotification(message, type) {
    // Простая реализация уведомлений
    alert(`${type.toUpperCase()}: ${message}`);
}

// ОБРАБОТЧИКИ СОБЫТИЙ
function setupEventListeners() {
    // Фильтры лабораторных
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderLabs(this.dataset.filter);
        });
    });
    
    // Закрытие модального окна
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            document.getElementById('labModal').style.display = 'none';
        });
    }
    
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('labModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Отправка лабораторной работы
    const submitBtn = document.getElementById('submitLab');
    if (submitBtn) {
        submitBtn.addEventListener('click', function() {
            const answer = document.getElementById('labAnswer')?.value.trim();
            if (!answer) {
                alert('Пожалуйста, введите ответ на задание');
                return;
            }
            
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
            this.disabled = true;
            
            setTimeout(() => {
                alert('Работа отправлена на проверку!');
                document.getElementById('labModal').style.display = 'none';
                this.innerHTML = 'Отправить на проверку';
                this.disabled = false;
                document.getElementById('labAnswer').value = '';
            }, 2000);
        });
    }
    
    // Выход из системы
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
}
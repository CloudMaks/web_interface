let currentUser = null;
let currentLabs = [];

document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем авторизацию
    currentUser = await requireAuth('student');
    if (!currentUser) return;
    
    // Загружаем данные дашборда
    await loadDashboardData();
    
    // Настраиваем обработчики событий
    setupEventListeners();
});

async function loadDashboardData() {
    try {
        showLoading();
        
        const response = await apiRequest('/api/student/dashboard');
        
        if (response.success) {
            updateUserInfo(response.user);
            updateStats(response.stats);
            renderLabs(response.labs);
            renderProgressChart(response.labs, response.stats);
            currentLabs = response.labs;
        } else {
            showNotification(response.error || 'Ошибка загрузки данных', 'error');
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
        showNotification('Ошибка загрузки данных', 'error');
    } finally {
        hideLoading();
    }
}

function updateUserInfo(user) {
    document.getElementById('userName').textContent = user.name;
    document.getElementById('studentName').textContent = user.name;
    document.getElementById('studentGroup').textContent = `Группа: ${user.group}`;
}

function updateStats(stats) {
    const statsContainer = document.getElementById('statsContainer');
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-tasks"></i>
            </div>
            <h3>${stats.total_labs}</h3>
            <p>Всего заданий</p>
        </div>
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <h3>${stats.completed_labs}</h3>
            <p>Выполнено</p>
        </div>
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-chart-line"></i>
            </div>
            <h3>${stats.success_rate}%</h3>
            <p>Успеваемость</p>
        </div>
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-star"></i>
            </div>
            <h3>${stats.average_score}</h3>
            <p>Средний балл</p>
        </div>
    `;
    
    // Обновляем статистику прогресса
    const progressStats = document.getElementById('progressStats');
    progressStats.innerHTML = `
        <li>
            <span>Выполнено заданий:</span>
            <span>${stats.completed_labs} из ${stats.total_labs}</span>
        </li>
        <li>
            <span>Успеваемость:</span>
            <span>${stats.success_rate}%</span>
        </li>
        <li>
            <span>Средний балл:</span>
            <span>${stats.average_score}</span>
        </li>
        <li>
            <span>Последняя активность:</span>
            <span>${new Date().toLocaleDateString('ru-RU')}</span>
        </li>
    `;
}

function renderLabs(labs) {
    const container = document.getElementById('labsContainer');
    container.innerHTML = '';
    
    labs.forEach(lab => {
        const labCard = createLabCard(lab);
        container.appendChild(labCard);
    });
}

function createLabCard(lab) {
    const card = document.createElement('div');
    card.className = 'lab-card';
    card.dataset.labId = lab.id;
    
    // Определяем текст кнопки и статус
    let buttonText = 'Начать';
    let buttonClass = 'btn-primary';
    let statusText = getStatusText(lab.status);
    let statusClass = `status-${lab.status}`;
    let isPreparatory = lab.lab_number === 0;
    
    if (lab.status === 'completed') {
        if (isPreparatory) {
            // Для подготовительной работы - кнопка "Просмотр" ведет на страницу выполнения
            buttonText = 'Просмотр';
            buttonClass = 'btn-secondary';
            statusText = 'Выполнено';
        } else if (lab.lab_number in [1, 2]) {
            // Для ЛР1 и ЛР2 показываем баллы из 30
            buttonText = 'Просмотр';
            buttonClass = 'btn-secondary';
            const maxScore = 30;
            statusText = `Выполнено: ${lab.score}/${maxScore} баллов`;
        } else {
            buttonText = 'Просмотр';
            buttonClass = 'btn-secondary';
            statusText = `Выполнено: ${lab.score}/${lab.max_score} баллов`;
        }
    } else if (lab.status === 'in_progress') {
        buttonText = 'Продолжить';
        if (lab.score > 0 && lab.lab_number !== 0) {
            const maxScore = lab.lab_number in [1, 2] ? 30 : lab.max_score;
            statusText = `В процессе: ${lab.score} из ${maxScore} баллов`;
        }
    } else if (!lab.can_start) {
        buttonText = 'Недоступно';
        buttonClass = 'btn-secondary disabled';
        statusText = 'Требуется выполнить предыдущую работу';
    }
    
    card.innerHTML = `
        <div class="lab-header">
            <div class="lab-title">
                <h3>${lab.title}</h3>
                <div class="lab-number">
                    ${isPreparatory ? 'Подготовительный этап' : `Практическая работа №${lab.lab_number}`}
                </div>
            </div>
            <div class="lab-status ${statusClass}">
                ${statusText}
            </div>
        </div>
        
        <p class="lab-description">${lab.description}</p>
        
        <div class="lab-meta">
            <div class="lab-meta-left">
                <span class="lab-difficulty ${lab.difficulty}">
                    <i class="fas fa-${getDifficultyIcon(lab.difficulty)}"></i>
                    ${getDifficultyText(lab.difficulty)}
                </span>
                ${lab.score > 0 && lab.lab_number !== 0 ? `
                    <span class="lab-score">
                        <i class="fas fa-star"></i>
                        Баллы: ${lab.score}/${lab.lab_number in [1, 2] ? 30 : lab.max_score}
                    </span>
                ` : ''}
            </div>
            
            ${lab.status !== 'completed' ? `
                <button class="btn ${buttonClass} start-lab-btn" 
                        ${!lab.can_start ? 'disabled' : ''}
                        data-lab-id="${lab.id}">
                    ${buttonText}
                </button>
            ` : `
                <button class="btn ${buttonClass} view-lab-btn" 
                        data-lab-id="${lab.id}"
                        onclick="viewLab(${lab.id})">
                    <i class="fas fa-eye"></i> ${buttonText}
                </button>
            `}
        </div>
    `;
    
    // Добавляем обработчик для кнопки
    if (lab.status !== 'completed' && lab.can_start) {
        const startBtn = card.querySelector('.start-lab-btn');
        startBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startLab(lab.id);
        });
    }
    
    return card;
}

// Функция для просмотра выполненных работ
function viewLab(labId) {
    // Находим работу
    const lab = currentLabs.find(l => l.id === labId);
    
    if (!lab) {
        showNotification('Практическая работа не найдена', 'error');
        return;
    }
    
    // Всегда перенаправляем на страницу выполнения работы
    window.location.href = `lab-workspace.html?labId=${labId}`;
}

// Добавить функцию для иконок сложности
function getDifficultyIcon(difficulty) {
    const icons = {
        'easy': 'smile',
        'medium': 'meh',
        'hard': 'frown'
    };
    return icons[difficulty] || 'question';
}

function getStatusText(status) {
    const statusMap = {
        'not_started': 'Не начато',
        'in_progress': 'В процессе',
        'completed': 'Выполнено'
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

// student-dashboard.js
async function startLab(labId) {
    try {
        const response = await apiRequest(`/api/student/lab/${labId}/start`, {
            method: 'POST'
        });
        
        if (response.success) {
            // Переходим на страницу выполнения
            window.location.href = `lab-workspace.html?labId=${labId}`;
        } else {
            showNotification(response.error || 'Ошибка начала практической', 'error');
        }
    } catch (error) {
        console.error('Start lab error:', error);
        showNotification('Ошибка начала практической', 'error');
    }
}

function renderProgressChart(labs, stats) {
    const ctx = document.getElementById('progressChart');
    if (!ctx) return;
    
    try {
        // Фильтруем только ЛР1 и ЛР2 (исключаем подготовительную lab_number=0)
        const relevantLabs = labs.filter(lab => lab.lab_number > 0);
        
        const completedLabs = relevantLabs.filter(l => l.status === 'completed').length;
        const inProgressLabs = relevantLabs.filter(l => l.status === 'in_progress').length;
        const notStartedLabs = relevantLabs.filter(l => l.status === 'not_started').length;
        
        // Если все практические работы выполнены, показываем только "Выполнено"
        let chartData;
        let chartLabels;
        
        if (completedLabs === relevantLabs.length) {
            chartData = [completedLabs];
            chartLabels = ['Выполнено'];
        } else {
            chartData = [completedLabs, inProgressLabs, notStartedLabs];
            chartLabels = ['Выполнено', 'В процессе', 'Не начато'];
        }
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: [
                        'rgba(34, 197, 94, 0.7)',    // Зеленый - выполнено
                        'rgba(234, 179, 8, 0.7)',    // Желтый - в процессе
                        'rgba(100, 116, 139, 0.7)'   // Серый - не начато
                    ].slice(0, chartData.length),
                    borderColor: [
                        '#22c55e',
                        '#eab308', 
                        '#64748b'
                    ].slice(0, chartData.length),
                    borderWidth: 2
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
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Chart error:', error);
    }
}

function setupEventListeners() {
    // Кнопка выхода
    const logoutBtn = document.querySelector('[onclick="logout()"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
    
    // Модальное окно результатов
    const modal = document.getElementById('resultModal');
    if (modal) {
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.querySelector('#modalOkBtn').addEventListener('click', () => {
            modal.style.display = 'none';
            // Перезагружаем данные
            loadDashboardData();
        });
        
        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

// Функция для отображения результатов
function showResultModal(data) {
    const modal = document.getElementById('resultModal');
    if (!modal) return;
    
    // Уже получаем время в МСК с сервера
    document.getElementById('modalScore').textContent = `${data.score}/${data.max_score}`;
    document.getElementById('modalErrors').textContent = data.errors || '0';
    document.getElementById('modalStartTime').textContent = data.start_time || '-';
    document.getElementById('modalEndTime').textContent = data.end_time || '-';
    document.getElementById('modalTotalTime').textContent = data.total_time || '00:00:00';
    
    modal.style.display = 'block';
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showLoading() {
    // Можно добавить индикатор загрузки
}

function hideLoading() {
    // Скрыть индикатор загрузки
}

// Экспортируем функции для использования в других файлах
window.startLab = startLab;
window.logout = logout;
window.showResultModal = showResultModal;
window.viewLab = viewLab;
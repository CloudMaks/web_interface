let currentUser = null;
let currentStudents = [];
let currentLabs = [];

document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем авторизацию
    currentUser = await requireAuth('teacher');
    if (!currentUser) return;
    
    // Загружаем данные дашборда
    await loadDashboardData();
    
    // Настраиваем обработчики событий
    setupEventListeners();
});

async function loadDashboardData() {
    try {
        showLoading();
        
        // Загружаем статистику, студентов и практические параллельно
        const [dashboardRes, studentsRes, labsRes] = await Promise.all([
            apiRequest('/api/teacher/dashboard'),
            apiRequest('/api/teacher/students'),
            apiRequest('/api/teacher/labs')
        ]);
        
        if (dashboardRes.success) {
            updateUserInfo(dashboardRes.user);
            updateStats(dashboardRes.stats);
        }
        
        if (studentsRes.success) {
            currentStudents = studentsRes.students;
            renderStudentsTable(currentStudents);
        }
        
        if (labsRes.success) {
            currentLabs = labsRes.labs;
            renderLabs(currentLabs);
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
    document.getElementById('teacherName').textContent = user.name;
    document.getElementById('teacherDepartment').textContent = `Кафедра: ${user.department}`;
}

function updateStats(stats) {
    const statsContainer = document.getElementById('statsContainer');
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-users"></i>
            </div>
            <h3>${stats.total_students}</h3>
            <p>Студентов</p>
        </div>
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-tasks"></i>
            </div>
            <h3>${stats.total_labs}</h3>
            <p>Практических работ</p>
        </div>
    `;
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTable');
    tbody.innerHTML = '';
    
    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem;">
                    Нет студентов
                </td>
            </tr>
        `;
        return;
    }
    
    students.forEach(student => {
        // Форматируем дату последней активности
        let lastActivity = student.last_activity || 'Нет данных';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.name}</td>
            <td>${student.group}</td>
            <td>${student.completed_labs_count}</td>
            <td>${student.average_score}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-outline" onclick="viewStudentDetails(${student.id})" title="Подробный просмотр">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="editStudent(${student.id})" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="deleteStudent(${student.id})" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
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
    
    card.innerHTML = `
        <div class="lab-header">
            <div class="lab-title">
                <h3>${lab.title}</h3>
                <div class="lab-number">
                    ${lab.lab_number === 0 ? 'Подготовительный этап' : `Практическая работа №${lab.lab_number}`}
                </div>
            </div>
            <div class="lab-stats">
                <div class="lab-stat">
                    <i class="fas fa-users"></i>
                    <span>${lab.completed_count} выполнено</span>
                </div>
                <div class="lab-stat">
                    <i class="fas fa-star"></i>
                    <span>Средний балл: ${lab.average_score}</span>
                </div>
            </div>
        </div>
        
        <p>${lab.description}</p>
        
        <div class="lab-meta">
            <span class="lab-difficulty ${lab.difficulty}">${getDifficultyText(lab.difficulty)}</span>
            <button class="btn btn-primary" onclick="showLabStats(${lab.id})">
                <i class="fas fa-chart-bar"></i> Статистика
            </button>
        </div>
    `;
    
    return card;
}

function getDifficultyText(difficulty) {
    const difficultyMap = {
        'easy': 'Легкая',
        'medium': 'Средняя',
        'hard': 'Сложная'
    };
    return difficultyMap[difficulty] || difficulty;
}

// Управление студентами
async function addStudent() {
    const name = document.getElementById('newStudentName').value.trim();
    const username = document.getElementById('newStudentUsername').value.trim();
    const group = document.getElementById('newStudentGroup').value.trim();
    const password = document.getElementById('newStudentPassword').value;
    
    if (!name || !username || !group || !password) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    try {
        const response = await apiRequest('/api/teacher/students', {
            method: 'POST',
            body: JSON.stringify({
                name,
                username,
                group,
                password
            })
        });
        
        if (response.success) {
            showNotification('Студент успешно добавлен', 'success');
            closeModal('addStudentModal');
            document.getElementById('addStudentForm').reset();
            await loadDashboardData();
        } else {
            showNotification(response.error || 'Ошибка добавления студента', 'error');
        }
    } catch (error) {
        console.error('Add student error:', error);
        showNotification('Ошибка добавления студента', 'error');
    }
}

async function editStudent(studentId) {
    try {
        const response = await apiRequest(`/api/teacher/students/${studentId}`);
        
        if (response.success) {
            const student = response.student;
            
            document.getElementById('editStudentId').value = student.id;
            document.getElementById('editStudentName').value = student.name;
            document.getElementById('editStudentUsername').value = student.username;
            document.getElementById('editStudentGroup').value = student.group;
            document.getElementById('editStudentPassword').value = '';
            
            openModal('editStudentModal');
        } else {
            showNotification(response.error || 'Ошибка загрузки данных студента', 'error');
        }
    } catch (error) {
        console.error('Edit student error:', error);
        showNotification('Ошибка загрузки данных студента', 'error');
    }
}

async function updateStudent() {
    const studentId = document.getElementById('editStudentId').value;
    const name = document.getElementById('editStudentName').value.trim();
    const username = document.getElementById('editStudentUsername').value.trim();
    const group = document.getElementById('editStudentGroup').value.trim();
    const password = document.getElementById('editStudentPassword').value;
    
    if (!name || !username || !group) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }
    
    const data = { name, username, group };
    if (password) {
        if (password.length < 6) {
            showNotification('Пароль должен быть не менее 6 символов', 'error');
            return;
        }
        data.password = password;
    }
    
    try {
        const response = await apiRequest(`/api/teacher/students/${studentId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        
        if (response.success) {
            showNotification('Данные студента обновлены', 'success');
            closeModal('editStudentModal');
            await loadDashboardData();
        } else {
            showNotification(response.error || 'Ошибка обновления данных', 'error');
        }
    } catch (error) {
        console.error('Update student error:', error);
        showNotification('Ошибка обновления данных', 'error');
    }
}

async function deleteStudent(studentId) {
    if (!confirm('Вы уверены, что хотите удалить этого студента? Все его работы также будут удалены.')) {
        return;
    }
    
    try {
        const response = await apiRequest(`/api/teacher/students/${studentId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showNotification('Студент удален', 'success');
            await loadDashboardData();
        } else {
            showNotification(response.error || 'Ошибка удаления студента', 'error');
        }
    } catch (error) {
        console.error('Delete student error:', error);
        showNotification('Ошибка удаления студента', 'error');
    }
}

// Статистика практических работ
async function showLabStats(labId) {
    try {
        const response = await apiRequest(`/api/teacher/labs/${labId}/stats`);
        
        if (response.success) {
            renderLabStats(response);
            openModal('labStatsModal');
        } else {
            showNotification(response.error || 'Ошибка загрузки статистики', 'error');
        }
    } catch (error) {
        console.error('Show lab stats error:', error);
        showNotification('Ошибка загрузки статистики', 'error');
    }
}

function renderLabStats(data) {
    const container = document.getElementById('labStatsContent');
    
    if (data.stats.length === 0) {
        container.innerHTML = '<p>Эту практическую работу еще никто не выполнил.</p>';
        return;
    }
    
    let html = `
        <h3>${data.lab.title}</h3>
        <p>Всего выполнили: ${data.total_completed} студентов</p>
        
        <div class="table-container" style="margin-top: 1.5rem;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Студент</th>
                        <th>Группа</th>
                        <th>Баллы</th>
                        <th>Время начала</th>
                        <th>Время завершения</th>
                        <th>Общее время</th>
                        <th>Попытки по заданиям</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    data.stats.forEach(stat => {
        html += `
            <tr>
                <td>${stat.student_name}</td>
                <td>${stat.student_group}</td>
                <td>${stat.score}</td>
                <td>${stat.start_time}</td>
                <td>${stat.end_time}</td>
                <td>${stat.total_time}</td>
                <td style="max-width: 300px;">
                    <div class="attempts-details">
                        ${stat.attempts_text || 'Нет данных'}
                        ${stat.total_attempts ? `<br><small>Всего попыток: ${stat.total_attempts}</small>` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

async function showStudentAttempts(studentId, labId) {
    try {
        const response = await apiRequest(`/api/teacher/students/${studentId}`);
        
        if (response.success) {
            const student = response.student;
            const labStats = response.stats.labs_stats.find(stat => stat.lab_id === labId);
            
            if (labStats) {
                let html = `
                    <h4>Попытки студента: ${student.name}</h4>
                    <p>Практическая работа: ${labStats.lab_title}</p>
                    <p>Общие попытки: ${labStats.attempts}</p>
                    
                    <h5 style="margin-top: 1rem;">Попытки по заданиям:</h5>
                    <ul>
                `;
                
                Object.entries(labStats.task_attempts).forEach(([taskNum, attempts]) => {
                    html += `<li>Задание ${taskNum}: ${attempts} попыток</li>`;
                });
                
                html += '</ul>';
                
                alert(html);
            }
        }
    } catch (error) {
        console.error('Show student attempts error:', error);
    }
}

function formatTime(seconds) {
    if (!seconds) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Управление модальными окнами
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
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
    
    // Добавление студента
    document.getElementById('addStudentBtn').addEventListener('click', () => {
        document.getElementById('addStudentForm').reset();
        openModal('addStudentModal');
    });
    
    // Форма добавления студента
    document.getElementById('addStudentForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addStudent();
    });
    
    // Форма редактирования студента
    document.getElementById('editStudentForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateStudent();
    });
    
    // Закрытие модальных окон
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Закрытие по клику вне модального окна
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    });
	
	// Закрытие модального окна просмотра студента
    const viewStudentModal = document.getElementById('viewStudentModal');
    if (viewStudentModal) {
        viewStudentModal.querySelector('.modal-close').addEventListener('click', () => {
            viewStudentModal.style.display = 'none';
        });
        
        viewStudentModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    }
}

function showLoading() {
    // Можно добавить индикатор загрузки
}

function hideLoading() {
    // Скрыть индикатор загрузки
}

async function viewStudentDetails(studentId) {
    try {
        const response = await apiRequest(`/api/teacher/students/${studentId}`);
        
        if (response.success) {
            const student = response.student;
            const stats = response.stats;
            
            // Время уже приходит отформатированное в МСК с сервера
            let lastActivity = student.last_activity || 'Нет данных';
            
            // Создаем HTML для модального окна
            let html = `
                <div class="student-info-grid">
                    <div class="student-info-item">
                        <label>ФИО:</label>
                        <span class="info-value">${student.name}</span>
                    </div>
                    <div class="student-info-item">
                        <label>Логин:</label>
                        <span class="info-value">${student.username}</span>
                    </div>
                    <div class="student-info-item">
                        <label>Группа:</label>
                        <span class="info-value">${student.group}</span>
                    </div>
                    <div class="student-info-item">
                        <label>Выполнено работ (ЛР1/ЛР2):</label>
                        <span class="info-value">${stats.completed_labs} из ${stats.total_labs}</span>
                    </div>
                    <div class="student-info-item">
                        <label>Средний балл (ЛР1/ЛР2):</label>
                        <span class="info-value">${stats.average_score}</span>
                    </div>
                    <div class="student-info-item">
                        <label>Последняя активность:</label>
                        <span class="info-value">${lastActivity}</span>
                    </div>
                </div>
            `;
            
            // Добавляем информацию о выполненных работах
            if (stats.labs_stats && stats.labs_stats.length > 0) {
                html += `
                    <div style="margin-top: 2rem;">
                        <h3 style="margin-bottom: 1rem;">Выполненные работы:</h3>
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Работа</th>
                                        <th>Баллы</th>
                                        <th>Дата начала</th>
                                        <th>Дата завершения</th>
                                        <th>Время выполнения</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;
                
                stats.labs_stats.forEach(labStat => {
                    html += `
                        <tr>
                            <td>${labStat.lab_title}</td>
                            <td><strong>${labStat.lab_number === 0 ? '-' : labStat.score}</strong></td>
                            <td>${labStat.start_time}</td>
                            <td>${labStat.end_time}</td>
                            <td>${formatTime(labStat.total_time)}</td>
                        </tr>
                    `;
                });
                
                html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div style="margin-top: 2rem; text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fas fa-clipboard-check" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>Студент еще не выполнил ни одной работы</p>
                    </div>
                `;
            }
            
            // Добавляем информацию о попытках по заданиям (только для ЛР1 и ЛР2)
            const labStatsWithAttempts = stats.labs_stats ? 
                stats.labs_stats.filter(lab => lab.lab_number > 0 && lab.task_attempts && Object.keys(lab.task_attempts).length > 0) : [];
            
            if (labStatsWithAttempts.length > 0) {
                html += `
                    <div style="margin-top: 2rem;">
                        <h3 style="margin-bottom: 1rem;">Попытки по заданиям (ЛР1/ЛР2):</h3>
                `;
                
                labStatsWithAttempts.forEach(labStat => {
                    html += `
                        <div style="margin-bottom: 1.5rem;">
                            <h4 style="margin-bottom: 0.5rem; color: var(--text-secondary);">${labStat.lab_title}:</h4>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    `;
                    
                    // Сортируем задания по номеру
                    const sortedTasks = Object.entries(labStat.task_attempts)
                        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
                    
                    sortedTasks.forEach(([taskNum, attempts]) => {
                        html += `
                            <span style="background: var(--bg-secondary); padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.9rem;">
                                Задание ${taskNum}: ${attempts} поп.
                            </span>
                        `;
                    });
                    
                    html += `
                            </div>
                        </div>
                    `;
                });
                
                html += `</div>`;
            }
            
            // Вставляем HTML в модальное окно
            document.getElementById('studentDetailsContent').innerHTML = html;
            
            // Открываем модальное окно
            openModal('viewStudentModal');
        } else {
            showNotification(response.error || 'Ошибка загрузки данных студента', 'error');
        }
    } catch (error) {
        console.error('View student details error:', error);
        showNotification('Ошибка загрузки данных студента', 'error');
    }
}

// Экспортируем функции для глобального использования
window.editStudent = editStudent;
window.deleteStudent = deleteStudent;
window.showLabStats = showLabStats;
window.closeModal = closeModal;
window.logout = logout;
window.formatTime = formatTime;
window.viewStudentDetails = viewStudentDetails;
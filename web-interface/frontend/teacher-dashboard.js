// teacher-dashboard.js - исправленная версия
let currentStudents = [];
let currentLabs = [];
let currentSubmissions = [];

document.addEventListener('DOMContentLoaded', async function() {
    await initializeTeacherDashboard();
});

async function initializeTeacherDashboard() {
    try {
        const user = await checkAuth('teacher');
        if (!user) return;

        loadTeacherData(user);
        await loadTeacherDashboardData();
        setupEventListeners();
    } catch (error) {
        console.error('Teacher dashboard initialization error:', error);
        showNotification('Ошибка инициализации кабинета', 'error');
    }
}

function loadTeacherData(user) {
    document.getElementById('userName').textContent = user.name;
    document.getElementById('teacherName').textContent = user.name;
    document.getElementById('teacherDepartment').textContent = `Кафедра: ${user.department}`;
}

async function loadTeacherDashboardData() {
    try {
        console.log('👨‍🏫 Загружаем данные для преподавателя...');
        
        const [studentsResult, labsResult, submissionsResult] = await Promise.all([
            apiService.getStudents(),
            apiService.getLabs(),
            apiService.getSubmissions()
        ]);

        console.log('📊 Данные студентов:', studentsResult);
        console.log('📚 Данные лабораторных:', labsResult);
        console.log('📨 Данные отправок:', submissionsResult);

        if (studentsResult.success) {
            currentStudents = studentsResult.students;
            renderStudentsTable(currentStudents);
        }

        if (labsResult.success) {
            currentLabs = labsResult.labs;
            renderLabsManagement(currentLabs);
        }

        if (submissionsResult.success) {
            currentSubmissions = submissionsResult.submissions;
            renderSubmissions(currentSubmissions);
        }

        updateTeacherStatistics(currentStudents, currentLabs, currentSubmissions);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных преподавателя:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

function updateTeacherStatistics(students, labs, submissions) {
    document.getElementById('totalStudents').textContent = students.length;
    document.getElementById('totalLabs').textContent = labs.length;
    document.getElementById('submittedLabs').textContent = submissions.filter(s => s.status === 'submitted' || s.status === 'pending').length;
    
    const totalScore = students.reduce((sum, student) => sum + (student.average_score || 0), 0);
    const averageScore = students.length > 0 ? Math.round(totalScore / students.length) : 0;
    document.getElementById('averageScore').textContent = `${averageScore}%`;
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) {
        console.error('❌ tbody studentsTableBody не найден');
        return;
    }
    
    tbody.innerHTML = '';
    
    console.log('🎓 Рендерим студентов:', students);
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Нет студентов</td></tr>';
        return;
    }
    
    students.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.name || 'Не указано'}</td>
            <td>${student.group || '-'}</td>
            <td>${student.completed_labs || 0}</td>
            <td>${student.average_score > 0 ? student.average_score : '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-outline" onclick="viewStudent(${student.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="editStudent(${student.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteStudent(${student.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderLabsManagement(labs) {
    const container = document.getElementById('labsManagementContainer');
    if (!container) {
        console.error('❌ Контейнер labsManagementContainer не найден');
        return;
    }
    
    container.innerHTML = '';
    
    console.log('📚 Рендерим лабораторные:', labs);
    
    if (!labs || labs.length === 0) {
        container.innerHTML = '<div class="no-labs">Нет лабораторных работ</div>';
        return;
    }
    
    labs.forEach(lab => {
        const card = document.createElement('div');
        card.className = 'lab-management-card';
        card.innerHTML = `
            <div class="lab-management-header">
                <h3 class="lab-management-title">${lab.title}</h3>
            </div>
            
            <div class="lab-management-meta">
                <span class="lab-meta-item">
                    <i class="fas fa-tag"></i>
                    ${getCategoryText(lab.category)}
                </span>
                <span class="lab-meta-item difficulty-${lab.difficulty}">
                    <i class="fas fa-${getDifficultyIcon(lab.difficulty)}"></i>
                    ${getDifficultyText(lab.difficulty)}
                </span>
                <span class="lab-meta-item">
                    <i class="fas fa-star"></i>
                    Макс. балл: ${lab.max_score}
                </span>
            </div>
            
            <div class="lab-management-stats">
                <div class="lab-stat">
                    <span class="lab-stat-value">0</span>
                    <span class="lab-stat-label">Студентов</span>
                </div>
                <div class="lab-stat">
                    <span class="lab-stat-value">0</span>
                    <span class="lab-stat-label">Сдали</span>
                </div>
                <div class="lab-stat">
                    <span class="lab-stat-value">0%</span>
                    <span class="lab-stat-label">Успеваемость</span>
                </div>
                <div class="lab-stat">
                    <span class="lab-stat-value">0%</span>
                    <span class="lab-stat-label">Прогресс</span>
                </div>
            </div>
            
            <div class="lab-management-actions">
                <button class="btn btn-sm btn-outline" onclick="viewLabDetails(${lab.id})">
                    <i class="fas fa-chart-bar"></i> Статистика
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderSubmissions(submissions) {
    const container = document.getElementById('submissionsContainer');
    if (!container) {
        console.error('❌ Контейнер submissionsContainer не найден');
        return;
    }
    
    container.innerHTML = '';
    
    const pendingSubmissions = submissions.filter(s => s.status === 'submitted' || s.status === 'pending');
    
    if (pendingSubmissions.length === 0) {
        container.innerHTML = '<div class="no-submissions">Нет работ на проверку</div>';
        return;
    }
    
    pendingSubmissions.forEach(submission => {
        const item = document.createElement('div');
        item.className = 'submission-item';
        item.innerHTML = `
            <div class="submission-info">
                <h4>${submission.lab_title || 'Неизвестная работа'}</h4>
                <div class="submission-meta">
                    <span class="submission-student">${submission.student_name}</span>
                    <span>Группа: ${submission.student_group || '-'}</span>
                    <span>Сдана: ${new Date(submission.submitted_at).toLocaleString('ru-RU')}</span>
                </div>
            </div>
            <div class="submission-actions">
                <button class="btn btn-primary" onclick="reviewSubmission(${submission.id})">
                    <i class="fas fa-check"></i> Проверить
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function getCategoryText(category) {
    const categories = {
        'web-security': 'Веб-безопасность',
        'network-security': 'Сетевая безопасность', 
        'system-security': 'Системная безопасность',
        'cryptography': 'Криптография'
    };
    return categories[category] || category;
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

// ФУНКЦИИ УПРАВЛЕНИЯ
async function addNewStudent() {
    const lastName = document.getElementById('studentLastName').value;
    const firstName = document.getElementById('studentFirstName').value;
    const middleName = document.getElementById('studentMiddleName').value;
    
    const formData = {
        username: document.getElementById('studentLogin').value,
        name: `${lastName} ${firstName} ${middleName}`.trim(),
        group: document.getElementById('studentGroup').value,
        password: document.getElementById('studentPassword').value
    };
    
    try {
        const response = await fetch('/api/teacher/students', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Студент успешно добавлен!', 'success');
            closeModal('addStudentModal');
            document.getElementById('addStudentForm').reset();
            await loadTeacherDashboardData();
        } //else {
            //showNotification('Ошибка: ' + result.error, 'error');
       // }
    } catch (error) {
        showNotification('Ошибка соединения: ' + error, 'error');
    }
}

async function createNewLab() {
    const formData = {
        title: document.getElementById('labTitle').value,
        description: document.getElementById('labDescription').value,
        category: document.getElementById('labCategory').value,
        difficulty: document.getElementById('labDifficulty').value,
        instructions: document.getElementById('labInstructions').value,
        max_score: parseInt(document.getElementById('labMaxScore').value)
    };
    
    try {
        const response = await fetch('/api/teacher/labs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Лабораторная работа создана!', 'success');
            closeModal('addLabModal');
            document.getElementById('addLabForm').reset();
            await loadTeacherDashboardData();
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения: ' + error, 'error');
    }
}

// ЗАГЛУШКИ ДЛЯ КНОПОК
// НОВАЯ функция просмотра студента
async function viewStudent(studentId) {
    try {
        console.log('👀 Загружаем данные студента:', studentId);
        
        const response = await fetch(`/api/teacher/students/${studentId}`, {
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStudentModal(result.student);
        } else {
            showNotification('Ошибка загрузки данных студента', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Функция показа модального окна с данными студента
function showStudentModal(student) {
    // Создаем модальное окно если его нет
    let modal = document.getElementById('studentDetailsModal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'studentDetailsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Данные студента</h2>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div id="studentDetailsContent"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Обработчик закрытия
        modal.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // Заполняем данными
    const content = document.getElementById('studentDetailsContent');
    content.innerHTML = `
        <div class="student-info">
            <div class="info-row">
                <label>ФИО:</label>
                <span>${student.name}</span>
            </div>
            <div class="info-row">
                <label>Логин:</label>
                <span>${student.username}</span>
            </div>
            <div class="info-row">
                <label>Группа:</label>
                <span>${student.group}</span>
            </div>
            <div class="info-row">
                <label>Статистика:</label>
                <span>Выполнено работ: ${student.completed_labs} из ${student.total_submissions}</span>
            </div>
            <div class="info-row">
                <label>Средний балл:</label>
                <span>${student.average_score}</span>
            </div>
        </div>
        
        <div class="student-submissions">
            <h3 style="margin-top: 1.5rem; margin-bottom: 1rem;">Сданные работы:</h3>
            ${student.submissions.length > 0 ? 
                student.submissions.map(sub => `
                    <div class="submission-item" style="border: 1px solid var(--border-color); padding: 1rem; margin-bottom: 0.5rem; border-radius: 6px;">
                        <div style="font-weight: 500;">${sub.lab_title}</div>
                        <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                            <span>Оценка: ${sub.score || 'не оценено'}</span>
                            <span class="status-${sub.status}">${getStatusText(sub.status)}</span>
                        </div>
                        ${sub.feedback ? `<div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">Комментарий: ${sub.feedback}</div>` : ''}
                    </div>
                `).join('') 
                : '<p>Студент еще не сдал ни одной работы</p>'
            }
        </div>
    `;
    
    modal.style.display = 'block';
}

// Вспомогательная функция для статусов
function getStatusText(status) {
    const statusMap = {
        'completed': 'Выполнено',
        'submitted': 'На проверке',
        'pending': 'В процессе',
        'graded': 'Оценено'
    };
    return statusMap[status] || status;
}

// Редактирование студентов
let currentEditingStudentId = null;

function editStudent(studentId) {
    currentEditingStudentId = studentId;
    openEditStudentModal(studentId);
}

async function openEditStudentModal(studentId) {
    try {
        // Загружаем данные студента
        const response = await fetch(`/api/teacher/students/${studentId}`, {
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Заполняем форму данными
            document.getElementById('editStudentName').value = result.student.name;
            document.getElementById('editStudentGroup').value = result.student.group;
            document.getElementById('editStudentPassword').value = '';
            
            // Показываем модальное окно
            document.getElementById('editStudentModal').style.display = 'block';
        } else {
            showNotification('Ошибка загрузки данных студента', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Обработчик формы редактирования
document.getElementById('editStudentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('editStudentName').value.trim(),
        group: document.getElementById('editStudentGroup').value.trim(),
        password: document.getElementById('editStudentPassword').value
    };
    
    // Валидация
    if (!formData.name || !formData.group) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }
    
    if (formData.password && formData.password.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/teacher/students/${currentEditingStudentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Данные студента успешно обновлены!', 'success');
            closeModal('editStudentModal');
            await loadTeacherDashboardData(); // Обновляем таблицу
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения: ' + error, 'error');
    }
});

// Удаление студента
async function deleteStudent(studentId) {
    if (!confirm('Вы уверены, что хотите удалить этого студента? Все его работы также будут удалены.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/teacher/students/${studentId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Студент успешно удален!', 'success');
            await loadTeacherDashboardData(); // Обновляем таблицу
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения: ' + error, 'error');
    }
}

function viewLabDetails(labId) {
    showNotification(`Статистика лабораторной #${labId} - функционал в разработке`, 'info');
}

function editLab(labId) {
    showNotification(`Редактирование лабораторной #${labId} - функционал в разработке`, 'info');
}

function deleteLab(labId) {
    if (confirm('Вы уверены, что хотите удалить эту лабораторную работу?')) {
        showNotification('Лабораторная работа удалена!', 'success');
        loadTeacherDashboardData();
    }
}

function reviewSubmission(submissionId) {
    showNotification(`Проверка работы #${submissionId} - функционал в разработке`, 'info');
}

//function openVMManagement() {
//    showNotification('Управление виртуальными машинами - функционал в разработке', 'info');
//}

//function openBackupManagement() {
//    showNotification('Управление резервным копированием - функционал в разработке', 'info');
//}

//function openReports() {
//    showNotification('Отчеты и аналитика - функционал в разработке', 'info');
//}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showNotification(message, type) {
    // Простая реализация уведомлений
    alert(`${type.toUpperCase()}: ${message}`);
}

// ОБРАБОТЧИКИ СОБЫТИЙ
function setupEventListeners() {
    // Модальные окна
    document.getElementById('addStudentBtn').addEventListener('click', () => {
        document.getElementById('addStudentModal').style.display = 'block';
    });
    
    //document.getElementById('addLabBtn').addEventListener('click', () => {
    //    document.getElementById('addLabModal').style.display = 'block';
    //});
	
	document.querySelector('#editStudentModal .close').addEventListener('click', function() {
		closeModal('editStudentModal');
	});
    
    // Закрытие модальных окон
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Формы
    document.getElementById('addStudentForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addNewStudent();
    });
    
    document.getElementById('addLabForm').addEventListener('submit', function(e) {
        e.preventDefault();
        createNewLab();
    });
    
    // Выход
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
    
    // Закрытие по клику вне модального окна
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

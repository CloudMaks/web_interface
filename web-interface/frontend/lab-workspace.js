// lab-workspace.js - теперь с API
let currentLab = null;

document.addEventListener('DOMContentLoaded', async function() {
    await initializeWorkspace();
});

async function initializeWorkspace() {
    try {
        const user = await checkAuth('student');
        if (!user) return;

        await loadLabData();
        setupEventListeners();
        
        // Загружаем статус ВМ
        await updateVMStatus();
    } catch (error) {
        console.error('Workspace initialization error:', error);
    }
}

async function loadLabData() {
    try {
        // Получаем ID лабораторной из URL
        const urlParams = new URLSearchParams(window.location.search);
        const labId = urlParams.get('id') || 1; // По умолчанию первая лабораторная
        
        const labResult = await apiService.getLabDetails(labId);
        currentLab = labResult.lab;
        
        displayLabData(currentLab);
    } catch (error) {
        console.error('Error loading lab data:', error);
        showNotification('Ошибка загрузки данных лабораторной работы', 'error');
    }
}

function displayLabData(lab) {
    document.getElementById('labTitle').textContent = lab.title;
    document.getElementById('labObjective').textContent = lab.objective;
    
    const tasksList = document.getElementById('labTasks');
    tasksList.innerHTML = '';
    lab.tasks.forEach(task => {
        const li = document.createElement('li');
        li.textContent = task;
        tasksList.appendChild(li);
    });
    
    document.querySelector('.vm-name').textContent = lab.vm_name;
}

async function updateVMStatus() {
    try {
        const result = await apiService.getVMStatus();
        updateVMStatusUI(result.status);
    } catch (error) {
        console.error('Error getting VM status:', error);
        updateVMStatusUI('unknown');
    }
}

function updateVMStatusUI(status) {
    const statusBadge = document.querySelector('.vm-status-badge');
    const statusText = status === 'running' ? 'Запущена' : 
                      status === 'stopped' ? 'Остановлена' : 'Неизвестно';
    const statusClass = status === 'running' ? 'status-running' : 
                       status === 'stopped' ? 'status-stopped' : 'status-unknown';
    
    statusBadge.className = `vm-status-badge ${statusClass}`;
    statusBadge.innerHTML = `<i class="fas fa-${status === 'running' ? 'play' : 'stop'}-circle"></i> ${statusText}`;
}

// Управление ВМ через API
async function startVM() {
    try {
        showNotification('Запуск виртуальной машины...', 'info');
        const result = await apiService.startVM();
        
        if (result.success) {
            // Ждем немного и обновляем статус
            setTimeout(async () => {
                await updateVMStatus();
                showNotification('Виртуальная машина успешно запущена', 'success');
            }, 3000);
        } else {
            showNotification('Не удалось запустить ВМ: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error starting VM:', error);
        showNotification('Ошибка при запуске ВМ', 'error');
    }
}

async function stopVM() {
    if (confirm('Остановить виртуальную машину?')) {
        try {
            showNotification('Остановка виртуальной машины...', 'info');
            const result = await apiService.stopVM();
            
            if (result.success) {
                setTimeout(async () => {
                    await updateVMStatus();
                    showNotification('Виртуальная машина остановлена', 'success');
                }, 2000);
            } else {
                showNotification('Не удалось остановить ВМ: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error stopping VM:', error);
            showNotification('Ошибка при остановке ВМ', 'error');
        }
    }
}

async function restartVM() {
    try {
        showNotification('Перезапуск виртуальной машины...', 'info');
        // Сначала останавливаем
        await apiService.stopVM();
        
        // Ждем и запускаем
        setTimeout(async () => {
            await apiService.startVM();
            setTimeout(async () => {
                await updateVMStatus();
                showNotification('Виртуальная машина перезапущена', 'success');
            }, 3000);
        }, 2000);
    } catch (error) {
        console.error('Error restarting VM:', error);
        showNotification('Ошибка при перезапуске ВМ', 'error');
    }
}

// Сдача работы через API
async function submitWork() {
    const solution = document.getElementById('solutionText').value;
    if (!solution.trim()) {
        alert('Введите решение перед сдачей');
        return;
    }
    
    if (!currentLab) {
        showNotification('Ошибка: данные лабораторной не загружены', 'error');
        return;
    }
    
    if (confirm('Отправить работу на проверку?')) {
        try {
            const submitBtn = document.getElementById('submitWork');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
            submitBtn.disabled = true;
            
            const result = await apiService.submitLab(currentLab.id, solution);
            
            if (result.success) {
                showNotification('Работа успешно отправлена на проверку!', 'success');
                
                // Возвращаемся в кабинет через 2 секунды
                setTimeout(() => {
                    window.location.href = 'student-dashboard.html';
                }, 2000);
            } else {
                showNotification('Ошибка при отправке работы: ' + result.error, 'error');
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error submitting work:', error);
            showNotification('Ошибка при отправке работы', 'error');
            document.getElementById('submitWork').innerHTML = 'Сдать работу';
            document.getElementById('submitWork').disabled = false;
        }
    }
}

// Остальные функции (терминал, веб-интерфейс) остаются без изменений
function initializeTerminal() {
    // ... существующий код терминала ...
}

function initializeWebInterface() {
    // ... существующий код веб-интерфейса ...
}

function setupEventListeners() {
    // Управление ВМ
    document.getElementById('startVm').addEventListener('click', startVM);
    document.getElementById('stopVm').addEventListener('click', stopVM);
    document.getElementById('restartVm').addEventListener('click', restartVM);
    document.getElementById('snapshotVm').addEventListener('click', openSnapshotModal);
    
    // Подсказки
    document.getElementById('showMoreHints').addEventListener('click', showMoreHints);
    
    // Сдача работы
    document.getElementById('saveDraft').addEventListener('click', saveDraft);
    document.getElementById('submitWork').addEventListener('click', submitWork);
    
    // Модальные окна
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Выход
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
}

// Остальные вспомогательные функции остаются без изменений
function saveDraft() {
    const solution = document.getElementById('solutionText').value;
    if (!solution.trim()) {
        alert('Введите решение перед сохранением');
        return;
    }
    
    localStorage.setItem(`lab${currentLab?.id}_draft`, solution);
    showNotification('Черновик сохранен', 'success');
}

function showMoreHints() {
    // ... существующий код ...
}

function openSnapshotModal() {
    // ... существующий код ...
}

function showNotification(message, type) {
    // ... существующая реализация уведомлений ...
}

// lab-workspace.js - добавляем функции проверки

// Предварительная проверка решения
async function checkSolution() {
    const solution = document.getElementById('solutionText').value;
    if (!solution.trim()) {
        alert('Введите решение для проверки');
        return;
    }
    
    if (!currentLab) {
        showNotification('Ошибка: данные лабораторной не загружены', 'error');
        return;
    }
    
    try {
        showNotification('Проверка решения...', 'info');
        
        const response = await fetch('/api/auto-grade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                lab_id: currentLab.id,
                solution: solution
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayCheckResult(result.result);
        } else {
            showNotification('Ошибка при проверке: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error checking solution:', error);
        showNotification('Ошибка при проверке решения', 'error');
    }
}

// Отображение результатов проверки
function displayCheckResult(result) {
    const modal = document.getElementById('checkResultModal') || createCheckResultModal();
    
    const resultContent = document.getElementById('checkResultContent');
    resultContent.innerHTML = `
        <div class="check-result-header">
            <h3>Результат автоматической проверки</h3>
            <div class="score-display">
                <span class="score">${result.score}</span>
                <span class="max-score">/${result.max_score}</span>
            </div>
        </div>
        
        <div class="feedback-list">
            ${result.feedback.map(item => `
                <div class="feedback-item">${item}</div>
            `).join('')}
        </div>
        
        ${result.auto_graded ? 
            '<div class="auto-grade-note">✅ Проверено автоматически</div>' :
            '<div class="manual-grade-note">⚠️ Требуется проверка преподавателя</div>'
        }
    `;
    
    modal.style.display = 'block';
}

// Создание модального окна для результатов проверки
function createCheckResultModal() {
    const modal = document.createElement('div');
    modal.id = 'checkResultModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Результат проверки</h2>
                <span class="close">&times;</span>
            </div>
            <div class="modal-body">
                <div id="checkResultContent"></div>
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="closeCheckResult()">Понятно</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Закрытие по крестику
    modal.querySelector('.close').addEventListener('click', closeCheckResult);
    
    // Закрытие по клику вне окна
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeCheckResult();
        }
    });
    
    return modal;
}

function closeCheckResult() {
    const modal = document.getElementById('checkResultModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Обновляем setupEventListeners - добавляем кнопку проверки
function setupEventListeners() {
    // ... существующие обработчики ...
    
    // Кнопка проверки решения
    const checkSolutionBtn = document.getElementById('checkSolution');
    if (checkSolutionBtn) {
        checkSolutionBtn.addEventListener('click', checkSolution);
    } else {
        // Создаем кнопку если её нет
        addCheckSolutionButton();
    }
}

// Добавляем кнопку проверки в интерфейс
function addCheckSolutionButton() {
    const submissionPanel = document.querySelector('.submission-panel');
    if (!submissionPanel) return;
    
    const checkButton = document.createElement('button');
    checkButton.id = 'checkSolution';
    checkButton.className = 'btn btn-outline';
    checkButton.innerHTML = '<i class="fas fa-search"></i> Проверить решение';
    
    const actionsDiv = document.querySelector('.submission-actions');
    if (actionsDiv) {
        actionsDiv.insertBefore(checkButton, actionsDiv.firstChild);
        
        checkButton.addEventListener('click', checkSolution);
    }
}
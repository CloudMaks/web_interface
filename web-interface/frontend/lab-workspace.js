let currentLab = null;
let currentTasks = [];
let timerInterval = null;
let startTime = null;
let elapsedTime = 0;

document.addEventListener('DOMContentLoaded', async function() {
    const user = await requireAuth('student');
    if (!user) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const labId = urlParams.get('labId');
    
    if (!labId) {
        showNotification('Практическая работа не выбрана', 'error');
        setTimeout(() => window.location.href = 'student-dashboard.html', 2000);
        return;
    }
    
    try {
        // 1. Загружаем данные Практической работы
        const labResponse = await apiRequest(`/api/labs/${labId}`);
        
        if (!labResponse.success) {
            showNotification('Практическая работа не найдена', 'error');
            setTimeout(() => window.location.href = 'student-dashboard.html', 2000);
            return;
        }
        
        currentLab = labResponse.lab;
        
        // 2. Загружаем прогресс студента
        let progress = null;
        try {
            const progressResponse = await apiRequest(`/api/student/lab/${labId}/progress`);
            if (progressResponse.success) {
                progress = progressResponse.progress;
            }
        } catch (progressError) {
            console.log('Прогресс не найден, начинаем новую работу');
        }
        
        // 3. Загружаем задания
        await loadLabTasks(labId, progress);
        
        // 4. Начинаем работу если она еще не начата
        if (!progress || progress.status === 'not_started') {
            try {
                await apiRequest(`/api/student/lab/${labId}/start`, { 
                    method: 'POST' 
                });
            } catch (startError) {
                console.log('Работа уже начата или ошибка:', startError);
            }
        }
        
        // 5. Загружаем страницу
        loadLabPage();
        
        // 6. Запускаем таймер
        startTimer();
        
        // 7. Настраиваем обработчики
        setupEventListeners();
        
    } catch (error) {
        console.error('Error loading lab:', error);
        showNotification('Ошибка загрузки практической работы: ' + error.message, 'error');
    }
});

async function loadLabTasks(labId, progress) {
    try {
        if (currentLab.content && currentLab.content.trim() !== '') {
            console.log('Trying to parse content...');
            
            try {
                const rawContent = currentLab.content.trim();
                let cleanContent = rawContent;
                
                if (rawContent.startsWith('"') && rawContent.endsWith('"')) {
                    cleanContent = rawContent.substring(1, rawContent.length - 1);
                }
                
                cleanContent = cleanContent.replace(/'/g, '"');
                
                console.log('Cleaned content:', cleanContent.substring(0, 150) + '...');
                
                currentTasks = JSON.parse(cleanContent);
                console.log('Successfully parsed tasks:', currentTasks);
                console.log('Number of tasks:', currentTasks.length);
                
                if (!Array.isArray(currentTasks)) {
                    console.error('ERROR: Content is not an array! Type:', typeof currentTasks);
                    currentTasks = createDefaultTasks(currentLab.lab_number);
                }
                
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError.message);
                currentTasks = createDefaultTasks(currentLab.lab_number);
            }
            
        } else {
            console.error('ERROR: No content in lab object');
            currentTasks = createDefaultTasks(currentLab.lab_number);
        }
        
        console.log('Final tasks array:', currentTasks);
        
        // Восстанавливаем прогресс студента
        if (progress && progress.completed_tasks && Array.isArray(progress.completed_tasks)) {
            const completedTasks = progress.completed_tasks;
            console.log('Student progress:', completedTasks);
            
            currentTasks.forEach((task, index) => {
                if (task && task.task_number !== undefined) {
                    const taskProgress = completedTasks.find(t => t.task_number === task.task_number);
                    if (taskProgress) {
                        task.completed = taskProgress.completed || false;
                        task.attempts = taskProgress.attempts || 0;
                        task.checked = taskProgress.completed; // Проверено если выполнено
                        task.disabled = taskProgress.completed; // Отключено если выполнено
                        task.score = taskProgress.score || 0;
                        
                        // Для выполненных работ все задания доступны для просмотра
                        if (progress.status === 'completed') {
                            task.available = true;
                            task.disabled = true; // Но отключены для редактирования
                        } else {
                            // Определяем доступность задачи
                            if (task.task_number === 1) {
                                task.available = true; // Первая задача всегда доступна
                            } else {
                                // Проверяем, выполнена ли предыдущая задача
                                const prevTaskProgress = completedTasks.find(t => t.task_number === task.task_number - 1);
                                task.available = prevTaskProgress && prevTaskProgress.completed;
                            }
                        }
                        
                        // Восстанавливаем ответы
                        if (taskProgress.last_answer) {
                            if (task.type === 'question') {
                                task.selectedAnswer = taskProgress.last_answer;
                            } else if (task.type === 'input') {
                                task.userAnswer = taskProgress.last_answer;
                            }
                        }
                    } else {
                        // Если прогресса нет, определяем доступность
                        if (progress.status === 'completed') {
                            task.available = true; // Для выполненных работ все доступно для просмотра
                            task.disabled = true;
                        } else {
                            task.available = task.task_number === 1; // Только первая задача доступна
                            task.disabled = !task.available;
                        }
                        task.completed = false;
                        task.checked = false;
                        task.score = 0;
                        task.attempts = 0;
                    }
                }
            });
        } else {
            // Если прогресса нет, инициализируем все задачи
            currentTasks.forEach((task, index) => {
                if (task && task.task_number !== undefined) {
                    task.available = task.task_number === 1; // Только первая задача доступна
                    task.completed = false;
                    task.checked = false;
                    task.disabled = !task.available;
                    task.score = 0;
                    task.attempts = 0;
                }
            });
        }
        
    } catch (error) {
        console.error('Error loading tasks:', error);
        showNotification('Ошибка загрузки заданий: ' + error.message, 'error');
        currentTasks = [];
    }
}

// Функция для создания заданий по умолчанию
function createDefaultTasks(labNumber) {
    console.log('Creating default tasks for lab number:', labNumber);
    
    if (labNumber === 1) {
        return [
            {
                type: 'question',
                question: 'Какой пароль используется для входа в учетную запись kali?',
                answers: ['190902', '123456', 'password', 'kali123'],
                correct_answer: '190902',
                task_number: 1
            },
            {
                type: 'question', 
                question: 'Какая команда используется для редактирования файла конфигурации logcheck?',
                answers: [
                    'sudo nano /etc/logcheck/logcheck.conf',
                    'sudo edit /etc/logcheck.conf', 
                    'vim /etc/logcheck.conf',
                    'gedit /etc/logcheck/logcheck.conf'
                ],
                correct_answer: 'sudo nano /etc/logcheck/logcheck.conf',
                task_number: 2
            },
            {
                type: 'question',
                question: 'Какое ПО вызвало перегрузку системы?',
                answers: ['Minetest', 'nsnake', 'Minecraft', 'Apache'],
                correct_answer: 'Minetest',
                task_number: 3
            }
        ];
    } else if (labNumber === 2) {
        return [
            {
                type: 'question',
                question: 'Сколько неудачных попыток входа было обнаружено в учетную запись user1?',
                answers: ['5', '7', '10', '3'],
                correct_answer: '7',
                task_number: 1
            },
            {
                type: 'question',
                question: 'В какой файл нужно добавить ограничение количества попыток аутентификации?',
                answers: [
                    '/etc/pam.d/lightdm',
                    '/etc/ssh/sshd_config', 
                    '/etc/login.defs',
                    '/etc/security/limits.conf'
                ],
                correct_answer: '/etc/pam.d/lightdm',
                task_number: 2
            },
            {
                type: 'input',
                question: 'Какое значение параметра deny нужно установить для ограничения в 3 попытки?',
                correct_answer: '3',
                task_number: 3
            }
        ];
    }
    
    return [];
}

function loadLabPage() {
    // Заголовок
    document.getElementById('labTitle').textContent = currentLab.title;
    
    // Мета-информация
    const labNumber = document.getElementById('labNumber');
    const labDifficulty = document.getElementById('labDifficulty');
    
    if (currentLab.lab_number === 0) {
        labNumber.textContent = 'Подготовительный этап';
        labDifficulty.textContent = 'Сложность: Легкая';
    } else if (currentLab.lab_number === 1) {
        labNumber.textContent = 'Практическая работа №1';
        labDifficulty.textContent = 'Сложность: Средняя';
    } else if (currentLab.lab_number === 2) {
        labNumber.textContent = 'Практическая работа №2';
        labDifficulty.textContent = 'Сложность: Средняя';
    }
    
    // Загружаем задания
    renderTasks();
    
    // Обновляем таймер
    updateTimerDisplay();
}

function renderTasks() {
    const container = document.getElementById('tasksContainer');
    container.innerHTML = '';
    
    const isPreparation = currentLab.lab_number === 0;
    const isCompleted = currentLab.status === 'completed';
    
    if (isPreparation) {
        // Подготовительный этап - с новым содержанием и кнопкой скачивания
        container.innerHTML = `
            <div class="task">
                <div class="task-header">
                    <div class="task-number">Подготовительный этап</div>
                    <div class="task-status ${isCompleted ? 'status-correct' : 'status-pending'}">
                        ${isCompleted ? 'Выполнено' : 'В процессе'}
                    </div>
                </div>
                <div class="info-block">
                    <h3>1. Настройка уведомлений на email</h3>
                    <div class="info-content">
                        <p><strong>Зайти под учетной записью kali с паролем 190902.</strong></p>
                        
                        <h4>1.1. Настройка утилиты logcheck для отправки отчета на email</h4>
                        <div style="margin-left: 1.5rem;">
                            <p><strong>1.1.1</strong> Зайти под учетной записью kali с паролем 190902.</p>
                            <p><strong>1.1.2</strong> Открыть терминал и ввести команду:</p>
                            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; font-family: monospace;">
                                sudo nano /etc/logcheck/logcheck.conf
                            </div>
                            <p>Для редактирования файла конфигурации logcheck. Необходимо указать свой почтовый адрес email.</p>
                            <p>Далее сохраняем <kbd>Ctrl+O</kbd> и закрываем файл <kbd>Ctrl+X</kbd></p>
                        </div>
                        
                        <h4>1.2 Настройка почтового клиента MSMTP</h4>
                        <div style="margin-left: 1.5rem;">
                            <p><strong>1.2.1</strong> Войти в учетную запись электронной почты mail.ru, войти в раздел
                            безопасность, найти раздел «Способы входа» и найти пункт «Пароли для
                            внешних приложений».</p>
                            <p>После чего необходимо создать новый пароль для внешних приложений
                            и не закрывая вкладку с появившимся паролем, скопировать его.</p>
                            
                            <p><strong>1.2.2</strong> Ввести команду</p>
                            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; font-family: monospace;">
                                sudo nano /etc/msmtprc
                            </div>
                            <p>и указать свой почтовый адрес email и ввести созданный пароль для
                            внешних приложений. Сохранить и закрыть файл.</p>
                            
                            <p><strong>1.2.3</strong> Ввести команду</p>
                            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; font-family: monospace;">
                                sudo nano ~/.msmtprc
                            </div>
                            <p>для настройки конфига msmtp для пользователя kali, ввести email и
                            пароль из п. 1.2.2. Сохранить и закрыть файл.</p>
                            
                            <p><strong>1.2.4</strong> Установить права доступа с помощью команд:</p>
                            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; font-family: monospace;">
                                sudo chmod 600 /etc/msmtprc<br>
                                sudo touch /var/log/msmtp.log<br>
                                sudo chown kali:kali /var/log/msmtp.log
                            </div>
                        </div>
                        
                        <h4>1.3 Редактирование скрипта мониторинга</h4>
                        <div style="margin-left: 1.5rem;">
                            <p><strong>1.3.1</strong> Ввести команду</p>
                            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; font-family: monospace;">
                                sudo nano /usr/local/bin/monitor-system-load.sh
                            </div>
                            <p>Найти строку и указать свой email</p>
                            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; font-family: monospace;">
                                echo -e "$ALERT_MESSAGE" | mail -s "🚨 ВНИМАНИЕ: Перегрузка системы на $(hostname)" ваш_email@mail.ru
                            </div>
                            <p>Сохранить и закрыть файл.</p>
                            
                            <p><strong>1.3.2</strong> Ввести команду</p>
                            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; font-family: monospace;">
                                sudo nano /usr/local/bin/advanced-system-monitor.sh
                            </div>
                            <p>Найти строку и указать свой email</p>
                            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; font-family: monospace;">
                                ALERT_EMAIL=ваш_email@mail.ru
                            </div>
                            <p>Сохранить и закрыть файл.</p>
                        </div>
                        
                        <!-- Кнопка для скачивания файла -->
                        <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3); text-align: center;">
                            <h4 style="color: var(--success); margin-bottom: 1rem;">
                                <i class="fas fa-download"></i> Образ виртуальной машины
                            </h4>
                            
                            <button class="btn btn-success" onclick="downloadMaterial()" style="padding: 0.75rem 2rem;">
                                <i class="fas fa-file-download"></i> Скачать "Учебный полигон инцидентов ИБ"
                            </button>
                            <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
                                <i class="fas fa-info-circle"></i> Файл будет загружен в формате OVA
                            </p>
                        </div>
                        
                        <div style="margin-top: 2rem; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                            <p><strong>После изучения материалов нажмите "Завершить подготовительный этап".</strong></p>
                            <p><em>Примечание: Подготовительный этап оценивается без баллов.</em></p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Для подготовительного этапа кнопка всегда активна, если не завершен
        const completeBtn = document.getElementById('completeBtn');
        if (isCompleted) {
            completeBtn.disabled = true;
            completeBtn.innerHTML = '<i class="fas fa-check-circle"></i> Этап уже завершен';
            completeBtn.classList.remove('btn-primary');
            completeBtn.classList.add('btn-secondary');
        } else {
            completeBtn.disabled = false;
            completeBtn.innerHTML = '<i class="fas fa-check"></i> Завершить подготовительный этап';
            completeBtn.classList.remove('btn-secondary');
            completeBtn.classList.add('btn-primary');
        }
        
    } else {
        // Практические работы с заданиями
        if (currentTasks.length === 0) {
            container.innerHTML = `
                <div class="no-tasks">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Задания не найдены</h3>
                    <p>Обратитесь к преподавателю для настройки практической работы.</p>
                    <button class="btn btn-secondary" onclick="window.location.href='student-dashboard.html'">
                        Вернуться в личный кабинет
                    </button>
                </div>
            `;
        } else {
            const completedTasks = currentTasks.filter(t => t.completed).length;
            const totalTasks = currentTasks.length;
            const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
            
            // Теоретическая информация в зависимости от номера работы
            let theoryContent = '';
            
            if (currentLab.lab_number === 1) {
                theoryContent = `
                    <div class="theory-section">
                        <h2>Практическая работа №1</h2>
                        <p><strong>Обработка инцидента, связанного с несоответствующим использованием ресурсов системы, заключающийся в использовании ПО, не предназначенного для рабочих целей</strong></p>
                        
                        <h3>Цель работы:</h3>
                        <p>научиться обрабатывать инцидент, связанный с несоответствующим использованием ресурсов системы, заключающийся в использовании ПО, не предназначенного для рабочих целей</p>
                        
                        <h3>Задание:</h3>
                        <p>обнаружить, провести анализ, сдержать и устранить инцидент, связанный с несоответствующим использованием ресурсов системы, заключающийся в использовании ПО, не предназначенного для рабочих целей.</p>
                        
                        <h3>Порядок выполнения работы:</h3>
                        
                        <h4>1. Обнаружение инцидента</h4>
                        <div class="theory-step">
                            <p><strong>1.1</strong> Запустить виртуальную машину и войти в учетную запись «kali» с паролем 190902.</p>
                            <p><strong>1.2</strong> Проверить свой email на наличие уведомлений от утилиты logcheck. Должно прийти уведомление о загруженности системы.</p>
                            <p class="theory-note">Получение уведомлений от утилиты может занять 10 минут.</p>
                        </div>
                        
                        <h4>2. Анализ инцидента</h4>
                        <div class="theory-step">
                            <p><strong>2.1</strong> Запустить утилиту htop в терминале с помощью команды</p>
                            <div class="code-block">
                                sudo htop
                            </div>
                            <p>провести анализ загруженности системы, обращая внимание на CPU и Mem.</p>
                            <p>Должно быть обнаружено, что с учётной записи пользователя «user2» запущено приложение Minetest (luanty), система потребляет примерно 79% CPU и 67% RAM, что является загруженностью выше нормы.</p>
                        </div>
                        
                        <h4>3. Сдерживание и устранение инцидента</h4>
                        <div class="theory-step">
                            <p><strong>3.1</strong> Для сдерживания и устранения данного инцидента необходимо остановить запущенные процессы, которые перегружают систему.</p>
                            <p>Для этого необходимо нажать с помощью мышки процесс luanty, который перегружает систему, воспользоваться клавишей F9, стрелочками вверх-вниз выбрать пункт SIGKILL и нажать Enter. Тем самым процесс будет остановлен.</p>
                            
                            <p><strong>3.2</strong> После того как запущенный процесс был остановлен, нужно исключить возможность повторения подобного инцидента ИБ.</p>
                            <p>Необходимо посмотреть историю установленных пакетов и приложений на учетной записи «user2», с помощью команды, представленной ниже, чтобы проанализировать, какое еще ПО было установлено не для рабочих целей.</p>
                            <div class="code-block">
                                sudo cat /var/log/apt/history.log | grep -A2 -B2 "пользователь"
                            </div>
                            
                            <p><strong>3.3</strong> После проверки должно быль обнаружено, что установлено ПО Minetest, которое было запущено и вызвало перегруз системы, а также обнаружено еще одно ПО «nsnake», которое не предназначено для рабочих целей.</p>
                            <p>Необходимо деинсталировать данные ПО.</p>
                            <p>Команды для деинсталяции:</p>
                            <div class="code-block">
                                sudo apt purge minetest<br>
                                sudo apt purge nsnake
                            </div>
                            
                            <p><strong>3.4</strong> Во избежании повторной установки подобного ПО необходимо изменить права доступа пользователя «user2».</p>
							<div class="code-block">
                                groups user2<br>
								user2 : user2 sudo users<br>
                                sudo gpasswd -d user2 sudo<br>
								groups user2<br>
								user2 : user2 users
                            </div>
                        </div>
                        
                        <div class="theory-separator">
                            <hr>
                            <h3>Тестовые задания:</h3>
                            <p>Ответьте на вопросы ниже, основываясь на материалах практической работы.</p>
                        </div>
                    </div>
                `;
            } else if (currentLab.lab_number === 2) {
                theoryContent = `
                    <div class="theory-section">
                        <h2>Практическая работа №2</h2>
                        <p><strong>Обработка инцидента, связанного с несанкционированным доступом к системе, заключающийся в попытке подбора пароля к учетной записи пользователя</strong></p>
                        
                        <h3>Цель работы:</h3>
                        <p>научиться обрабатывать инцидент, связанный с несанкционированным доступом к системе, заключающийся в попытке подбора пароля к учетной записи пользователя.</p>
                        
                        <h3>Задание:</h3>
                        <p>обнаружить, провести анализ, сдержать и устранить инцидент, связанный с несанкционированным доступом к системе, заключающийся в попытке подбора пароля к учетной записи пользователя.</p>
                        
                        <h3>Порядок выполнения работы:</h3>
                        
                        <h4>1. Обнаружение инцидента</h4>
                        <div class="theory-step">
                            <p><strong>1.1</strong> Запустить виртуальную машину и войти в учетную запись «kali» с паролем 190902.</p>
                            <p><strong>1.2</strong> Проверить свой email на наличие уведомлений от утилиты logcheck. Должно прийти уведомление о подозрительных попытках аутентификации в учетную запись «user1».</p>
                            <p class="theory-note">Получение уведомлений от утилиты может занять 10 минут.</p>
                        </div>
                        
                        <h4>2. Анализ инцидента</h4>
                        <div class="theory-step">
                            <p><strong>2.1</strong> Для анализа данного инцидента ИБ, необходимо проанализировать попытки входа в учётные записи, для того, чтобы убедиться в том, что данные попытки входа являются инцидентом.</p>
                            <p>Для этого процесса необходимо посмотреть все последние события аутентификации, которые хранятся в файле «journal» с помощью команды</p>
                            <div class="code-block">
                                sudo journalctl --since "1 hour ago" | grep -i "auth\|password\|failed"
                            </div>
                            <p>В ходе проверки должно быть обнаружено семь неудачных попыток входа в учетную запись пользователя «user1» и одну удачную. Из этого может следовать, что злоумышленник пытался перебрать пароли для доступа к учетной записи, в результате чего он его получил.</p>
                        </div>
                        
                        <h4>3. Сдерживание и устранение инцидента</h4>
                        <div class="theory-step">
                            <p><strong>3.1</strong> Чтобы сдержать и устранить инцидент необходимо поменять пароль от учётной записи «user1»</p>
                            
                            <p><strong>3.2</strong> Для того, чтобы подобный инцидент с попытками подбора пароля не повторялся, необходимо ввести ограничение количества попыток аутентификации. Для это необходимо выполнить следующие действия:</p>
                            <ul>
                                <li>открыть конфигурационный файл PAM:</li>
                                <div class="code-block">
                                    sudo nano /etc/pam.d/lightdm
                                </div>
                                <li>изменить строки в пункте 1 файла deny и unlock time, где в deny=3, 3 — это количество попыток аутентификации, а в unlock_time=60, 60 — это время в секундах, на которое блокируется пользователь после превышения количества попыток.</li>
                                <li>сохранить и закрыть файл.</li>
                            </ul>
                        </div>
                        
                        <div class="theory-separator">
                            <hr>
                            <h3>Тестовые задания:</h3>
                            <p>Ответьте на вопросы ниже, основываясь на материалах практической работы.</p>
                        </div>
                    </div>
                `;
            }
            
            // Прогресс бар
            container.innerHTML = `
                <div class="progress-section">
                    <div class="progress-text">
                        ${isCompleted ? 
                            `Работа завершена. Выполнено: ${completedTasks} из ${totalTasks} заданий` :
                            `Выполнено: ${completedTasks} из ${totalTasks} заданий`
                        }
                        ${!isCompleted && currentLab.lab_number in [1, 2] ? 
                            `(Максимум баллов: ${totalTasks * 10} из 30)` : 
                            ''
                        }
                        ${isCompleted && currentLab.lab_number in [1, 2] ? 
                            `<br><strong>Итоговый балл: ${currentLab.score || 0} из 30</strong>` : 
                            ''
                        }
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
                
                ${theoryContent}
            `;
            
            // Добавляем режим "только просмотр" для выполненных работ
            if (isCompleted) {
                container.innerHTML += `
                    <div class="info-message" style="margin-bottom: 1.5rem;">
                        <i class="fas fa-info-circle"></i>
                        Режим просмотра. Работа уже завершена и не может быть изменена.
                    </div>
                `;
            }
            
            // Рендерим задания
            currentTasks.forEach((task, index) => {
                const taskElement = createTaskElement(task, index);
                container.appendChild(taskElement);
            });
        }
        
        // Обновляем кнопку завершения
        updateCompleteButton();
    }
}

async function downloadMaterial() {
    try {
        const filename = 'Учебный_полигон_инцидентов_ИБ.ova';
        
        showNotification('Начинается скачивание файла...', 'info');
        
        // Создаем ссылку для скачивания
        const downloadUrl = `/api/download/${encodeURIComponent(filename)}`;
        
        // Создаем временную ссылку и кликаем по ней
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Альтернативный вариант с fetch для проверки статуса
        try {
            const response = await fetch(downloadUrl, {
                credentials: 'include'
            });
            
            if (response.ok) {
                showNotification('Файл начал скачиваться', 'success');
                
                // Скачиваем файл через blob
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link2 = document.createElement('a');
                link2.href = blobUrl;
                link2.download = filename;
                link2.style.display = 'none';
                document.body.appendChild(link2);
                link2.click();
                
                // Очистка
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(link2);
            } else {
                const errorData = await response.json();
                showNotification(errorData.error || 'Ошибка скачивания', 'error');
            }
        } catch (error) {
            console.error('Download error:', error);
            showNotification('Ошибка скачивания файла', 'error');
        }
        
    } catch (error) {
        console.error('Download function error:', error);
        showNotification('Ошибка при попытке скачивания', 'error');
    }
}

function createTaskElement(task, index) {
    const taskDiv = document.createElement('div');
    taskDiv.className = `task ${task.completed ? 'completed' : ''} ${!task.available ? 'locked' : ''}`;
    taskDiv.dataset.taskIndex = index;
    
    let statusText = 'Не выполнено';
    let statusClass = 'status-pending';
    
    if (!task.available) {
        statusText = 'Заблокировано';
        statusClass = 'status-pending';
    } else if (task.completed) {
        statusText = `Выполнено (${task.score || 10} баллов)`;
        statusClass = 'status-correct';
    } else if (task.checked && !task.correct) {
        statusText = `Неправильно (попыток: ${task.attempts || 1})`;
        statusClass = 'status-incorrect';
    }
    
    let taskContent = '';
    
    if (task.type === 'question') {
        // Вопрос с выбором ответа
        taskContent = `
            <div class="task-content">
                <h3>Задание ${task.task_number} ${!task.available ? '🔒' : ''}</h3>
                <p class="task-question">${task.question}</p>
                
                <div class="multiple-choice">
                    ${task.answers.map((answer, i) => {
                        const isSelected = task.selectedAnswer === answer;
                        let optionClass = '';
                        
                        // Показываем только если ответ проверен
                        if (task.checked) {
                            // Если студент выбрал этот ответ и он правильный
                            if (isSelected && task.correct) {
                                optionClass = 'correct';
                            }
                            // Если студент выбрал этот ответ и он неправильный
                            else if (isSelected && !task.correct) {
                                optionClass = 'incorrect';
                            }
                            // Не подсвечиваем правильный ответ при неправильном выборе
                            // Убрали: else if (answer === task.correct_answer && !task.correct) {
                            //     optionClass = 'correct';
                            // }
                        }
                        
                        return `
                            <div class="choice-option ${isSelected ? 'selected' : ''} ${optionClass}"
                                 data-value="${answer}"
                                 ${!task.available || task.disabled ? 'style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                                <div class="choice-radio">
                                    <input type="radio" name="task-${index}" value="${answer}" 
                                        ${!task.available || task.disabled ? 'disabled' : ''}
                                        ${isSelected ? 'checked' : ''}>
                                    <span class="radio-indicator"></span>
                                </div>
                                <span class="choice-text">${answer}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } else if (task.type === 'input') {
        // Вопрос с вводом текста
        const inputClass = task.checked && task.available ? (task.correct ? 'correct-answer' : 'incorrect-answer') : '';
        
        taskContent = `
            <div class="task-content">
                <h3>Задание ${task.task_number} ${!task.available ? '🔒' : ''}</h3>
                <p class="task-question">${task.question}</p>
                
                <div class="text-input">
                    <input type="text" id="input-${index}" 
                        placeholder="${!task.available ? 'Сначала выполните предыдущее задание' : 'Введите ваш ответ...'}" 
                        value="${task.userAnswer || ''}"
                        ${!task.available || task.disabled ? 'disabled' : ''}
                        class="${inputClass}">
                </div>
            </div>
        `;
    } else if (task.type === 'info') {
        // Информационный блок
        taskContent = `
            <div class="info-block">
                <h3>${task.title || 'Информация'}</h3>
                <div class="info-content">
                    ${task.content || 'Информационный блок'}
                </div>
            </div>
        `;
    }
    
    let checkButton = '';
    if (task.available && !task.completed) {
        if (task.checked && !task.correct && task.attempts < 10) {
            checkButton = `
                <button class="btn btn-primary check-btn" data-task-index="${index}">
                    <i class="fas fa-redo"></i> Попробовать снова (${task.attempts || 1}/10)
                </button>
            `;
        } else if (!task.checked) {
            checkButton = `
                <button class="btn btn-primary check-btn" data-task-index="${index}">
                    <i class="fas fa-check-circle"></i> Проверить ответ
                </button>
            `;
        }
    } else if (!task.available) {
        taskContent += `
            <div class="info-message">
                <i class="fas fa-lock"></i> Это задание станет доступным после выполнения предыдущего
            </div>
        `;
    }
    
    let checkResult = '';
    if (task.checked && task.available) {
        const isCorrect = task.correct;
        
        checkResult = `
            <div class="check-result ${isCorrect ? 'correct' : 'incorrect'}">
                <div class="result-header">
                    <i class="fas fa-${isCorrect ? 'check-circle' : 'times-circle'}"></i>
                    <strong>${isCorrect ? 'Правильно!' : 'Неправильно'}</strong>
                </div>
                <div class="attempts-info">
                    <p><strong>Попыток:</strong> ${task.attempts || 1}</p>
                    <p><strong>Баллы за это задание:</strong> ${task.score}/10</p>
                    ${task.attempts > 1 ? `<p><em>(-1 балл за каждую лишнюю попытку)</em></p>` : ''}
                    ${!isCorrect ? `<p class="hint">Попробуйте еще раз</p>` : ''}
                </div>
            </div>
        `;
    }
    
    taskDiv.innerHTML = `
        <div class="task-header">
            <div class="task-number">Задание ${task.task_number || index + 1}</div>
            <div class="task-status ${statusClass}">${statusText}</div>
        </div>
        
        ${taskContent}
        ${checkButton}
        ${checkResult}
    `;
    
    return taskDiv;
}

function renderTaskElement(taskIndex) {
    const tasksContainer = document.getElementById('tasksContainer');
    const taskElement = tasksContainer.querySelector(`.task[data-task-index="${taskIndex}"]`);
    
    if (taskElement) {
        const newElement = createTaskElement(currentTasks[taskIndex], taskIndex);
        taskElement.replaceWith(newElement);
    }
}


function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Сбрасываем startTime и используем только elapsedTime
    startTime = Date.now();
    
    timerInterval = setInterval(() => {
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        
        // Обновляем отображение каждую секунду
        updateTimerDisplay();
        
        // Каждые 10 секунд сохраняем время на сервере
        if (elapsedTime % 10 === 0) {
            saveTimeToServer();
        }
    }, 1000);
}

async function saveTimeToServer() {
    if (!currentLab) return;
    
    try {
        await apiRequest(`/api/student/lab/${currentLab.id}/update-time`, {
            method: 'POST',
            body: JSON.stringify({ elapsed_time: elapsedTime })
        });
    } catch (error) {
        console.error('Error saving time:', error);
    }
}

function updateTimerDisplay() {
    // Используем elapsedTime который начинается с 0
    const hours = Math.floor(elapsedTime / 3600);
    const minutes = Math.floor((elapsedTime % 3600) / 60);
    const seconds = elapsedTime % 60;
    
    document.getElementById('timer').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateCompleteButton() {
    const completeBtn = document.getElementById('completeBtn');
    const allCompleted = currentTasks.every(task => task.completed);
    
    if (allCompleted) {
        completeBtn.disabled = false;
        completeBtn.innerHTML = '<i class="fas fa-check"></i> Завершить работу';
    } else {
        completeBtn.disabled = true;
        const completedCount = currentTasks.filter(t => t.completed).length;
        completeBtn.innerHTML = `Завершить работу (${completedCount}/${currentTasks.length})`;
    }
}

// Функция завершения работы
async function completeLabWork() {
    const isPreparation = currentLab.lab_number === 0;
    
    let message = isPreparation 
        ? 'Вы уверены, что хотите завершить подготовительный этап?' 
        : 'Выполнены не все задания. Вы уверены, что хотите завершить работу?';
    
    if (!isPreparation) {
        const allCompleted = currentTasks.every(task => task.completed);
        if (!allCompleted) {
            if (!confirm('Выполнены не все задания. Вы уверены, что хотите завершить работу?')) {
                return;
            }
        }
    }
    
    try {
        // Останавливаем таймер
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        // Сохраняем финальное время
        await saveTimeToServer();
        
        const response = await apiRequest(`/api/student/lab/${currentLab.id}/complete`, {
            method: 'POST',
            body: JSON.stringify({ 
                total_time: elapsedTime
            })
        });
        
        if (response.success) {
            showNotification('Работа успешно завершена!', 'success');
            
            // Показываем результат
            if (window.showResultModal) {
                // Конвертируем время UTC в МСК
                const startTimeMsk = convertUTCtoMSK(response.start_time);
                const endTimeMsk = convertUTCtoMSK(response.end_time);
                
                window.showResultModal({
                    score: response.score || 0,
                    max_score: response.max_score || 100,
                    start_time: startTimeMsk,
                    end_time: endTimeMsk,
                    total_time: formatTime(elapsedTime),
                    errors: 0
                });
            } else {
                setTimeout(() => {
                    window.location.href = 'student-dashboard.html';
                }, 2000);
            }
        } else {
            showNotification(response.error || 'Ошибка завершения работы', 'error');
        }
    } catch (error) {
        console.error('Complete lab error:', error);
        showNotification('Ошибка завершения работы', 'error');
    }
}

// Функция для конвертации UTC в МСК (UTC+3)
function convertUTCtoMSK(utcTimeString) {
    if (!utcTimeString) return '-';
    
    const utcDate = new Date(utcTimeString);
    // МСК = UTC + 3 часа
    const mskDate = new Date(utcDate.getTime() + (3 * 60 * 60 * 1000));
    
    return mskDate.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Moscow'
    });
}

// Функция форматирования времени
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function setupEventListeners() {
    // Кнопка завершения работы
    const completeBtn = document.getElementById('completeBtn');
    if (completeBtn) {
        completeBtn.addEventListener('click', completeLabWork);
    }
    
    // Если работа уже завершена, отключаем все обработчики проверки
    if (currentLab && currentLab.status === 'completed') {
        return;
    }
    
    // Обработчики для заданий (только для незавершенных работ)
    document.addEventListener('click', function(e) {
        if (e.target.closest('.check-btn')) {
            const taskIndex = e.target.closest('.check-btn').dataset.taskIndex;
            checkAnswer(parseInt(taskIndex));
        }
        
        if (e.target.closest('.choice-option')) {
            const option = e.target.closest('.choice-option');
            const taskIndex = option.closest('.task').dataset.taskIndex;
            const task = currentTasks[taskIndex];
            
            // Проверяем, доступна ли задача и не выполнена ли она
            if (task && task.available && !task.disabled) {
                const radio = option.querySelector('input[type="radio"]');
                
                if (radio && !radio.disabled) {
                    radio.checked = true;
                    option.closest('.multiple-choice').querySelectorAll('.choice-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    option.classList.add('selected');
                    
                    // Обновляем выбранный ответ в данных задачи
                    currentTasks[taskIndex].selectedAnswer = radio.value;
                    
                    // Если задача уже проверена, но неправильно, снимаем флаг checked
                    if (task.checked && !task.completed) {
                        currentTasks[taskIndex].checked = false;
                        // Просто обновляем интерфейс
                        const tasksContainer = document.getElementById('tasksContainer');
                        const taskElement = tasksContainer.querySelector(`.task[data-task-index="${taskIndex}"]`);
                        if (taskElement) {
                            const newElement = createTaskElement(task, taskIndex);
                            taskElement.replaceWith(newElement);
                        }
                    }
                }
            }
        }
    });
    
    // Обработчики для ввода текста
    document.addEventListener('input', function(e) {
        if (e.target.matches('input[type="text"]') && e.target.id.startsWith('input-')) {
            const taskIndex = e.target.id.split('-')[1];
            const task = currentTasks[taskIndex];
            
            if (task && task.available && !task.disabled) {
                currentTasks[taskIndex].userAnswer = e.target.value;
                
                // Если задача уже проверена, но неправильно, снимаем флаг checked
                if (task.checked && !task.completed) {
                    currentTasks[taskIndex].checked = false;
                    // Просто обновляем интерфейс
                    const tasksContainer = document.getElementById('tasksContainer');
                    const taskElement = tasksContainer.querySelector(`.task[data-task-index="${taskIndex}"]`);
                    if (taskElement) {
                        const newElement = createTaskElement(task, taskIndex);
                        taskElement.replaceWith(newElement);
                    }
                }
            }
        }
    });
}

async function checkAnswer(taskIndex) {
    const task = currentTasks[taskIndex];
    if (!task || !task.available) {
        showNotification('Это задание еще недоступно', 'error');
        return;
    }
    
    // Для заданий с вопросами проверяем, выбран ли ответ
    if (task.type === 'question' && !task.selectedAnswer) {
        showNotification('Выберите ответ', 'error');
        return;
    }
    
    // Для текстовых полей проверяем, введен ли ответ
    if (task.type === 'input' && (!task.userAnswer || task.userAnswer.trim() === '')) {
        showNotification('Введите ответ', 'error');
        return;
    }
    
    try {
        const answer = task.type === 'question' ? task.selectedAnswer : task.userAnswer;
        const response = await apiRequest(`/api/student/lab/${currentLab.id}/check-answer`, {
            method: 'POST',
            body: JSON.stringify({
                task_number: task.task_number,
                answer: answer
            })
        });
        
        if (response && response.success) {
            // Обновляем данные задачи
            task.checked = true;
            task.correct = response.is_correct;
            task.completed = response.task_data?.completed || false;
            task.score = response.task_data?.score || 0;
            task.attempts = response.task_data?.attempts || 1;
            
            // Разблокируем следующую задачу, если текущая выполнена
            if (task.completed) {
                const nextTaskIndex = taskIndex + 1;
                if (nextTaskIndex < currentTasks.length) {
                    currentTasks[nextTaskIndex].available = true;
                    currentTasks[nextTaskIndex].disabled = false;
                }
            }
            
            // Перерисовываем все задачи
            renderTasks();
            
            if (response.is_correct) {
                showNotification('Ответ правильный!', 'success');
                if (taskIndex + 1 < currentTasks.length) {
                    showNotification('Следующее задание разблокировано!', 'info');
                }
            } else {
                if (task.attempts >= 10) {
                    showNotification('Исчерпаны все попытки. Переходите к следующему заданию.', 'error');
                    task.disabled = true;
                    
                    // Разблокируем следующую задачу даже при неудаче после 10 попыток
                    const nextTaskIndex = taskIndex + 1;
                    if (nextTaskIndex < currentTasks.length) {
                        currentTasks[nextTaskIndex].available = true;
                        currentTasks[nextTaskIndex].disabled = false;
                        showNotification('Следующее задание разблокировано.', 'info');
                    }
                } else {
                    showNotification(`Неправильно. Осталось попыток: ${10 - task.attempts}`, 'error');
                }
            }
            
            // Обновляем общую кнопку завершения
            updateCompleteButton();
            
        } else if (response) {
            // Сервер вернул ошибку (success: false)
            showNotification(response.error || 'Ошибка проверки ответа', 'error');
            
            // Если ошибка о предыдущем задании, показываем подсказку
            if (response.error && response.error.includes('предыдущее задание')) {
                const prevTaskIndex = taskIndex - 1;
                if (prevTaskIndex >= 0) {
                    showNotification(`Сначала выполните задание ${prevTaskIndex + 1}`, 'warning');
                }
            }
        } else {
            showNotification('Неизвестная ошибка сервера', 'error');
        }
    } catch (error) {
        console.error('Check answer error:', error);
        
        // Обрабатываем разные типы ошибок
        if (error.message && error.message.includes('403')) {
            showNotification('Сначала выполните предыдущее задание', 'error');
        } else if (error.message && error.message.includes('HTTP error')) {
            showNotification('Ошибка соединения с сервером', 'error');
        } else {
            showNotification('Ошибка: ' + error.message, 'error');
        }
    }
}

window.downloadMaterial = downloadMaterial;

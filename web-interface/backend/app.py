from flask import Flask, request, jsonify, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import json
import os

app = Flask(__name__, static_folder='../frontend')
app.config['SECRET_KEY'] = 'cyber-polygon-secret-key-2024'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cyber_range.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Модели базы данных
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # student, teacher
    group = db.Column(db.String(50))
    department = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'name': self.name,
            'role': self.role,
            'group': self.group,
            'department': self.department
        }

class Lab(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    lab_number = db.Column(db.Integer, nullable=False)  # 0 - подготовка, 1 - ЛР1, 2 - ЛР2
    difficulty = db.Column(db.String(20), nullable=False)  # easy, medium, hard
    content = db.Column(db.Text)  # JSON с заданиями
    max_score = db.Column(db.Integer, default=100)
    is_active = db.Column(db.Boolean, default=True)
    order = db.Column(db.Integer, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'lab_number': self.lab_number,
            'difficulty': self.difficulty,
            'max_score': self.max_score,
            'order': self.order
        }

class StudentProgress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    lab_id = db.Column(db.Integer, db.ForeignKey('lab.id'), nullable=False)
    status = db.Column(db.String(20), default='not_started')  # not_started, in_progress, completed
    score = db.Column(db.Integer, default=0)
    attempts = db.Column(db.Integer, default=0)
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    total_time = db.Column(db.Integer, default=0)
    completed_tasks = db.Column(db.Text, default='[]')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'lab_id': self.lab_id,
            'status': self.status,
            'score': self.score,
            'attempts': self.attempts,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'total_time': self.total_time,
            'completed_tasks': json.loads(self.completed_tasks) if self.completed_tasks else []
        }

class TaskAttempt(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    lab_id = db.Column(db.Integer, db.ForeignKey('lab.id'), nullable=False)
    task_number = db.Column(db.Integer, nullable=False)
    answer = db.Column(db.Text)
    is_correct = db.Column(db.Boolean, default=False)
    attempt_time = db.Column(db.DateTime, default=datetime.utcnow)

def create_initial_data():
    if User.query.count() == 0:
        print("Создание начальных данных...")
        
        # Создаем преподавателя
        teacher = User(
            username='teacher',
            name='Анна Ивановна Преподавателева',
            role='teacher',
            department='Кафедра информационной безопасности'
        )
        teacher.set_password('teacher123')
        db.session.add(teacher)
        
        # Создаем студента
        student = User(
            username='student',
            name='Иван Петров Студентов',
            role='student',
            group='ИБ-401'
        )
        student.set_password('student123')
        db.session.add(student)
        
        # Создаем практические работы
        labs_data = [
            {
                 'title': 'Подготовительный этап',
                'description': 'Настройка системы мониторинга и уведомлений',
                'lab_number': 0,
                'difficulty': 'easy',
                'order': 1,
                'max_score': 0,
                'content': json.dumps([{
                    'type': 'info',
                    'title': 'Подготовительный этап',
                    'content': '''
                        <h3>1. Настройка уведомлений на email</h3>
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
                        
                        <div style="margin-top: 2rem; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                            <p><strong>После изучения материалов нажмите "Завершить подготовительный этап".</strong></p>
                            <p><em>Примечание: Подготовительный этап оценивается без баллов.</em></p>
                        </div>
                    '''
                }])
            },
            {
                'title': 'Практическая работа №1',
                'description': 'Обработка инцидента, связанного с несоответствующим использованием ресурсов системы',
                'lab_number': 1,
                'difficulty': 'medium',
                'order': 2,
                'max_score': 30,  # Максимум 30 баллов
                'content': json.dumps([
                    {
                        'type': 'question',
                        'question': 'Какой пароль используется для входа в учетную запись kali?',
                        'answers': ['190902', '123456', 'password', 'kali123'],
                        'correct_answer': '190902',
                        'task_number': 1
                    },
                    {
                        'type': 'question', 
                        'question': 'Какая команда используется для редактирования файла конфигурации logcheck?',
                        'answers': [
                            'sudo nano /etc/logcheck/logcheck.conf',
                            'sudo edit /etc/logcheck.conf', 
                            'vim /etc/logcheck.conf',
                            'gedit /etc/logcheck/logcheck.conf'
                        ],
                        'correct_answer': 'sudo nano /etc/logcheck/logcheck.conf',
                        'task_number': 2
                    },
                    {
                        'type': 'question',
                        'question': 'Какое ПО вызвало перегрузку системы?',
                        'answers': ['Minetest', 'nsnake', 'Minecraft', 'Apache'],
                        'correct_answer': 'Minetest',
                        'task_number': 3
                    }
                ])
            },
            {
                'title': 'Практическая работа №2', 
                'description': 'Обработка инцидента, связанного с несанкционированным доступом к системе',
                'lab_number': 2,
                'difficulty': 'medium',
                'order': 3,
                'max_score': 30,  # Максимум 30 баллов
                'content': json.dumps([
                    {
                        'type': 'question',
                        'question': 'Сколько неудачных попыток входа было обнаружено в учетную запись user1?',
                        'answers': ['5', '7', '10', '3'],
                        'correct_answer': '7',
                        'task_number': 1
                    },
                    {
                        'type': 'question',
                        'question': 'В какой файл нужно добавить ограничение количества попыток аутентификации?',
                        'answers': [
                            '/etc/pam.d/lightdm',
                            '/etc/ssh/sshd_config', 
                            '/etc/login.defs',
                            '/etc/security/limits.conf'
                        ],
                        'correct_answer': '/etc/pam.d/lightdm',
                        'task_number': 2
                    },
                    {
                        'type': 'input',
                        'question': 'Какое значение параметра deny нужно установить для ограничения в 3 попытки?',
                        'correct_answer': '3',
                        'task_number': 3
                    }
                ])
            }
        ]
        
        for lab_data in labs_data:
            lab = Lab(**lab_data)
            db.session.add(lab)
        
        db.session.commit()
        print(f"Создано {len(labs_data)} практических работ")
        print("Начальные данные созданы!")

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5000')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# API АВТОРИЗАЦИИ
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'success': False, 'error': 'Заполните все поля'}), 400
    
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password):
        session['user_id'] = user.id
        session['user_role'] = user.role
        return jsonify({
            'success': True,
            'message': 'Вход выполнен успешно',
            'user': user.to_dict()
        })
    
    return jsonify({'success': False, 'error': 'Неверный логин или пароль'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Выход выполнен'})

@app.route('/api/check-auth')
def check_auth():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({'authenticated': True, 'user': user.to_dict()})
    return jsonify({'authenticated': False})

# API ПРАКТИЧЕСКИХ РАБОТ
@app.route('/api/labs')
def get_labs():
    labs = Lab.query.filter_by(is_active=True).order_by(Lab.order).all()
    return jsonify({
        'success': True,
        'labs': [lab.to_dict() for lab in labs]
    })

@app.route('/api/labs/<int:lab_id>')
def get_lab(lab_id):
    lab = Lab.query.get(lab_id)
    if not lab:
        return jsonify({'success': False, 'error': 'Практическая работа не найдена'}), 404
    
    return jsonify({
        'success': True,
        'lab': lab.to_dict()
    })

# API ДЛЯ СТУДЕНТОВ
@app.route('/api/student/dashboard')
def student_dashboard():
    if 'user_id' not in session or session.get('user_role') != 'student':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    user = User.query.get(session['user_id'])
    progress = StudentProgress.query.filter_by(student_id=user.id).all()
    
    # Получаем только ЛР1 и ЛР2 (исключаем подготовительную с lab_number=0)
    labs = Lab.query.filter(
        Lab.is_active == True,
        Lab.lab_number.in_([1, 2])  # Только ЛР1 и ЛР2
    ).order_by(Lab.order).all()
    
    total_labs = len(labs)
    
    # Фильтруем прогресс только по ЛР1 и ЛР2
    relevant_progress = []
    for p in progress:
        lab = Lab.query.get(p.lab_id)
        if lab and lab.lab_number in [1, 2]:
            relevant_progress.append(p)
    
    completed_labs = len([p for p in relevant_progress if p.status == 'completed'])
    
    labs_data = []
    # Получаем все лабораторные, включая подготовительную, для отображения
    all_labs = Lab.query.filter_by(is_active=True).order_by(Lab.order).all()
    
    for lab in all_labs:
        lab_progress = next((p for p in progress if p.lab_id == lab.id), None)
        
        can_start = True
        if lab.order > 1:
            prev_lab = Lab.query.filter_by(order=lab.order-1).first()
            if prev_lab:
                prev_progress = next((p for p in progress if p.lab_id == prev_lab.id), None)
                if not prev_progress or prev_progress.status != 'completed':
                    can_start = False
        
        labs_data.append({
            **lab.to_dict(),
            'status': lab_progress.status if lab_progress else 'not_started',
            'score': lab_progress.score if lab_progress else 0,
            'can_start': can_start
        })
    
    # Средний балл: только для ЛР1 и ЛР2, исключаем подготовительную
    completed_progress = [p for p in relevant_progress if p.status == 'completed']
    
    if completed_progress:
        total_score = sum(p.score for p in completed_progress)
        avg_score = round(total_score / len(completed_progress), 1)
    else:
        avg_score = 0
    
    return jsonify({
        'success': True,
        'user': user.to_dict(),
        'stats': {
            'total_labs': total_labs,  # Теперь будет 2
            'completed_labs': completed_labs,
            'success_rate': round((completed_labs / total_labs * 100) if total_labs > 0 else 0, 1),
            'average_score': avg_score
        },
        'labs': labs_data
    })

@app.route('/api/student/lab/<int:lab_id>/progress')
def get_lab_progress(lab_id):
    if 'user_id' not in session or session.get('user_role') != 'student':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    user = User.query.get(session['user_id'])
    
    progress = StudentProgress.query.filter_by(
        student_id=user.id,
        lab_id=lab_id
    ).first()
    
    if not progress:
        # Если прогресса нет, создаем его (особенно важно для повторного входа в выполненную работу)
        lab = Lab.query.get(lab_id)
        if not lab:
            return jsonify({'success': False, 'error': 'Практическая работа не найдена'}), 404
        
        # Создаем прогресс со статусом 'completed', если работа уже была выполнена
        # Проверяем, может студент уже выполнил эту работу ранее
        existing_completed = StudentProgress.query.filter_by(
            student_id=user.id,
            lab_id=lab_id,
            status='completed'
        ).first()
        
        if existing_completed:
            progress = existing_completed
        else:
            return jsonify({'success': False, 'error': 'Прогресс не найден'}), 404
    
    return jsonify({
        'success': True,
        'progress': progress.to_dict()
    })

@app.route('/api/student/lab/<int:lab_id>/start', methods=['POST'])
def start_lab(lab_id):
    if 'user_id' not in session or session.get('user_role') != 'student':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    user = User.query.get(session['user_id'])
    lab = Lab.query.get(lab_id)
    
    if not lab:
        return jsonify({'success': False, 'error': 'Лабораторная работа не найдена'}), 404
    
    if lab.order > 1:
        prev_lab = Lab.query.filter_by(order=lab.order-1).first()
        if prev_lab:
            prev_progress = StudentProgress.query.filter_by(
                student_id=user.id,
                lab_id=prev_lab.id
            ).first()
            if not prev_progress or prev_progress.status != 'completed':
                return jsonify({'success': False, 'error': 'Сначала выполните предыдущую практическую работу'}), 403
    
    progress = StudentProgress.query.filter_by(
        student_id=user.id,
        lab_id=lab_id
    ).first()
    
    if not progress:
        progress = StudentProgress(
            student_id=user.id,
            lab_id=lab_id,
            status='in_progress',
            start_time=datetime.utcnow()
        )
        db.session.add(progress)
    elif progress.status == 'not_started':
        progress.status = 'in_progress'
        progress.start_time = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Практическая работа начата'
    })

@app.route('/api/student/lab/<int:lab_id>/check-answer', methods=['POST'])
def check_answer_endpoint(lab_id):
    if 'user_id' not in session or session.get('user_role') != 'student':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    data = request.get_json()
    task_number = data.get('task_number')
    answer = data.get('answer', '')
    
    if not task_number:
        return jsonify({'success': False, 'error': 'Не указан номер задания'}), 400
    
    user = User.query.get(session['user_id'])
    lab = Lab.query.get(lab_id)
    
    if not lab:
        return jsonify({'success': False, 'error': 'Практическая работа не найдена'}), 404
    
    progress = StudentProgress.query.filter_by(
        student_id=user.id,
        lab_id=lab_id
    ).first()
    
    if not progress or progress.status != 'in_progress':
        return jsonify({'success': False, 'error': 'Практическая работа не начата'}), 403
    
    # Получаем контент лабораторной и задачи
    tasks_content = json.loads(lab.content) if lab.content else []
    
    # Находим текущую задачу
    task = next((t for t in tasks_content if t.get('task_number') == task_number), None)
    
    if not task:
        return jsonify({'success': False, 'error': 'Задание не найдено'}), 404
    
    # Проверяем, можно ли выполнять эту задачу
    completed_tasks = json.loads(progress.completed_tasks) if progress.completed_tasks else []
    
    # Проверяем, выполнены ли предыдущие задачи
    if task_number > 1:
        # Находим предыдущую задачу
        prev_task = next((t for t in completed_tasks if t['task_number'] == task_number - 1), None)
        
        # Если предыдущая задача не выполнена, запрещаем выполнение текущей
        if not prev_task or not prev_task.get('completed', False):
            return jsonify({
                'success': False, 
                'error': 'Сначала выполните предыдущее задание'
            })  # Убираем status=403, чтобы фронтенд мог прочитать сообщение
    
    is_correct = False
    if task['type'] == 'question':
        is_correct = answer == task['correct_answer']
    elif task['type'] == 'input':
        is_correct = answer.strip().lower() == task['correct_answer'].strip().lower()
    
    attempt = TaskAttempt(
        student_id=user.id,
        lab_id=lab_id,
        task_number=task_number,
        answer=answer,
        is_correct=is_correct
    )
    db.session.add(attempt)
    
    task_data = next((t for t in completed_tasks if t['task_number'] == task_number), None)
    
    if not task_data:
        # Первая попытка
        score = 10 if is_correct else 9
        task_data = {
            'task_number': task_number,
            'completed': is_correct,
            'attempts': 1,
            'last_answer': answer,
            'score': score,
            'unlocked_next': is_correct  # Разблокировать следующее задание если правильно
        }
        completed_tasks.append(task_data)
    else:
        # Уже есть попытки
        task_data['attempts'] += 1
        
        if is_correct and not task_data['completed']:
            # Впервые ответил правильно
            task_data['completed'] = True
            # -1 балл за каждую лишнюю попытку (начиная со второй)
            penalty = min(task_data['attempts'] - 1, 9)  # Максимум 9 баллов можно снять
            task_data['score'] = max(1, 10 - penalty)
            task_data['unlocked_next'] = True  # Разблокировать следующее задание
        elif not is_correct and not task_data['completed']:
            # Еще не ответил правильно, уменьшаем баллы
            if task_data['attempts'] <= 10:
                task_data['score'] = max(0, 10 - task_data['attempts'] + 1)
            else:
                task_data['score'] = 0
        
        task_data['last_answer'] = answer
    
    progress.completed_tasks = json.dumps(completed_tasks)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'is_correct': is_correct,
        'task_data': task_data
    })

@app.route('/api/student/lab/<int:lab_id>/complete', methods=['POST'])
def complete_lab(lab_id):
    if 'user_id' not in session or session.get('user_role') != 'student':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    data = request.get_json()
    total_time = data.get('total_time', 0)
    
    user = User.query.get(session['user_id'])
    
    progress = StudentProgress.query.filter_by(
        student_id=user.id,
        lab_id=lab_id
    ).first()
    
    if not progress or progress.status != 'in_progress':
        return jsonify({'success': False, 'error': 'Практическая работа не начата'}), 403
    
    lab = Lab.query.get(lab_id)
    
    completed_tasks = json.loads(progress.completed_tasks) if progress.completed_tasks else []
    
    # Считаем общий балл
    total_score = 0
    for task in completed_tasks:
        if task.get('completed'):
            total_score += task.get('score', 0)
    
    # Для подготовительной работы баллы не учитываем
    if lab.lab_number == 0:
        total_score = 0
    
    progress.status = 'completed'
    progress.score = total_score
    progress.end_time = datetime.utcnow()
    
    if progress.start_time:
        progress.total_time = int((progress.end_time - progress.start_time).total_seconds())
    
    db.session.commit()
    
    def convert_to_msk(utc_dt):
        if not utc_dt:
            return None
        return utc_dt + timedelta(hours=3)
    
    start_time_msk = convert_to_msk(progress.start_time)
    end_time_msk = convert_to_msk(progress.end_time)
    
    # Устанавливаем максимальный балл: 30 для ЛР1 и ЛР2, 0 для подготовительной
    if lab.lab_number in [1, 2]:
        max_score = 30
    elif lab.lab_number == 0:
        max_score = 0
    else:
        max_score = lab.max_score if lab else 100
    
    return jsonify({
        'success': True,
        'message': 'Практическая работа завершена',
        'score': total_score,
        'max_score': max_score,
        'start_time': start_time_msk.isoformat() if start_time_msk else None,
        'end_time': end_time_msk.isoformat() if end_time_msk else None,
        'total_time': progress.total_time
    })

@app.route('/api/student/lab/<int:lab_id>/update-time', methods=['POST'])
def update_lab_time(lab_id):
    if 'user_id' not in session or session.get('user_role') != 'student':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    data = request.get_json()
    elapsed_time = data.get('elapsed_time', 0)
    
    user = User.query.get(session['user_id'])
    
    progress = StudentProgress.query.filter_by(
        student_id=user.id,
        lab_id=lab_id
    ).first()
    
    if progress:
        progress.total_time = elapsed_time
        db.session.commit()
    
    return jsonify({'success': True})

# API ДЛЯ ПРЕПОДАВАТЕЛЕЙ
@app.route('/api/teacher/dashboard')
def teacher_dashboard():
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    user = User.query.get(session['user_id'])
    
    # Считаем только ЛР1 и ЛР2, исключаем подготовительную (lab_number=0)
    total_labs = Lab.query.filter(
        Lab.is_active == True,
        Lab.lab_number.in_([1, 2])  # Только ЛР1 и ЛР2
    ).count()
    
    total_students = User.query.filter_by(role='student').count()
    
    return jsonify({
        'success': True,
        'user': user.to_dict(),
        'stats': {
            'total_students': total_students,
            'total_labs': total_labs  # Теперь будет 2
        }
    })

@app.route('/api/teacher/students')
def get_students():
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    students = User.query.filter_by(role='student').all()
    students_data = []
    
    for student in students:
        progresses = StudentProgress.query.filter_by(student_id=student.id).all()
        
        # Фильтруем только выполненные ЛР1 и ЛР2
        completed_labs = []
        for progress in progresses:
            if progress.status == 'completed':
                lab = Lab.query.get(progress.lab_id)
                if lab and lab.lab_number in [1, 2]:  # Только ЛР1 и ЛР2
                    completed_labs.append({
                        'lab_id': lab.id,
                        'lab_title': lab.title,
                        'lab_number': lab.lab_number,
                        'score': progress.score,
                        'completed_at': progress.end_time
                    })
        
        # Рассчитываем средний балл только по ЛР1 и ЛР2
        if completed_labs:
            total_score = sum(lab['score'] for lab in completed_labs)
            average_score = round(total_score / len(completed_labs), 1)
        else:
            average_score = 0
        
        # Последняя активность
        last_activity = None
        if progresses:
            # Находим самую позднюю дату обновления
            latest_progress = max(progresses, key=lambda p: p.updated_at if p.updated_at else datetime.min)
            last_activity = latest_progress.updated_at
        
        # Конвертируем время в МСК
        def convert_to_msk(utc_dt):
            if not utc_dt:
                return None
            return utc_dt + timedelta(hours=3)
        
        last_activity_msk = convert_to_msk(last_activity) if last_activity else None
        
        students_data.append({
            'id': student.id,
            'username': student.username,
            'name': student.name,
            'group': student.group,
            'completed_labs_count': len(completed_labs),
            'average_score': average_score,
            'last_activity': last_activity_msk.strftime('%d.%m.%Y %H:%M:%S') if last_activity_msk else None,
            'completed_labs': completed_labs
        })
    
    return jsonify({
        'success': True,
        'students': students_data
    })

@app.route('/api/teacher/students', methods=['POST'])
def create_student():
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    data = request.get_json()
    
    required_fields = ['username', 'name', 'group', 'password']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'success': False, 'error': f'Не заполнено поле: {field}'}), 400
    
    existing = User.query.filter_by(username=data['username']).first()
    if existing:
        return jsonify({'success': False, 'error': 'Пользователь с таким логином уже существует'}), 400
    
    student = User(
        username=data['username'],
        name=data['name'],
        role='student',
        group=data['group']
    )
    student.set_password(data['password'])
    
    db.session.add(student)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Студент успешно создан',
        'student': student.to_dict()
    })

@app.route('/api/teacher/students/<int:student_id>', methods=['GET'])
def get_student_details(student_id):
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    student = User.query.get(student_id)
    if not student or student.role != 'student':
        return jsonify({'success': False, 'error': 'Студент не найден'}), 404
    
    progresses = StudentProgress.query.filter_by(student_id=student_id).all()
    
    # Находим последнюю активность
    last_activity = None
    if progresses:
        # Находим самую позднюю дату обновления
        latest_progress = max(progresses, key=lambda p: p.updated_at if p.updated_at else datetime.min)
        last_activity = latest_progress.updated_at
    
    # Конвертируем время в МСК
    def convert_to_msk(utc_dt):
        if not utc_dt:
            return None
        return utc_dt + timedelta(hours=3)
    
    last_activity_msk = convert_to_msk(last_activity) if last_activity else None
    
    labs_stats = []
    # Получаем все лабораторные работы
    labs = Lab.query.filter_by(is_active=True).order_by(Lab.order).all()
    
    for lab in labs:
        progress = next((p for p in progresses if p.lab_id == lab.id), None)
        if progress and progress.status == 'completed':
            attempts = TaskAttempt.query.filter_by(
                student_id=student_id,
                lab_id=lab.id
            ).all()
            
            task_attempts = {}
            for attempt in attempts:
                if attempt.task_number not in task_attempts:
                    task_attempts[attempt.task_number] = 0
                task_attempts[attempt.task_number] += 1
            
            start_time_msk = convert_to_msk(progress.start_time)
            end_time_msk = convert_to_msk(progress.end_time)
            
            labs_stats.append({
                'lab_id': lab.id,
                'lab_title': lab.title,
                'lab_number': lab.lab_number,
                'score': progress.score,
                'start_time': start_time_msk.strftime('%d.%m.%Y %H:%M:%S') if start_time_msk else '-',
                'end_time': end_time_msk.strftime('%d.%m.%Y %H:%M:%S') if end_time_msk else '-',
                'total_time': progress.total_time,
                'attempts': progress.attempts,
                'task_attempts': task_attempts
            })
    
    # Средний балл только для ЛР1 и ЛР2
    completed_progress = [p for p in progresses 
                         if p.status == 'completed' 
                         and p.lab_id 
                         and Lab.query.get(p.lab_id) 
                         and Lab.query.get(p.lab_id).lab_number in [1, 2]]
    
    if completed_progress:
        total_score = sum(p.score for p in completed_progress)
        average_score = round(total_score / len(completed_progress), 1)
    else:
        average_score = 0
    
    return jsonify({
        'success': True,
        'student': {
            **student.to_dict(),
            'last_activity': last_activity_msk.strftime('%d.%m.%Y %H:%M:%S') if last_activity_msk else None
        },
        'stats': {
            'total_labs': len([l for l in labs if l.lab_number in [1, 2]]),  # Только ЛР1 и ЛР2
            'completed_labs': len(completed_progress),
            'average_score': average_score,
            'labs_stats': labs_stats  # Все лабораторные, включая подготовительную
        }
    })

@app.route('/api/teacher/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    student = User.query.get(student_id)
    if not student or student.role != 'student':
        return jsonify({'success': False, 'error': 'Студент не найден'}), 404
    
    data = request.get_json()
    
    if 'name' in data:
        student.name = data['name']
    if 'group' in data:
        student.group = data['group']
    if 'username' in data:
        if data['username'] != student.username:
            existing = User.query.filter_by(username=data['username']).first()
            if existing:
                return jsonify({'success': False, 'error': 'Логин уже занят'}), 400
            student.username = data['username']
    if 'password' in data and data['password']:
        student.set_password(data['password'])
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Данные студента обновлены',
        'student': student.to_dict()
    })

@app.route('/api/teacher/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    student = User.query.get(student_id)
    if not student or student.role != 'student':
        return jsonify({'success': False, 'error': 'Студент не найден'}), 404
    
    StudentProgress.query.filter_by(student_id=student_id).delete()
    TaskAttempt.query.filter_by(student_id=student_id).delete()
    
    db.session.delete(student)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Студент удален'
    })

@app.route('/api/teacher/labs')
def get_teacher_labs():
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    # Получаем только ЛР1 и ЛР2
    labs = Lab.query.filter(Lab.lab_number.in_([1, 2]), Lab.is_active == True).order_by(Lab.order).all()
    labs_data = []
    
    for lab in labs:
        completed_count = StudentProgress.query.filter_by(
            lab_id=lab.id,
            status='completed'
        ).count()
        
        progresses = StudentProgress.query.filter_by(lab_id=lab.id, status='completed').all()
        
        # Средний балл только среди тех, кто выполнил
        if progresses:
            total_score = sum(p.score for p in progresses)
            avg_score = round(total_score / len(progresses), 1)
        else:
            avg_score = 0
        
        labs_data.append({
            **lab.to_dict(),
            'completed_count': completed_count,
            'average_score': avg_score
        })
    
    return jsonify({
        'success': True,
        'labs': labs_data
    })

@app.route('/api/teacher/labs/<int:lab_id>/stats')
def get_lab_stats(lab_id):
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    lab = Lab.query.get(lab_id)
    if not lab:
        return jsonify({'success': False, 'error': 'Практическая работа не найдена'}), 404
    
    progresses = StudentProgress.query.filter_by(
        lab_id=lab_id,
        status='completed'
    ).all()
    
    stats = []
    for progress in progresses:
        student = User.query.get(progress.student_id)
        
        attempts = TaskAttempt.query.filter_by(
            student_id=student.id,
            lab_id=lab_id
        ).all()
        
        # Подсчитываем попытки по заданиям
        task_attempts = {}
        total_attempts = 0
        for attempt in attempts:
            if attempt.task_number not in task_attempts:
                task_attempts[attempt.task_number] = 0
            task_attempts[attempt.task_number] += 1
            total_attempts += 1
        
        # Форматируем попытки для отображения в таблице
        attempts_text = ""
        if task_attempts:
            # Сортируем по номерам заданий
            sorted_tasks = sorted(task_attempts.items())
            attempts_text = ", ".join([f"Задание {task}: {att} п.\n" for task, att in sorted_tasks])
        
        # Конвертируем время в МСК
        def convert_to_msk(utc_dt):
            if not utc_dt:
                return None
            return utc_dt + timedelta(hours=3)
        
        start_time_msk = convert_to_msk(progress.start_time)
        end_time_msk = convert_to_msk(progress.end_time)
        
        stats.append({
            'student_id': student.id,
            'student_name': student.name,
            'student_group': student.group,
            'score': progress.score,
            'start_time': start_time_msk.strftime('%d.%m.%Y %H:%M:%S') if start_time_msk else '-',
            'end_time': end_time_msk.strftime('%d.%m.%Y %H:%M:%S') if end_time_msk else '-',
            'total_time': format_time(progress.total_time) if progress.total_time else '-',
            'attempts_text': attempts_text,
            'total_attempts': total_attempts,
            'task_attempts': task_attempts
        })
    
    return jsonify({
        'success': True,
        'lab': lab.to_dict(),
        'stats': stats,
        'total_completed': len(stats)
    })

def format_time(seconds):
    """Форматирование времени в ЧЧ:ММ:СС"""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"

def calculate_average_score(student_id):
    progresses = StudentProgress.query.filter_by(
        student_id=student_id, 
        status='completed'
    ).all()
    
    if not progresses:
        return 0
    
    total_score = sum(p.score for p in progresses)
    return round(total_score / len(progresses), 1)

#endpoint для отладки
@app.route('/api/debug/labs/<int:lab_id>')
def debug_lab(lab_id):
    """Endpoint для отладки - показывает содержимое работы"""
    lab = Lab.query.get(lab_id)
    if not lab:
        return jsonify({'success': False, 'error': 'Практическая работа не найдена'}), 404
    
    return jsonify({
        'success': True,
        'lab_id': lab.id,
        'title': lab.title,
        'has_content': bool(lab.content),
        'content_length': len(lab.content) if lab.content else 0,
        'content_preview': lab.content[:200] + '...' if lab.content else 'No content',
        'lab_number': lab.lab_number
    })

# СТАТИЧЕСКИЕ ФАЙЛЫ
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        create_initial_data()
    
    print("=" * 50)
    print("🚀 Киберполигон запущен!")
    print("📚 Откройте: http://localhost:5000")
    print("👨‍🏫 Преподаватель: teacher / teacher123")
    print("👨‍🎓 Студент: student / student123")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)

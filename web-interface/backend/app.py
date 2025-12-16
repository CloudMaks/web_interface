from flask import Flask, send_from_directory, jsonify, request, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import subprocess
import os
from datetime import datetime

# Создаем приложение
app = Flask(__name__, static_folder='../frontend')
app.config['SECRET_KEY'] = 'student-secret-key-123'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cyber_range.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# База данных
db = SQLAlchemy(app)

# МОДЕЛИ ДАННЫХ
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True)
    password_hash = db.Column(db.String(120))
    name = db.Column(db.String(100))
    role = db.Column(db.String(20))  # student, teacher
    group = db.Column(db.String(50))
    department = db.Column(db.String(100))
    
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
    title = db.Column(db.String(200))
    description = db.Column(db.Text)
    objective = db.Column(db.Text)
    category = db.Column(db.String(50))
    difficulty = db.Column(db.String(20))
    instructions = db.Column(db.Text)
    vm_name = db.Column(db.String(100))
    max_score = db.Column(db.Integer, default=100)
    is_active = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'objective': self.objective,
            'category': self.category,
            'difficulty': self.difficulty,
            'instructions': self.instructions.split('\n') if self.instructions else [],
            'vm_name': self.vm_name,
            'max_score': self.max_score,
            'is_active': self.is_active,
            'status': 'not_started',
            'due_date': '2024-12-31'
        }

class LabSubmission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    lab_id = db.Column(db.Integer, db.ForeignKey('lab.id'))
    solution = db.Column(db.Text)
    score = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending')
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)

# СИСТЕМА АВТОМАТИЧЕСКОЙ ПРОВЕРКИ
class GradingService:
    @staticmethod
    def check_sql_injection_solution(solution_text):
        """Проверка решения по SQL-инъекциям"""
        score = 0
        feedback = []
        
        # Ключевые слова для проверки
        keywords = {
            'sql инъекц': 20,
            'parameterized': 15, 
            'prepared statement': 15,
            'валидац': 10,
            'escaping': 10,
            'input filter': 10,
            'orm': 5,
            'pdo': 5
        }
        
        solution_lower = solution_text.lower()
        
        # Проверяем наличие ключевых понятий
        for keyword, points in keywords.items():
            if keyword in solution_lower:
                score += points
                feedback.append(f"✓ Упоминание: {keyword}")
        
        # Проверяем длину решения
        if len(solution_text) > 200:
            score += 10
            feedback.append("✓ Подробное описание")
        else:
            feedback.append("⚠️ Можно добавить больше деталей")
        
        # Проверяем примеры кода
        code_indicators = ['select', 'where', 'from', 'mysql', 'query']
        code_found = any(indicator in solution_lower for indicator in code_indicators)
        
        if code_found:
            score += 15
            feedback.append("✓ Приведены примеры кода")
        
        return {
            'score': min(score, 100),
            'max_score': 100,
            'feedback': feedback,
            'auto_graded': True
        }
    
    @staticmethod
    def check_xss_solution(solution_text):
        """Проверка решения по XSS"""
        score = 50
        feedback = ["Автоматическая проверка XSS - в разработке"]
        
        return {
            'score': score,
            'max_score': 100,
            'feedback': feedback,
            'auto_graded': False
        }

# СИСТЕМА УПРАВЛЕНИЯ ВИРТУАЛЬНЫМИ МАШИНАМИ
class VMService:
    @staticmethod
    def execute_vbox_command(command_args):
        """Выполнение команды VBoxManage"""
        try:
            result = subprocess.run(
                ['VBoxManage'] + command_args,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return {
                'success': result.returncode == 0,
                'output': result.stdout,
                'error': result.stderr,
                'returncode': result.returncode
            }
        except subprocess.TimeoutExpired:
            return {'success': False, 'error': 'Таймаут выполнения команды'}
        except FileNotFoundError:
            return {'success': False, 'error': 'VBoxManage не найден. Установите VirtualBox.'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def get_vm_status(vm_name="Web-Target-VM"):
        """Получить статус виртуальной машины"""
        result = VMService.execute_vbox_command(['showvminfo', vm_name, '--machinereadable'])
        
        if result['success']:
            for line in result['output'].split('\n'):
                if line.startswith('VMState='):
                    state = line.split('=')[1].strip('"')
                    return {'status': 'success', 'state': state}
        
        # Заглушка если VirtualBox не установлен
        return {'status': 'success', 'state': 'running'}
    
    @staticmethod
    def start_vm(vm_name="Web-Target-VM"):
        """Запустить виртуальную машину"""
        result = VMService.execute_vbox_command(['startvm', vm_name, '--type', 'headless'])
        
        if result['success']:
            return {'status': 'success', 'message': f'ВМ {vm_name} запущена'}
        else:
            # Заглушка если VirtualBox не установлен
            return {'status': 'success', 'message': f'ВМ {vm_name} запущена (заглушка)'}
    
    @staticmethod
    def stop_vm(vm_name="Web-Target-VM"):
        """Остановить виртуальную машину"""
        result = VMService.execute_vbox_command(['controlvm', vm_name, 'poweroff'])
        
        if result['success']:
            return {'status': 'success', 'message': f'ВМ {vm_name} остановлена'}
        else:
            # Заглушка если VirtualBox не установлен
            return {'status': 'success', 'message': f'ВМ {vm_name} остановлена (заглушка)'}

# СИСТЕМА УВЕДОМЛЕНИЙ
class NotificationService:
    @staticmethod
    def send_grade_notification(student_id, lab_title, score, max_score):
        """Отправка уведомления о проверке работы"""
        print(f"📧 Уведомление для студента {student_id}: Работа '{lab_title}' проверена. Оценка: {score}/{max_score}")
    
    @staticmethod
    def send_submission_notification(teacher_id, student_name, lab_title):
        """Уведомление преподавателя о новой работе"""
        print(f"📨 Уведомление для преподавателя {teacher_id}: Студент {student_name} сдал работу '{lab_title}'")

# СОЗДАЕМ ТЕСТОВЫЕ ДАННЫЕ
def create_test_data():
    """Заполнение базы тестовыми данными"""
    if not User.query.first():
        print("Создаем тестовых пользователей...")
        
        # Создаем студента
        student = User(
            username='student',
            name='Иван Студентов',
            role='student',
            group='ИБ-401'
        )
        student.set_password('student123')
        db.session.add(student)
        
        # Создаем преподавателя
        teacher = User(
            username='teacher',
            name='Анна Преподавателева', 
            role='teacher',
            department='Кафедра информационной безопасности'
        )
        teacher.set_password('teacher123')
        db.session.add(teacher)
        
        # Создаем лабораторные работы
        labs_data = [
            {
                'title': 'SQL-инъекции: основы',
                'description': 'Изучение механизмов SQL-инъекций и методов защиты веб-приложений',
                'objective': 'Освоить техники SQL-инъекций и научиться защищать приложения',
                'category': 'web-security',
                'difficulty': 'medium',
                'instructions': '1. Проанализируйте уязвимое веб-приложение\n2. Найдите уязвимость SQL-injection\n3. Извлеките скрытые данные\n4. Предложите меры защиты',
                'vm_name': 'Web-Target-VM',
                'max_score': 100
            },
            {
                'title': 'XSS атаки и защита',
                'description': 'Исследование межсайтового скриптинга и способов противодействия',
                'objective': 'Изучить механизмы XSS атак и методы защиты',
                'category': 'web-security',
                'difficulty': 'easy',
                'instructions': '1. Найдите XSS уязвимости в приложении\n2. Продемонстрируйте атаку\n3. Реализуйте защитные механизмы',
                'vm_name': 'Web-Target-VM', 
                'max_score': 100
            },
            {
                'title': 'Сетевой анализ трафика',
                'description': 'Анализ сетевого трафика и выявление аномалий',
                'objective': 'Научиться анализировать сетевой трафик',
                'category': 'network-security',
                'difficulty': 'hard',
                'instructions': '1. Захватите сетевой трафик\n2. Проанализируйте пакеты\n3. Выявите подозрительную активность',
                'vm_name': 'Network-Monitor-VM',
                'max_score': 100
            }
        ]
        
        for lab_data in labs_data:
            lab = Lab(**lab_data)
            db.session.add(lab)
        
        db.session.commit()
        print("Тестовые данные созданы!")

# CORS ДЛЯ ФРОНТЕНДА
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5000')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/api/labs', methods=['OPTIONS'])
def options_labs():
    return '', 200

# ГЛАВНЫЕ СТРАНИЦЫ
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# API АВТОРИЗАЦИИ
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password):
        session['user_id'] = user.id
        session['user_role'] = user.role
        return jsonify({
            'success': True,
            'message': 'Вход выполнен успешно',
            'user': user.to_dict()
        })
    else:
        return jsonify({'success': False, 'error': 'Неверный логин или пароль'}), 401

@app.route('/api/check-auth')
def check_auth():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({'authenticated': True, 'user': user.to_dict()})
    return jsonify({'authenticated': False})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Выход выполнен'})

# API ЛАБОРАТОРНЫХ РАБОТ
@app.route('/api/labs')
def get_labs():
    labs = Lab.query.filter_by(is_active=True).all()
    return jsonify({
        'success': True,
        'labs': [lab.to_dict() for lab in labs]
    })

@app.route('/api/labs/<int:lab_id>')
def get_lab_details(lab_id):
    lab = Lab.query.get_or_404(lab_id)
    return jsonify({
        'success': True, 
        'lab': lab.to_dict()
    })

# API СДАЧИ И ПРОВЕРКИ РАБОТ
@app.route('/api/submit', methods=['POST'])
def submit_lab():
    if 'user_id' not in session or session.get('user_role') != 'student':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    data = request.get_json()
    lab_id = data.get('lab_id')
    solution = data.get('solution')
    
    if not lab_id or not solution:
        return jsonify({'success': False, 'error': 'Необходимо указать lab_id и solution'}), 400
    
    # Проверяем существование лабораторной
    lab = Lab.query.get(lab_id)
    if not lab:
        return jsonify({'success': False, 'error': 'Лабораторная работа не найдена'}), 404
    
    # Автоматическая проверка
    grading_result = None
    if 'sql' in lab.title.lower() or 'инъекц' in lab.title.lower():
        grading_result = GradingService.check_sql_injection_solution(solution)
    
    # Создаем запись о сдаче работы
    submission = LabSubmission(
        student_id=session['user_id'],
        lab_id=lab_id,
        solution=solution,
        status='graded' if grading_result and grading_result['auto_graded'] else 'submitted'
    )
    
    # Если есть результат автоматической проверки
    if grading_result and grading_result['auto_graded']:
        submission.score = grading_result['score']
        submission.feedback = '\n'.join(grading_result['feedback'])
        submission.status = 'graded'
        message = f'Работа проверена автоматически! Оценка: {submission.score}/{lab.max_score}'
    else:
        message = 'Работа отправлена на проверку преподавателю'
    
    db.session.add(submission)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': message,
        'submission_id': submission.id,
        'auto_graded': grading_result['auto_graded'] if grading_result else False,
        'score': submission.score
    })

@app.route('/api/auto-grade', methods=['POST'])
def auto_grade():
    """Автоматическая проверка решения"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Не авторизован'}), 401
    
    data = request.get_json()
    lab_id = data.get('lab_id')
    solution = data.get('solution')
    
    if not lab_id or not solution:
        return jsonify({'success': False, 'error': 'Необходимы lab_id и solution'}), 400
    
    # Получаем информацию о лабораторной
    lab = Lab.query.get(lab_id)
    if not lab:
        return jsonify({'success': False, 'error': 'Лабораторная не найдена'}), 404
    
    # Выбираем подходящий алгоритм проверки
    if 'sql' in lab.title.lower() or 'инъекц' in lab.title.lower():
        result = GradingService.check_sql_injection_solution(solution)
    elif 'xss' in lab.title.lower():
        result = GradingService.check_xss_solution(solution)
    else:
        result = {
            'score': 0,
            'max_score': lab.max_score,
            'feedback': ['Требуется проверка преподавателем'],
            'auto_graded': False
        }
    
    return jsonify({
        'success': True,
        'result': result
    })

# API ВИРТУАЛЬНЫХ МАШИН
@app.route('/api/vm/status')
def get_vm_status():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Не авторизован'}), 401
    
    result = VMService.get_vm_status()
    return jsonify(result)

@app.route('/api/vm/start', methods=['POST'])
def start_vm():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Не авторизован'}), 401
    
    result = VMService.start_vm()
    return jsonify(result)

@app.route('/api/vm/stop', methods=['POST'])
def stop_vm():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Не авторизован'}), 401
    
    result = VMService.stop_vm()
    return jsonify(result)

# API ПРЕПОДАВАТЕЛЯ
@app.route('/api/teacher/students')
def get_students():
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    students = User.query.filter_by(role='student').all()
    students_data = []
    
    for student in students:
        # Добавляем статистику для каждого студента
        submissions = LabSubmission.query.filter_by(student_id=student.id).all()
        completed = [s for s in submissions if s.score is not None]
        avg_score = sum(s.score for s in completed) / len(completed) if completed else 0
        
        students_data.append({
            'id': student.id,
            'username': student.username,
            'name': student.name,
            'group': student.group,
            'completed_labs': len(completed),
            'average_score': round(avg_score, 1),
        })
    
    return jsonify({
        'success': True,
        'students': students_data
    })

@app.route('/api/teacher/submissions')
def get_submissions():
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    submissions = LabSubmission.query.all()
    submissions_data = []
    
    for sub in submissions:
        student = User.query.get(sub.student_id)
        lab = Lab.query.get(sub.lab_id)
        
        submissions_data.append({
            'id': sub.id,
            'student_name': student.name if student else 'Неизвестно',
            'student_group': student.group if student else '',
            'lab_title': lab.title if lab else 'Неизвестно',
            'score': sub.score,
            'status': sub.status,
            'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None
        })
    
    return jsonify({
        'success': True,
        'submissions': submissions_data
    })

# ОТЛАДОЧНЫЕ API
@app.route('/api/debug/labs')
def debug_labs():
    """Отладочный endpoint для проверки лабораторных"""
    try:
        labs = Lab.query.filter_by(is_active=True).all()
        
        return jsonify({
            'success': True,
            'count': len(labs),
            'labs': [lab.to_dict() for lab in labs]
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'count': 0,
            'labs': []
        })

@app.route('/api/debug/db')
def debug_db():
    """Проверка всей базы данных"""
    try:
        users_count = User.query.count()
        labs_count = Lab.query.count()
        submissions_count = LabSubmission.query.count()
        
        return jsonify({
            'success': True,
            'database': {
                'users': users_count,
                'labs': labs_count,
                'submissions': submissions_count
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

# СОЗДАНИЕ НОВОЙ ЛАБОРАТОРНОЙ РАБОТЫ
@app.route('/api/teacher/labs', methods=['POST'])
def create_lab():
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    data = request.get_json()
    
    try:
        lab = Lab(
            title=data.get('title'),
            description=data.get('description'),
            objective=data.get('objective', ''),
            category=data.get('category'),
            difficulty=data.get('difficulty'),
            instructions=data.get('instructions', ''),
            vm_name=data.get('vm_name', 'Web-Target-VM'),
            max_score=data.get('max_score', 100),
            is_active=True
        )
        
        db.session.add(lab)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Лабораторная работа создана',
            'lab': lab.to_dict()
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ДОБАВЛЕНИЕ НОВОГО СТУДЕНТА
@app.route('/api/teacher/students', methods=['POST'])
def create_student():
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    data = request.get_json()
    
    try:
        # Проверяем что логин уникален
        existing_user = User.query.filter_by(username=data.get('username')).first()
        if existing_user:
            return jsonify({'success': False, 'error': 'Пользователь с таким логином уже существует'}), 400
        
        student = User(
            username=data.get('username'),
            name=data.get('name'),
            role='student',
            group=data.get('group')
        )
        student.set_password(data.get('password', '123456'))
        
        db.session.add(student)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Студент добавлен',
            'student': student.to_dict()
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Просмотра студентов
@app.route('/api/teacher/students/<int:student_id>')
def get_student_details(student_id):
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    student = User.query.get_or_404(student_id)
    
    # Получаем все работы студента
    submissions = LabSubmission.query.filter_by(student_id=student_id).all()
    submissions_data = []
    
    for sub in submissions:
        lab = Lab.query.get(sub.lab_id)
        submissions_data.append({
            'lab_title': lab.title if lab else 'Неизвестно',
            'score': sub.score,
            'status': sub.status,
            'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None,
            'feedback': sub.feedback
        })
    
    # Статистика студента
    completed = [s for s in submissions if s.score is not None]
    avg_score = sum(s.score for s in completed) / len(completed) if completed else 0
    
    return jsonify({
        'success': True,
        'student': {
            'id': student.id,
            'name': student.name,
            'username': student.username,
            'group': student.group,
            'completed_labs': len(completed),
            'average_score': round(avg_score, 1),
            'total_submissions': len(submissions),
            'submissions': submissions_data
        }
    })

#Редактирование студентов
@app.route('/api/teacher/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    student = User.query.get_or_404(student_id)
    data = request.get_json()
    
    try:
        # Обновляем основные данные
        if 'name' in data:
            student.name = data['name']
        if 'group' in data:
            student.group = data['group']
        
        # Обновляем пароль если предоставлен
        if 'password' in data and data['password']:
            student.set_password(data['password'])
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Данные студента обновлены',
            'student': student.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    
#Удаление студента
@app.route('/api/teacher/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    if 'user_id' not in session or session.get('user_role') != 'teacher':
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    student = User.query.get_or_404(student_id)
    
    try:
        # Удаляем все работы студента сначала
        LabSubmission.query.filter_by(student_id=student_id).delete()
        # Затем удаляем самого студента
        db.session.delete(student)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Студент и все его работы удалены'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

# ЗАПУСК СЕРВЕРА
if __name__ == '__main__':
    with app.app_context():
        # Создаем таблицы в базе данных
        db.create_all()
        # Заполняем тестовыми данными
        create_test_data()
    
    print("🚀 Сервер учебного полигона ИБ запущен!")
    print("📖 Откройте: http://localhost:5000")
    print("👤 Студент: student / student123")
    print("👨‍🏫 Преподаватель: teacher / teacher123")
    print("💾 База данных: cyber_range.db")
    print("🔧 Готовы к работе!")
    
    app.run(debug=True, host='0.0.0.0', port=5000)

    

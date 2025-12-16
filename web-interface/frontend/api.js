// api.js - общие функции для работы с API
class ApiService {
    constructor() {
        this.baseUrl = ''; // Тот же домен, так как сервер отдает и фронтенд и API
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            credentials: 'include', // Важно для кук и сессий
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Аутентификация
    async login(username, password) {
        return this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
    }

    async logout() {
        return this.request('/api/logout', {
            method: 'POST',
        });
    }

    async checkAuth() {
        return this.request('/api/check-auth');
    }

    // Лабораторные работы
    async getLabs() {
        return this.request('/api/labs');
    }

    async getLabDetails(labId) {
        return this.request(`/api/labs/${labId}`);
    }

    // Виртуальные машины
    async getVMStatus() {
        return this.request('/api/vm/status');
    }

    async startVM() {
        return this.request('/api/vm/start', {
            method: 'POST',
        });
    }

    async stopVM() {
        return this.request('/api/vm/stop', {
            method: 'POST',
        });
    }

    // Сдача работ
    async submitLab(labId, solution, files = []) {
        return this.request('/api/submit', {
            method: 'POST',
            body: JSON.stringify({
                lab_id: labId,
                solution,
                files,
            }),
        });
    }

    // Преподавательские функции
    async getSubmissions() {
        return this.request('/api/teacher/submissions');
    }

    async getStudents() {
        return this.request('/api/teacher/students');
    }

    async gradeSubmission(submissionId, score, feedback = '') {
        return this.request('/api/teacher/grade', {
            method: 'POST',
            body: JSON.stringify({
                submission_id: submissionId,
                score,
                feedback,
            }),
        });
    }
}

// Создаем глобальный экземпляр API
window.apiService = new ApiService();
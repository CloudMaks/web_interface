import os

class Config:
    SECRET_KEY = 'student-secret-key-123'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///cyber_range.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

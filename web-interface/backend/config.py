import os

class Config:
    SECRET_KEY = 'cyber-polygon-secret-key-2024'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///cyber_range.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

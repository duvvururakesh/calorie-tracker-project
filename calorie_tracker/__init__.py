from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_cors import CORS
from config import Config
import os

db = SQLAlchemy()
login_manager = LoginManager()
migrate = Migrate()

REACT_BUILD = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')

def create_app():
    app = Flask(
        __name__,
        static_folder=REACT_BUILD,
        static_url_path='',
    )

    app.config.from_object(Config)

    CORS(app, supports_credentials=True, origins=['http://localhost:3000'])
    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)

    # Register only the API blueprint
    from .routes.api_routes import api_bp
    app.register_blueprint(api_bp)

    # Serve React build for all non-API routes
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        file_path = os.path.join(REACT_BUILD, path)
        if path and os.path.exists(file_path):
            return send_from_directory(REACT_BUILD, path)
        return send_from_directory(REACT_BUILD, 'index.html')

    with app.app_context():
        db.create_all()

    return app

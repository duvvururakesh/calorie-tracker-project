from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from config import Config
import os
from datetime import date

db = SQLAlchemy()
login_manager = LoginManager()
migrate = Migrate()

def create_app():
    # 👇 This ensures Flask knows templates & static live inside calorie_tracker/
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(__file__), 'templates'),
        static_folder=os.path.join(os.path.dirname(__file__), 'static')
    )

    # ✅ Load your config (needed before initializing extensions)
    app.config.from_object(Config)

    # ✅ Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)
    login_manager.login_view = 'auth.login'

    # ✅ Register blueprints
    from .routes import register_blueprints
    register_blueprints(app)

    # ✅ Add date for templates
    @app.context_processor
    def inject_date():
        return {'date': date}

    with app.app_context():
        db.create_all()

    return app

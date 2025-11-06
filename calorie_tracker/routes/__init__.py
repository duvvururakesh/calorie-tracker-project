from .auth_routes import auth_bp
from .main_routes import main_bp
from .log_routes import log_bp
from .profile_routes import profile_bp
from .api_routes import api_bp

def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(log_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(api_bp)

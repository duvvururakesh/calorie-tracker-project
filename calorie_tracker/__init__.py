from flask import Flask, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_cors import CORS
from config import Config
import os
import gzip

db = SQLAlchemy()
login_manager = LoginManager()
migrate = Migrate()

REACT_BUILD = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, supports_credentials=True, origins=['http://localhost:3000'])

    @app.after_request
    def gzip_text_responses(response):
        if (
            'gzip' not in request.headers.get('Accept-Encoding', '').lower()
            or response.status_code < 200
            or response.status_code >= 300
            or response.headers.get('Content-Encoding')
        ):
            return response

        content_type = response.headers.get('Content-Type', '')
        compressible = (
            content_type.startswith('text/')
            or 'javascript' in content_type
            or 'json' in content_type
            or 'xml' in content_type
            or 'svg' in content_type
        )
        if not compressible:
            return response

        if response.direct_passthrough:
            response.direct_passthrough = False

        body = response.get_data()
        if len(body) < 1024:
            return response

        compressed = gzip.compress(body)
        response.set_data(compressed)
        response.headers['Content-Encoding'] = 'gzip'
        response.headers['Content-Length'] = str(len(compressed))
        response.headers['Vary'] = 'Accept-Encoding'
        return response

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

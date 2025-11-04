from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv

from .config import configure_app, db
migrate = Migrate()


def create_app():
    load_dotenv()
    app = Flask(__name__)

    configure_app(app)
    migrate.init_app(app, db)

    from .routes import api_bp

    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://127.0.0.1:5173"]}},
        supports_credentials=True,
    )

    with app.app_context():
        db.create_all()

    app.register_blueprint(api_bp)

    return app

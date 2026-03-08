import sys
sys.path.insert(0, "./server")
from app import create_app

try:
    app = create_app()
    with app.app_context():
        print("App initialized and context pushed successfully!")
except Exception as e:
    import traceback
    traceback.print_exc()

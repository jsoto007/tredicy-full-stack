import sys
sys.path.insert(0, "./server")
from app import create_app, db
from app.models import AdminAccount

app = create_app()
with app.app_context():
    admin = AdminAccount.query.first()
    if not admin:
        print("No admin found.")
        sys.exit(0)
    
    with app.test_client(user=admin) as client:
        # We need to simulate being logged in. We can just use the test client and session
        with client.session_transaction() as sess:
            sess['admin_id'] = admin.id
            
        response = client.get('/api/admin/appointments')
        print(f"Status: {response.status_code}")
        if response.status_code != 200:
            print(f"Data: {response.get_data(as_text=True)}")

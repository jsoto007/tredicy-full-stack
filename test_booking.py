import requests

url = "http://localhost:5000/api/reservations"
payload = {
    "contact_name": "Test User",
    "contact_email": "test@example.com",
    "contact_phone": "1234567890",
    "scheduled_start": "2026-03-09T10:00:00Z",
    "seating_preference": "back",
    "duration_minutes": 60,
    "id_front_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "id_back_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
}
response = requests.post(url, json=payload)
print(response.status_code, response.text)

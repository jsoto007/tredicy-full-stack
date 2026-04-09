import os
import glob

replacements = {
    # Models and Tables
    "TattooAppointment": "RestaurantReservation",
    "tattoo_appointments": "restaurant_reservations",
    "TattooCategory": "GalleryCategory",
    "tattoo_categories": "gallery_categories",
    
    # Columns / Attributes
    "tattoo_placement": "seating_preference",
    "tattoo_size": "party_size",
    "placement_notes": "special_requests",
    
    # Relationships & classes
    "AppointmentAsset": "ReservationAsset",
    "appointment_assets": "reservation_assets",
    "AppointmentPayment": "ReservationPayment",
    "appointment_payments": "reservation_payments",
    
    "assigned_appointments": "assigned_reservations",
    "appointments": "reservations",
    "appointment": "reservation",
    "Appointment": "Reservation",
    
    # Specific variables in code
    "tattoo": "restaurant",
    "Tattoo": "Restaurant",
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    new_content = content
    # Order matters slightly, but our keys are pretty distinct. 
    # Let's do a case sensitive replace for exact strings.
    for k, v in replacements.items():
        new_content = new_content.replace(k, v)
        
    # We also want to change party_size from db.String(120) to db.Integer in models.py
    if "models.py" in filepath:
        new_content = new_content.replace("party_size = db.Column(db.String(120))", "party_size = db.Column(db.Integer)")

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk("server/"):
    if "migrations/versions" in root or "__pycache__" in root:
        continue
    for file in files:
        if file.endswith(".py"):
            process_file(os.path.join(root, file))

# Also run against test files
for file in glob.glob("test_*.py"):
    process_file(file)

print("Done python script")

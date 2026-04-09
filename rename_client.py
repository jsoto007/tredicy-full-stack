import os
import glob

replacements = {
    # Data models in frontend
    "TattooAppointment": "RestaurantReservation",
    "tattoo_appointments": "restaurant_reservations",
    "TattooCategory": "GalleryCategory",
    "tattoo_categories": "gallery_categories",
    
    # Payload keys
    "tattoo_placement": "seating_preference",
    "tattoo_size": "party_size",
    "placement_notes": "special_requests",
    
    "AppointmentAsset": "ReservationAsset",
    
    # UI labels
    "tattoo": "restaurant",
    "Tattoo": "Restaurant",
    "Tattoos": "Restaurants",
    "tattoos": "restaurants",
    
    # Specific API endpoints
    "/api/appointments": "/api/reservations",
    "/api/guest-appointments": "/api/guest-reservations",
    
    # Appointments mapping
    "appointment": "reservation",
    "Appointment": "Reservation",
    "appointments": "reservations",
    "Appointments": "Reservations",
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    new_content = content
    # Order matters slightly, but our keys are pretty distinct. 
    # Let's do a case sensitive replace for exact strings.
    for k, v in replacements.items():
        new_content = new_content.replace(k, v)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk("client/src/"):
    for file in files:
        if file.endswith((".js", ".jsx", ".json")):
            process_file(os.path.join(root, file))

print("Done python script")

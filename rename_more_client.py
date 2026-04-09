import os
import glob

replacements = {
    "nail technician": "server",
    "nail service": "dining service",
    "nail services": "dining services",
    "Melodi Nails": "Tredici Social",
    "melodi nails": "tredici social",
    "nailsmelodi@gmail.com": "info@tredicisocial.com",
    "Nail service consent": "Dining service consent",
    "Nail Service Consent": "Dining Service Consent",
    "Nail reservation": "Table reservation",
    "nail art": "menu tasting",
    "Nail": "Table",
    "salon": "restaurant",
    "Salon": "Restaurant",
    "manicure, pedicure, acrylic, gel": "lunch, dinner, drinks, private events",
    "manicures, pedicures, gel services, acrylic services, nail art, shaping, cuticle care, and polish removal": "lunch, dinner, drinks, desserts, private events, and catering",
    "artificial nails, gel, acrylic, and polish are cosmetic services": "dining experiences are subjective",
    "natural nails or surrounding skin": "dietary restrictions"
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    new_content = content
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

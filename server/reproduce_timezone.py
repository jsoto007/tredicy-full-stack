
from datetime import datetime, timezone
from app.emails.booking_confirmation import _format_reservation_datetime

def test_formatting():
    # Create a UTC datetime: 2023-10-27 14:00:00 UTC
    # In NYC (EDT), this should be 2023-10-27 10:00:00
    dt_utc = datetime(2023, 10, 27, 14, 0, 0, tzinfo=timezone.utc)
    duration = 240 # 4 hours
    
    formatted = _format_reservation_datetime(dt_utc, duration_minutes=duration)
    print(f"UTC Input: {dt_utc}")
    print(f"Duration: {duration} mins")
    print(f"Formatted: {formatted}")
    
    # Expected: "Friday, October 27 2023 from 10:00 AM to 02:00 PM ET"
    
    # Test without duration
    formatted_no_duration = _format_reservation_datetime(dt_utc)
    print(f"Formatted (no duration): {formatted_no_duration}")
    # Expected: "Friday, October 27 2023 at 10:00 AM ET"
    
if __name__ == "__main__":
    test_formatting()

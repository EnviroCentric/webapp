import re
from typing import Optional

def validate_password(password: str) -> bool:
    """
    Validate password strength.
    Password must:
    - Be at least 8 characters long
    - Contain at least one uppercase letter
    - Contain at least one lowercase letter
    - Contain at least one number
    - Contain at least one special character
    """
    if len(password) < 8:
        return False
        
    if not re.search(r'[A-Z]', password):
        return False
        
    if not re.search(r'[a-z]', password):
        return False
        
    if not re.search(r'\d', password):
        return False
        
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False
        
    return True 

def validate_email(email: str) -> tuple[bool, Optional[str]]:
    """
    Validate email format and return (is_valid, error_message).
    Returns (True, None) if valid, (False, error_message) if invalid.
    """
    # Basic email format validation
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        return False, "Invalid email format"
    
    # Check for common disposable email domains
    disposable_domains = {
        'tempmail.com', 'throwawaymail.com', 'mailinator.com',
        'guerrillamail.com', 'sharklasers.com', 'yopmail.com',
        'temp-mail.org', 'fakeinbox.com', 'temp-mail.io'
    }
    domain = email.split('@')[1].lower()
    if domain in disposable_domains:
        return False, "Disposable email addresses are not allowed"
    
    return True, None 
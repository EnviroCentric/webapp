import asyncio
from getpass import getpass
from app.db.engine import get_connection
from app.services.users import UserService
from app.schemas.user import UserCreate

async def main():
    pool = await get_connection()
    service = UserService(pool)
    print("Create a new superuser:")
    email = input("Email: ")
    password = getpass("Password: ")
    first_name = input("First name: ")
    last_name = input("Last name: ")
    user_data = UserCreate(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        is_active=True,      # ignored, always True for superuser
        is_superuser=True    # ignored, always True for superuser
    )
    user = await service.create_superuser(user_data)
    print(f"Superuser created: {user.email}")

if __name__ == "__main__":
    asyncio.run(main()) 
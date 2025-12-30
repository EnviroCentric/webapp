"""
Configuration module for the EnviroCentric backend.

This module defines a single `Settings` class that derives from Pydantic's
`BaseSettings`.  All configuration for the backend is controlled via
environment variables loaded from a `.env` file.  Defining settings in one
place avoids duplication and makes it easy to see which variables are
required.  See `.env.example` for a sample configuration.
"""

from typing import List
# Pydantic v2 moved `BaseSettings` to the `pydantic_settings` package.  See
# https://docs.pydantic.dev/latest/migration/#basesettings-has-moved-to-pydantic-settings
try:
    from pydantic_settings import BaseSettings  # type: ignore
except ImportError:  # Fallback to pydantic v1 for compatibility
    from pydantic import BaseSettings  # type: ignore

from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from the environment.

    Attributes
    ----------
    API_V1_STR: str
        The API prefix used for all version 1 endpoints.
    JWT_SECRET_KEY: str
        Secret key used to sign access tokens.
    JWT_REFRESH_SECRET_KEY: str
        Secret key used to sign refresh tokens.
    JWT_ALGORITHM: str
        Algorithm used to encode JWT tokens. Defaults to ``HS256``.
    ACCESS_TOKEN_EXPIRE_MINUTES: int
        Number of minutes before an access token expires. Defaults to 30.
    REFRESH_TOKEN_EXPIRE_MINUTES: int
        Number of minutes before a refresh token expires. Defaults to 30
        days (43 200 minutes).
    ADMIN_CREATION_SECRET: str
        Secret used when bootstrapping an administrator account.
    POSTGRES_USER: str
        Username for the PostgreSQL database.
    POSTGRES_PASSWORD: str
        Password for the PostgreSQL database.
    POSTGRES_DB: str
        Database name.
    DATABASE_URL: str
        DSN string used by `asyncpg` to connect to the database.
    ALLOWED_ORIGINS: List[str]
        List of origins permitted for Cross‑Origin Resource Sharing.  The
        default allows any origin and should be restricted in production.
    BACKEND_PORT: int
        Port the FastAPI application will bind to.
    """

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "EnviroCentric"
    JWT_SECRET_KEY: str = Field(..., description="Secret key for signing access tokens")
    JWT_REFRESH_SECRET_KEY: str = Field(..., description="Secret key for signing refresh tokens")
    JWT_ALGORITHM: str = Field("HS256", description="JWT signing algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(30, description="Minutes until access token expires")
    REFRESH_TOKEN_EXPIRE_MINUTES: int = Field(43200, description="Minutes until refresh token expires (30 days)")
    ADMIN_CREATION_SECRET: str = Field(..., description="Secret for admin account creation")
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    DATABASE_URL: str
    ALLOWED_ORIGINS: List[str] = Field(["*"], description="CORS allowed origins")
    BACKEND_PORT: int = Field(8000, description="Port to bind the backend server")
    GOOGLE_MAPS_API_KEY: str = Field(..., description="Google Places API key for address autocomplete and validation")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def get_database_url(self) -> str:
        """Return the database connection string.

        This property is provided for backward compatibility with code that
        expects a ``get_database_url`` attribute on the settings object.  It
        simply returns the value of ``DATABASE_URL``.  If you need to
        construct the DSN from individual components or support a separate
        test database, update this property accordingly.
        """
        return self.DATABASE_URL


# Instantiate a global settings object that can be imported throughout the
# application.  This ensures that environment variables are read once and
# cached for reuse.
settings = Settings()
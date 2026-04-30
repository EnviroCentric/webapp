#!/usr/bin/env bash

# Wait for the database to be ready
echo "Waiting for database to be ready..."
while ! nc -z db 5432; do
  sleep 0.1
done
echo "Database is ready!"

# Run tests
echo "Running tests..."
pytest tests/ -v --cov=app --cov-report=term-missing

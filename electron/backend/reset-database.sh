#!/bin/bash
# Script to reset the database by deleting it
# The database will be recreated automatically when the server restarts

echo "Stopping backend server if running..."
pkill -f "nest start" || true

echo "Deleting database..."
rm -f data/sufra.sqlite
rm -f src/database/sufra.sqlite

echo "✅ Database deleted! Restart the backend server to create a fresh database."
echo "Run: cd backend && npm run start:dev"

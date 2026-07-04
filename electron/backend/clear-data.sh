#!/bin/bash
# Script to clear all data using the admin endpoint
# Make sure the backend server is running first

echo "Clearing all data..."
curl -X POST http://localhost:3333/admin/clear-all-data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  | jq .

echo "Done! All data has been cleared."

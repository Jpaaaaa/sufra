#!/bin/bash
# Script to clear reports data (all orders)
# Make sure the backend server is running first

echo "Clearing all reports data (orders)..."
echo ""
echo "Note: You need to be logged in as admin to use this endpoint."
echo "The endpoint is: POST http://localhost:3333/admin/clear-reports-data"
echo ""
echo "To use this script, you need to:"
echo "1. Get your auth token from the browser (localStorage.getItem('sufra_auth_token'))"
echo "2. Replace YOUR_TOKEN_HERE in the curl command below"
echo ""
echo "Or use this curl command (replace YOUR_TOKEN_HERE):"
echo ""
echo "curl -X POST http://localhost:3333/admin/clear-reports-data \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN_HERE'"
echo ""

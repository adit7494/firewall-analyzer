#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "==========================================================="
echo "  Deploying Firewall Audit Analyzer (Docker Production)    "
echo "==========================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null
then
    echo "[!] Docker is not installed. Please install Docker and Docker Compose first."
    echo "    Ubuntu installation command: sudo apt install docker.io docker-compose -y"
    exit 1
fi

echo "[*] Pulling latest changes (if any)..."
# git pull origin main # Uncomment if using git on the server

echo "[*] Building the Docker image (this may take a few minutes)..."
sudo docker-compose build --no-cache

echo "[*] Starting the application..."
sudo docker-compose up -d

echo "[*] Cleaning up old unused images to save disk space..."
sudo docker image prune -f

echo "==========================================================="
echo "  Deployment Complete! "
echo "  The application is now running on http://localhost:3000"
echo "  Check logs using: sudo docker-compose logs -f"
echo "==========================================================="

@echo off
echo Installing dependencies...
pip install flask --quiet
echo Starting todo server at http://localhost:5000
python server.py
pause

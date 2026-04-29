@echo off
cd /d %~dp0
pip install flask --quiet
start "" pythonw server.py

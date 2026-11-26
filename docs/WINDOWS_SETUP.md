# FlowForge AI — Windows Local Setup & Developer Guide

This guide walks you through setting up and running FlowForge AI on any Windows 10/11 computer using PowerShell.

---

## 1. Prerequisites

Before starting, ensure you have the following installed on Windows:

1. **Python 3.10 or higher** (Tested on Python 3.12)
   - Verify in PowerShell:
     ```powershell
     python --version
     ```
   - Ensure *"Add Python to PATH"* was selected during Python installation.
2. **Node.js 22.12 or newer** (required by the frontend tooling; tested on Node.js 22 and 24)
   - Verify in PowerShell:
     ```powershell
     node --version
     npm --version
     ```
3. **Google Gemini API Key**
   - Free API key available at: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)

---

## 2. Directory Structure

Open PowerShell and navigate to the project directory:

```powershell
cd path\to\flowforge-ai-final
```

Folder contents:
```
flowforge-ai-final/
├── frontend/          # React + TypeScript + Vite frontend
├── backend/           # FastAPI Python backend
├── docs/              # Comprehensive architectural & API documentation
├── .gitignore         # Configured git ignore rules
├── README.md          # Project overview
└── start-windows.ps1  # Optional convenience startup script
```

---

## 3. Backend Setup & Startup

Open your first PowerShell terminal window:

### Step 1: Navigate to `backend/`
```powershell
cd backend
```

### Step 2: Create a Python Virtual Environment
```powershell
python -m venv .venv
```

### Step 3: Activate the Virtual Environment
```powershell
.\.venv\Scripts\Activate.ps1
```
*(If PowerShell displays an `ExecutionPolicy` error, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` and retry).*

### Step 4: Install Dependencies
```powershell
pip install -r requirements.txt
```

### Step 5: Configure Environment Variables
```powershell
Copy-Item .env.example .env
```
Open `.env` in Notepad or your editor and set your Gemini API key:
```powershell
notepad .env
```
Inside `.env`, update:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### Step 6: Start the FastAPI Server
```powershell
uvicorn app.main:app --reload --port 8000
```

Verify backend health by opening [http://localhost:8000/api/health](http://localhost:8000/api/health) in your browser.  
Interactive Swagger API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 4. Frontend Setup & Startup

Open a second PowerShell terminal window:

### Step 1: Navigate to `frontend/`
```powershell
cd frontend
```

### Step 2: Install Node Packages
```powershell
npm install
```

### Step 3: Configure Environment Variables
```powershell
Copy-Item .env.example .env
```

### Step 4: Start the Vite Dev Server
```powershell
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your web browser.

---

## 5. Running Automated Backend Tests

To execute the automated backend test suite:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest -v
```

All tests should pass. (Use `pytest`: `python -m unittest discover` silently skips the retry and fallback tests.) These tests need no API key and no internet.

### Check your real Gemini connection

Still in `backend`, with the virtual environment active:

```powershell
python -m scripts.list_gemini_models         # models your key can use + a check of your .env
python -m scripts.smoke_test_gemini          # one tiny real request
python -m scripts.smoke_test_gemini --full   # a complete real blueprint
```

### Check the frontend

```powershell
cd ..\frontend
npm run typecheck
npm run lint
npm run test:pdf
```

`npm run test:pdf` builds sample PDFs, validates them, and prints the folder where it saved them so you can open and look at them.

---

## 6. Optional: One-Command Startup (`start-windows.ps1`)

From the root `flowforge-ai-final/` directory, you can optionally launch both frontend and backend simultaneously:

```powershell
.\start-windows.ps1
```

This launches the backend and frontend in two separate terminal windows automatically. It warns you if the API key is missing, and it starts the backend with the virtual environment's own `python.exe`, so it does not need `Activate.ps1`.

---

## 7. Troubleshooting

| Symptom | Cause | Solution |
| --- | --- | --- |
| `Activate.ps1 cannot be loaded because running scripts is disabled` | Windows PowerShell execution policy restriction. | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` in PowerShell, then activate again. |
| `AI_NOT_CONFIGURED` (503 error) | `GEMINI_API_KEY` was not configured in `backend/.env`. | Open `backend/.env` and insert a valid API key from Google AI Studio. |
| Port 8000 already in use | Another service is using port 8000. | Check running processes with `Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess`, or start the backend with a different `--port` and set `VITE_API_URL` in `frontend/.env` to match. |
| Network error when clicking "Generate" | Backend is not running or CORS origin mismatch. | Ensure the backend is active at `http://localhost:8000` and `ALLOWED_ORIGINS` in `backend/.env` contains your frontend port. |
| `AI_PROVIDER_UNAVAILABLE` (503) or `AI_TIMEOUT` (504) | Google's Gemini service is overloaded or slow. The app already retried and tried fallback models. | Wait a minute and generate again. Nothing in your project can fix Google's capacity. |
| `AI_AUTH_FAILED` (503) | Google rejected the API key (invalid, expired or restricted). | Create a new key at Google AI Studio, put it in `backend/.env`, and restart the backend. |
| `AI_MODEL_NOT_FOUND` (503) | `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS` name a model that does not exist for your key. | Run `python -m scripts.list_gemini_models` and copy valid names into `backend/.env`. |
| Changed `backend/.env` but nothing changed | `.env` is read when the backend starts. | Stop the backend (Ctrl+C) and start it again. |
| `?` appears in the PDF where a letter or emoji should be | The PDF uses built-in fonts that cover Western European text only. | Use the Markdown or JSON export for other scripts (Chinese, Arabic, emoji, ...). |

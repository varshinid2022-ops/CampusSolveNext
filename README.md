# CampusSolve Next.js Conversion

This folder converts the existing Streamlit CampusSolve project into a Next.js frontend and FastAPI backend. The original project remains unchanged.

## Structure

```text
CampusSolveNext/
  frontend/       Next.js 14 + React + TypeScript
  backend/        FastAPI + SQLite
  vercel.json
```

## Local development

Backend:

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
copy .env.local.example .env.local
npm.cmd install
npm.cmd run dev
```

Open <http://localhost:3000>.

The SQLite copy is in `backend/data/campussolve.db`. Keep it out of public folders. For a public deployment, use PostgreSQL or a persistent database provider and configure `CAMPUSSOLVE_DATABASE`.

## Vercel frontend deployment

1. Push this repository to GitHub.
2. In Vercel, create a new project and import the repository.
3. Set the project root directory to `CampusSolveNext/frontend`.
4. Set `NEXT_PUBLIC_API_URL` to the HTTPS URL of the deployed FastAPI backend.
5. Deploy.

The Next.js frontend requires a separately hosted Python/FastAPI backend. SQLite is not suitable for ephemeral or serverless-only hosting.

## Custom domain

1. Open the deployed Vercel project.
2. Open **Settings → Domains**.
3. Add the purchased domain.
4. Copy only the exact DNS records displayed by Vercel.
5. Add those records at the domain registrar.
6. Wait for DNS verification and HTTPS provisioning.

Do not reuse DNS values from another project or domain.

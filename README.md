# LSPU AI-Enhanced Gamified Student Portfolio Platform

A full-stack student portfolio and learning recommendation system for LSPU BSCS/BSIT students.

The system connects to GitHub, analyzes repositories, generates student skill insights, displays portfolio outputs, and provides a personalized learning roadmap. It also includes an admin console with student monitoring, evaluation metrics, and AI model evaluation results.

## Stack

- Frontend: React, TypeScript, Tailwind CSS, Vite, Recharts
- Backend: FastAPI, SQLAlchemy
- Database: Supabase PostgreSQL
- AI model: Fine-tuned Google FLAN-T5 Base
- Runtime recommendation support: Hybrid FLAN-T5 + rule-based learning path logic

## Main Features

### Student Side

- GitHub login and repository sync
- Student dashboard
- GitHub repository analysis
- Practice dimension detection
- Career direction suggestions
- Personalized learning roadmap
- Hybrid suggested learning resources
- Project validation submission
- Certificate upload and review
- Achievements, XP, badges, and leaderboard
- Public portfolio page

### Admin Side

- Admin dashboard
- Student list and student details
- Project validation review
- Certificate review
- Intervention plans and alerts
- Cohort comparison
- SUS evaluation page
- AI model metrics page
- Leaderboard monitoring

## AI Model and Evaluation

The system includes a locally integrated fine-tuned Google FLAN-T5 Base model:

```text
backend/models/final_flan_t5_github_recommender
```

The backend points to this model through:

```env
FLAN_T5_MODEL=models/final_flan_t5_github_recommender
MODEL_ALIAS=Fine-tuned FLAN-T5 GitHub Recommender
```

The trained model evaluation metrics are stored in:

```text
backend/evaluation/evaluation_metrics.csv
```

Displayed AI metrics include:

- ROUGE-1: unigram overlap between generated and reference summaries (higher is better).
- ROUGE-2: bigram overlap, stricter than ROUGE-1 for phrasing accuracy.
- ROUGE-L: longest common subsequence score, rewards correct ordering.
- BLEU: n-gram precision with brevity penalty for short outputs.
- BERTScore Precision: semantic overlap precision using contextual embeddings.
- BERTScore Recall: semantic overlap recall using contextual embeddings.
- BERTScore F1: balanced semantic similarity score.
- Dataset sizes: train/validation/test row counts for evaluation context.

Notes on interpretation:

- All scores are reported on held-out evaluation data.
- ROUGE and BLEU are lexical overlap metrics; BERTScore captures semantic similarity.
- Use F1 metrics for a single-score summary when comparing runs.

How to judge score quality:

- Treat "good" as relative: higher than your baseline or previous model is an improvement.
- Consistent gains across ROUGE, BLEU, and BERTScore are stronger evidence than one metric alone.
- Check a small human sample: if outputs read correctly and scores are higher, results are reliable.
- Consider dataset size: small test sets can inflate or deflate scores.

Admin AI metrics page:

- URL: /admin/ai-evaluation
- Data source: GET /admin/evaluation/metrics
- Backend loads the first row of backend/evaluation/evaluation_metrics.csv
- Fields returned: model name, dataset row counts, ROUGE, BLEU, and BERTScore metrics

Important scope:

- FLAN-T5 is the trained and evaluated AI model component.
- Learning Path uses a hybrid approach: FLAN-T5/model signals plus rule-based structure.
- Rule-based logic keeps the learning path stable and structured.
- Suggested resources use a hybrid curated-resource and dynamic-search approach.

## Project Structure

```text
backend/    FastAPI app, database models, services, routers, model files
frontend/   React/Vite student and admin UI
data/       Training dataset files used during model preparation
supabase/   Optional Supabase local/config files
```

## Environment Variables

### Backend

Create or update:

```text
backend/.env
```

Required values:

```env
APP_ENV=local
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
DATABASE_URL=postgresql://<supabase-user>:<password>@<supabase-host>:5432/postgres
DATABASE_SSLMODE=require
JWT_SECRET=change_me
JWT_ISSUER=devpath

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback

FLAN_T5_MODEL=models/final_flan_t5_github_recommender
MODEL_ALIAS=Fine-tuned FLAN-T5 GitHub Recommender

ADMIN_LOGIN_USERNAME=your_admin_username
ADMIN_LOGIN_PASSWORD=your_admin_password
```


Do not commit real secrets.

### Frontend

Create or update:

```text
frontend/.env
```

Required value:

```env
# Local dev:
VITE_API_BASE=http://localhost:8000

# Production:
# Set this to your deployed backend URL, or leave it empty only if the frontend and backend are served from the same origin.
```

## Local Setup

### 1. Backend

```powershell
cd C:\Users\Admin\Downloads\Thesis-main\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Run backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

### 2. Frontend

```powershell
cd C:\Users\Admin\Downloads\Thesis-main\frontend
npm install
npm run dev -- --host 127.0.0.1
```

Frontend URL:

```text
http://127.0.0.1:5173
```

## How To Open The System

Student side:

```text
http://127.0.0.1:5173
```

Admin login:

```text
http://127.0.0.1:5173/admin-login
```

AI metrics:

```text
http://127.0.0.1:5173/admin/ai-evaluation
```

Learning path:

```text
http://127.0.0.1:5173/learning-paths
```

## Common Port Fixes

If backend port `8000` is already used:

```powershell
netstat -ano | findstr :8000
taskkill /PID <PID_NUMBER> /F
```

Then run backend again:

```powershell
cd C:\Users\Admin\Downloads\Thesis-main\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

If frontend port `5173` is already used:

```powershell
netstat -ano | findstr :5173
taskkill /PID <PID_NUMBER> /F
```

Then run frontend again:

```powershell
cd C:\Users\Admin\Downloads\Thesis-main\frontend
npm run dev -- --host 127.0.0.1
```

## Useful Backend Endpoints

- GitHub login: `GET /auth/github/login`
- GitHub callback: `GET /auth/github/callback`
- Current user ping: `GET /api/ping`
- Owner portfolio: `GET /api/portfolio/me`
- Public portfolio: `GET /api/portfolio/{username}`
- Recompute insights: `POST /api/user/recompute`
- Learning path: `GET /api/learning-path/{username}`
- Project learning paths: `GET /api/learning-path/projects/{username}`
- Recommendations: `GET /api/recommendations/v2/{username}`
- Track recommendation action: `POST /api/recommendations/action`
- Admin evaluation metrics: `GET /admin/evaluation/metrics`

## Notes For Defense

Use this wording when explaining the model:

```text
The system integrates a fine-tuned Google FLAN-T5 Base model trained on GitHub-based student recommendation data. The model was evaluated using ROUGE, BLEU, and BERTScore. For real-time learning path rendering, the system uses a hybrid approach that combines model-derived signals with rule-based structure to keep the output stable and responsive.
```

## Build Checks

Frontend TypeScript check:

```powershell
cd frontend
npx tsc --noEmit
```

Frontend production build:

```powershell
cd frontend
npm run build
```

Backend syntax check example:

```powershell
cd backend
.\.venv\Scripts\python.exe -m py_compile app\services\inference.py
```

## License

Private academic project unless a license is added.
    

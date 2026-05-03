# Own Recovery — PRD

## Problem Statement (original)
Build a medical AI-inspired, human-in-the-loop behavioral health monitoring system for addiction recovery and mental health care. Must emphasize: Clinical relevance, Explainable AI (XAI), Risk prediction modeling, Human oversight, Ethical + privacy-first design. AI is a risk prediction assistant and pattern recognition tool — NOT a decision maker. A human always reviews; a human always acts.

## Architecture (as built)
- Frontend: React 19 + Tailwind + shadcn/ui + recharts (Instrument Serif + Inter + JetBrains Mono)
- Backend: FastAPI (modular routers) + Motor/MongoDB
- ML: scikit-learn logistic regression (secondary) + rule-based engine (primary)
- LLM: GPT-5.2 via Emergent Universal Key (weekly summaries), template fallback
- Auth: JWT in HttpOnly + Secure + SameSite=None cookies; bcrypt password hashing; RBAC enforced at API layer
- Theme: "AI Clinical Intelligence" — dark navy with teal (#0F766E) / cyan (#22D3EE) / indigo (#4F46E5) accents, glassmorphism cards

## User Personas
1. Recovery User — logs daily signals, sees risk + XAI explanations, controls privacy
2. Supporter — consent-gated view of loved one's shared signals; sends encouragement
3. Clinician (invite-code verified) — read-only anonymization-aware patient panel

## Core Requirements (static)
- Structured longitudinal health record: mood 1-10, craving 0-10, sleep hours, stress 1-10, triggers, notes
- Daily relapse risk score 0-100 with transparent, weighted, clinically-inspired rule-based engine
- XAI: every score decomposed by feature contribution (direction + magnitude)
- Logistic regression secondary model trained on synthetic data for comparison
- Pattern detection: 3-day stress ↑, declining sleep, escalating cravings
- Calm clinical alerts (low=no action, medium=coping, high=suggest supporter)
- Human-in-the-loop: AI suggests → human reviews → human acts
- Multi-role + consent-driven sharing + role-based access control
- Right-to-delete + CSV export
- Clinician accounts require invite-code verification (public signup cannot create one)

## What's Been Implemented (2026-05-03)

### Backend (FastAPI)
- `models.py` — User (with verified_clinician, verification_status), HealthEntry, RiskScore, FeatureContribution, Alert, Consent, SupporterLink, Encouragement, WeeklySummary, ClinicianInvite, OnboardingAnswers, Day1Plan
- `auth.py` — JWT + bcrypt + HttpOnly cookies (set/clear), hybrid cookie+bearer auth, Emergent Google OAuth verification, role dependency
- `risk_engine.py` — rule-based scoring with clinical weights, sklearn LogisticRegression (synthetic train), pattern detection, moving averages, XAI contributions
- `routes_auth.py` — signup/login/google/logout/me + clinician invite validation & single-use consumption
- `routes_health.py` — check-in (creates entry + risk + alert + pattern flags), entries, risk latest/series, alerts, acknowledge, compare models, delete all data, CSV export
- `routes_supporter.py` — invite, connections, view (consent-filtered), encourage, messages
- `routes_clinician.py` — patients (anonymized), detail, overview — all require verified_clinician=true
- `routes_consent.py` — GET/PATCH consent
- `routes_llm.py` — weekly summary via GPT-5.2 (Emergent Universal Key) with grounded prompt + template fallback
- `routes_insights.py` — AI observations, insight cards (% deltas), weekly forecast
- `routes_onboarding.py` — "I don't know where to start" 4-step guided flow → Day 1 plan + implicit check-in
- `seed.py` — 5 demo users, 30 days of synthetic data across improving/declining/stable trajectories, 2 clinician invite codes

### Frontend (React)
- Dark AI command center theme, glassmorphism, subtle gradients, pulse & shimmer animations, no emoji
- Pages: Landing, Login, Signup (with invite + onboarding toggle), Dashboard, CheckIn, Trends, WeeklySummary, Privacy, Supporter, Clinician, Onboarding (4-step)
- Components: Navbar (with Verified badge for clinicians), RiskGauge (SVG half-circle), XAIPanel, AlertCard, TrendChart, AIObservations, InsightCard
- Cookie-based auth via `withCredentials:true` axios + /auth/me boot
- Route guards by role; shadcn Toaster (dark)

## Testing
- 24/24 backend tests pass (auth/cookie, clinician invite lifecycle, check-in, XAI, alerts, CSV, summary, consent, supporter, clinician, onboarding, insights)
- Frontend smoke: landing, auth, dashboards for all 3 roles, trends, privacy, logout

## Demo Credentials (password `demo1234`)
- alex@demo.own (recovery, improving)
- jamie@demo.own (recovery, declining)
- morgan@demo.own (recovery, stable)
- sam@demo.own (supporter, linked to Alex+Jamie)
- drquinn@demo.own (clinician, verified)
- Invite codes: `CLINICIAN-DEMO-2026` (consumed during testing), `CLINICIAN-RESEARCH-01` (available)

## Backlog
### P1
- Refresh-token flow (currently JWT 7d lifetime)
- Admin UI to mint new clinician invite codes
- Real email notifications for supporter invites + high-risk alerts
- Relapse Recovery Mode (user's requested additional feature, UI tone shift on relapse log)
- Export PDF summary for clinician handoff
### P2
- Gemini/Claude alternative LLM providers + model selection
- Data anonymization pipeline for research dataset export
- Time-series forecasting model (Prophet/ARIMA) replacing heuristic forecast
- Audit log for clinician access (who viewed which patient when)
- Real HIPAA-compliant object-storage backend for attachments

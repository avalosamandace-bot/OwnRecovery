# Own Recovery
An explainable medical AI system designed to support addiction recovery through behavioral tracking, risk modeling, and real-time interventions.

---

## Live Demo (Preview)
https://behavioral-monitor.preview.emergentagent.com/  
*Note: This is a temporary preview link and may require login or expire.*

---

## Overview

Own Recovery is a full-stack application built to help individuals better understand and manage their recovery journey. The system combines behavioral data tracking with explainable AI to identify patterns associated with relapse risk and provide timely, supportive interventions.

The goal is not just to track progress, but to offer guidance during difficult moments while maintaining a strong focus on user privacy, clarity, and emotional safety.

---

## Features

### Recovery Tracking
- Tracks sobriety streaks (current and longest)
- Allows users to log relapses with optional notes
- Displays milestone progress (1, 7, 30, 90, 365 days)
- Includes a personal “Why I’m Sober” reflection

### Risk Detection & Insights
- Combines rule-based logic with a logistic regression model
- Provides a risk score along with a confidence level
- Breaks down contributing factors using explainable AI
- Identifies behavioral patterns related to sleep, stress, and cravings

### Intervention Tools
- Craving check-ins using a simple 1–10 scale
- Urge Surfing timer to help manage impulses
- “Play the Tape Forward” reflection tool
- Lightweight, actionable suggestions during high-risk periods

### Resource Hub
- Curated, verified recovery resources including:
  - Alcoholics Anonymous
  - SAMHSA National Helpline
  - 988 Crisis Lifeline
  - Educational materials from NIDA and NIAAA
- Designed to be reliable and easy to access in urgent situations

### Relapse Recovery Mode
- Activates after a relapse is logged
- Shifts tone to supportive and non-judgmental
- Provides a simple path forward and relevant resources

### Multi-Role System
- Recovery Users
- Supporters (with consent-based access)
- Clinicians (restricted onboarding)
- Admin tools for invite management and audit logging

### Privacy & Transparency
- Consent-based data sharing
- Visibility into who accessed user data
- Clear explanation of how risk scores are generated
- No automated decisions — designed to support, not replace, human care

### Clinician Tools
- Exportable summary reports including:
  - risk trends
  - recovery score
  - relapse history
  - behavioral insights

---

## Tech Stack

**Frontend**
- React
- Tailwind CSS
- shadcn/ui
- Recharts

**Backend**
- FastAPI (Python)
- scikit-learn
- JWT authentication (HttpOnly cookies)

**Database**
- MongoDB

---

## Modeling Approach

The system uses a hybrid approach:
- Rule-based scoring for transparency and control
- Logistic regression for pattern recognition
- Feature attribution to explain model outputs
- Confidence scoring based on data completeness

---

## Disclaimer

This application is intended as a support tool only.

- It does not provide medical diagnoses  
- Predictions are estimates based on self-reported data  
- It should not replace professional care  

---

## Motivation

This project was inspired by my father’s recovery journey.

It is built around the idea that meaningful recovery starts with ownership and self-awareness, and that technology should support that process in a way that is respectful, transparent, and grounded in real human needs.

---

## Running Locally

```bash

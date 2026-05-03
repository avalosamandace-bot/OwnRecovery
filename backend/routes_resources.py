"""Curated, verified resources for recovery support."""
from fastapi import APIRouter, Depends
from auth import get_current_user

router = APIRouter(prefix="/api/resources", tags=["resources"])

RESOURCES = [
    # CRISIS
    {"id": "988", "title": "988 Suicide & Crisis Lifeline", "category": "Crisis Support",
     "description": "Free, confidential, 24/7 support for people in distress. Call or text 988 in the US.",
     "link": "https://988lifeline.org", "crisis": True},
    {"id": "samhsa", "title": "SAMHSA National Helpline", "category": "Crisis Support",
     "description": "Free, confidential, 24/7, 365-day-a-year treatment referral and information service. 1-800-662-HELP (4357).",
     "link": "https://www.samhsa.gov/find-help/helplines/national-helpline", "crisis": True},
    # GETTING STARTED
    {"id": "niaaa-navigator", "title": "NIAAA Alcohol Treatment Navigator", "category": "Getting Started",
     "description": "A practical, evidence-based guide to finding quality treatment for alcohol use.",
     "link": "https://alcoholtreatment.niaaa.nih.gov", "crisis": False},
    {"id": "nida-treatment", "title": "NIDA — Treatment & Recovery", "category": "Getting Started",
     "description": "National Institute on Drug Abuse — what works, what to expect, and how to choose.",
     "link": "https://nida.nih.gov/research-topics/treatment", "crisis": False},
    # 12-STEP / AA
    {"id": "aa", "title": "Alcoholics Anonymous", "category": "12-Step Program",
     "description": "Worldwide fellowship for people recovering from alcohol use. Meetings are free.",
     "link": "https://www.aa.org", "crisis": False},
    {"id": "aa-twelve", "title": "The Twelve Steps", "category": "12-Step Program",
     "description": "The original twelve steps of AA — read directly from the source.",
     "link": "https://www.aa.org/the-twelve-steps", "crisis": False},
    {"id": "aa-find", "title": "Find an AA Meeting", "category": "12-Step Program",
     "description": "Locate in-person or online AA meetings near you.",
     "link": "https://www.aa.org/find-aa", "crisis": False},
    # MENTAL HEALTH
    {"id": "nami", "title": "NAMI — National Alliance on Mental Illness", "category": "Mental Health Support",
     "description": "Education, advocacy, and a peer-support helpline for people and families.",
     "link": "https://www.nami.org/help", "crisis": False},
    {"id": "mhanational", "title": "Mental Health America — Find Help", "category": "Mental Health Support",
     "description": "Tools, screenings, and local affiliate connections for mental health support.",
     "link": "https://mhanational.org/get-involved/find-affiliate", "crisis": False},
    # ADDICTION EDUCATION
    {"id": "nida-science", "title": "NIDA — Drugs, Brains, and Behavior: The Science of Addiction", "category": "Addiction Education",
     "description": "A clear, science-based explainer of how addiction changes the brain.",
     "link": "https://nida.nih.gov/publications/drugs-brains-behavior-science-addiction", "crisis": False},
    {"id": "niaaa-rethink", "title": "NIAAA — Rethinking Drinking", "category": "Addiction Education",
     "description": "Practical tools for evaluating drinking patterns and making changes.",
     "link": "https://www.rethinkingdrinking.niaaa.nih.gov", "crisis": False},
    # CRAVING SUPPORT
    {"id": "urge-surfing", "title": "Urge Surfing (Mindfulness-based)", "category": "Craving Support Tools",
     "description": "A short, evidence-based guide to riding out cravings without acting on them.",
     "link": "https://www.mindful.org/urge-surfing/", "crisis": False},
    {"id": "box-breathing", "title": "Box Breathing — 4-4-4-4", "category": "Craving Support Tools",
     "description": "A short grounding technique to lower acute stress and craving intensity.",
     "link": "https://www.healthline.com/health/box-breathing", "crisis": False},
    # BOOKS
    {"id": "book-bigbook", "title": "The Big Book (Alcoholics Anonymous)", "category": "Books",
     "description": "The original AA text, free to read online.",
     "link": "https://www.aa.org/the-big-book", "crisis": False},
]

CATEGORIES = [
    "Crisis Support",
    "Getting Started",
    "12-Step Program",
    "Mental Health Support",
    "Addiction Education",
    "Craving Support Tools",
    "Books",
]


@router.get("")
async def list_resources(user=Depends(get_current_user)):
    return {"categories": CATEGORIES, "resources": RESOURCES}

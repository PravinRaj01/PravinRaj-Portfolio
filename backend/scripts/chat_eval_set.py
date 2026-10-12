"""Questions for scripts/eval_chat_rag.py.

Built from the live content rather than hard-coded, so every question has an
entry it can actually be answered from: one or more questions per project and
per work experience (the answer is that entry), plus a few topical questions
(skills, education...) for the kinds of entry that exist in the index.

Rotating through a few phrasings per entry matters: a retriever that only
works for the exact words "Tell me about X" would look perfect on a single
template.
"""
from dataclasses import dataclass

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import Experience
from app.models.projects import Project
from app.services.evals import Expected

PROJECT_TEMPLATES = (
    "Tell me about the {title} project",
    "What technologies were used in {title}?",
    "What does {title} do?",
    "Can you give me an overview of {title}?",
)
EXPERIENCE_TEMPLATES = (
    "What was your role at {company}?",
    "Tell me about your time at {company}",
    "What did you do at {company}?",
)
# (question, kind of entry that should be retrieved, topic)
TOPICAL = (
    ("What programming languages and technologies do you know?", "skills", "skills"),
    ("What are your main technical skills?", "skills", "skills"),
    ("Where did you study?", "education", "education"),
    ("What is your educational background?", "education", "education"),
    ("Do you have any certifications?", "certification", "certifications"),
    ("What services do you offer?", "service", "services"),
    ("Tell me a little about yourself", "about", "about"),
)


@dataclass(frozen=True)
class EvalQuestion:
    question: str
    expected: list[Expected]
    topic: str  # "project" | "experience" | "skills" | ...

    def to_data(self) -> dict:
        return {
            "question": self.question,
            "topic": self.topic,
            "expected": [e.to_dict() for e in self.expected],
        }


async def build_questions(
    db: AsyncSession, mode: str, *, max_projects: int = 10, max_experiences: int = 4
) -> list[EvalQuestion]:
    questions: list[EvalQuestion] = []

    projects = (
        (
            await db.execute(
                select(Project)
                .where(Project.mode == mode, Project.is_active.is_(True), Project.description != "")
                .order_by(Project.order_index)
                .limit(max_projects)
            )
        )
        .scalars()
        .all()
    )
    for i, project in enumerate(projects):
        template = PROJECT_TEMPLATES[i % len(PROJECT_TEMPLATES)]
        questions.append(
            EvalQuestion(template.format(title=project.title), [Expected(title=project.title)], "project")
        )

    experiences = (
        (
            await db.execute(
                select(Experience)
                .where(Experience.mode == mode, Experience.description != "")
                .order_by(Experience.order_index)
                .limit(max_experiences)
            )
        )
        .scalars()
        .all()
    )
    for i, experience in enumerate(experiences):
        template = EXPERIENCE_TEMPLATES[i % len(EXPERIENCE_TEMPLATES)]
        # The chunk title is "<title> at <company>", so the company is the stable part.
        questions.append(
            EvalQuestion(template.format(company=experience.company), [Expected(title=experience.company)], "experience")
        )

    # Only ask about kinds of entry that exist for this mode in the index.
    present = {
        row[0]
        for row in (
            await db.execute(
                text("SELECT DISTINCT source_type FROM portfolio_chunks WHERE mode IN (:mode, 'both')"),
                {"mode": mode},
            )
        ).all()
    }
    for question, source_type, topic in TOPICAL:
        if source_type in present:
            questions.append(EvalQuestion(question, [Expected(source_type=source_type)], topic))

    return questions

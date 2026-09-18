# app/schemas/common.py — MIGRATION_PLAN.md §6
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict

Mode = Literal["professional", "creative"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ReorderItem(BaseModel):
    id: uuid.UUID
    order_index: int

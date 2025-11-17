# ia-engine/app/routers/meta.py
"""Catálogo / meta del IA Engine.

Este endpoint entrega:
- Lista de campañas válidas.
- Lista de clusters válidos.
- Mapeo campaña → clusters permitidos.
- Cualquier otra metadata que el frontend/backend usen
  para poblar dropdowns sin hardcodear catálogos.
"""

from fastapi import APIRouter

from app.utils.meta import get_meta

# El prefix "/ia" lo aplica main.py al incluir el router.
router = APIRouter(tags=["meta"])


@router.get("/meta")
def read_meta():
    """
    Devuelve meta estática (catálogo) del motor de IA.

    Pensado para que:
      - El backend Node no tenga que hardcodear campañas/clusters.
      - El frontend (Email Studio) pueda poblar selectores dinámicamente.
    """
    return get_meta()


__all__ = ["router"]

#!/usr/bin/env python3
"""
masterkey.py

Script multiplataforma (Mac / Windows / Linux) para preparar variables de entorno
y credenciales locales del proyecto "email-studio".

Uso:
- Windows:  py .\masterkey.py
- Mac/Linux:  python3 masterkey.py

Responsabilidades:
1) Detectar la raíz del repo buscando un directorio que contenga:
   - backend/
   - frontend/
   - ia-engine/

2) A partir de templates:
   - .env.example           -> .env
   - backend/.env.example   -> backend/.env
   - frontend/.env.example  -> frontend/.env
   - ia-engine/.env.example -> ia-engine/.env

   Sólo se crean si NO existen aún.
   Las líneas KEY=VALUE se sobreescriben si hay un valor disponible en:
   - masterkey.local.json ("env")
   - variables de entorno del sistema (os.environ)

3) Crear backend/.secrets/service-account.json si:
   - NO existe todavía
   - Y tenemos JSON válido vía:
       - env GCP_SERVICE_ACCOUNT_JSON (string JSON)
       - o bloque "service_account" en masterkey.local.json

   No se crean llaves dummy para evitar errores OpenSSL en GCP.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional, Tuple


# -----------------------------
# Utilidades de ruta / proyecto
# -----------------------------

def find_project_root(start: Optional[Path] = None) -> Path:
    """
    Busca hacia arriba un directorio que contenga backend/, frontend/ e ia-engine/.
    """
    if start is None:
        start = Path(__file__).resolve().parent

    for candidate in [start] + list(start.parents):
        if all((candidate / name).is_dir() for name in ("backend", "frontend", "ia-engine")):
            return candidate

    raise SystemExit(
        "[ERROR] No se encontró la raíz del proyecto.\n"
        "Asegúrate de que masterkey.py está dentro de la carpeta que contiene "
        "'backend/', 'frontend/' e 'ia-engine/'."
    )


# -----------------------------
# Carga de configuración local
# -----------------------------

def load_local_config(root: Path) -> Tuple[Dict[str, str], Optional[Dict[str, Any]]]:
    """
    Lee masterkey.local.json (si existe) y devuelve:
    - env_values: dict con claves -> valores para .env
    - service_account: dict JSON con la service account (o None)

    Formato esperado masterkey.local.json:
    {
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "GCP_PROJECT_ID": "mi-proyecto",
        "GCP_BUCKET_NAME": "mi-bucket",
        "VITE_GCS_BUCKET": "mi-bucket",
        "VITE_GCS_PREFIX": "dev",
        "SFMC_CLIENT_ID": "...",
        ...
      },
      "service_account": {
        ... JSON completo de la service account de GCP ...
      }
    }
    """
    cfg_path = root / "masterkey.local.json"
    if not cfg_path.exists():
        return {}, None

    try:
        data = json.loads(cfg_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SystemExit(f"[ERROR] masterkey.local.json inválido: {e}") from e

    env_values = data.get("env") or {}
    if not isinstance(env_values, dict):
        env_values = {}

    service_account = data.get("service_account")
    if service_account is not None and not isinstance(service_account, dict):
        raise SystemExit(
            "[ERROR] 'service_account' en masterkey.local.json debe ser un objeto JSON.")

    return env_values, service_account


def merge_env_sources(local_env: Dict[str, str]) -> Dict[str, str]:
    """
    Combina:
    - valores definidos en masterkey.local.json (env)
    - + variables de entorno del sistema (os.environ)

    Precedencia: variables de entorno del sistema sobrescriben local_env.
    """
    merged = dict(local_env or {})
    # os.environ puede tener muchas claves, sólo usaremos las que aparezcan
    # en los templates .env.example (filtrado se hace en el render).
    for k, v in os.environ.items():
        merged[k] = v
    return merged


# -----------------------------
# Manejo de templates .env
# -----------------------------

def render_env_from_template(template_path: Path, output_path: Path, values: Dict[str, str], root: Path) -> None:
    """
    Crea un archivo .env a partir de un .env.example.

    - Respeta comentarios y formato.
    - Sólo cambia líneas tipo KEY=VALUE si hay un valor disponible en `values`.
    - Si no hay valor, deja la línea del template tal cual.
    """
    if not template_path.exists():
        print(
            f"[WARN] No existe template {template_path.relative_to(root)}; se omite.")
        return

    if output_path.exists():
        print(
            f"[SKIP] {output_path.relative_to(root)} ya existe; no se modifica.")
        return

    lines = template_path.read_text(encoding="utf-8").splitlines()
    new_lines: list[str] = []

    for line in lines:
        raw = line
        stripped = raw.strip()

        # Línea vacía o comentario o sin "=" utilizable → se deja igual
        if not stripped or stripped.startswith("#") or "=" not in stripped.split("#", 1)[0]:
            new_lines.append(raw)
            continue

        # Separamos comentario final (si existe)
        if "#" in raw:
            before_comment, comment = raw.split("#", 1)
            comment = "#" + comment  # devolvemos el "#"
        else:
            before_comment, comment = raw, ""

        key_part, _, current_val = before_comment.partition("=")
        key = key_part.strip()

        if key in values and values[key] != "":
            new_val = values[key]
            new_line = f"{key}={new_val}"
            if comment.strip():
                new_line += f"  {comment.strip()}"
            new_lines.append(new_line)
        else:
            # Sin valor para esta key, dejamos la línea tal cual
            new_lines.append(raw)

    output_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    print(f"[OK] Generado {output_path.relative_to(root)}")


def ensure_env_files(root: Path, values: Dict[str, str]) -> None:
    """
    Genera los .env a partir de sus .env.example si no existen.
    """
    env_pairs = [
        (root / ".env.example", root / ".env"),
        (root / "backend" / ".env.example", root / "backend" / ".env"),
        (root / "frontend" / ".env.example", root / "frontend" / ".env"),
        (root / "ia-engine" / ".env.example", root / "ia-engine" / ".env"),
    ]

    for template, target in env_pairs:
        render_env_from_template(template, target, values, root)


# -----------------------------
# Service Account de GCP
# -----------------------------

def ensure_service_account(root: Path, local_sa: Optional[Dict[str, Any]]) -> None:
    """
    Crea backend/.secrets/service-account.json si:

    - NO existe todavía.
    - Tenemos JSON válido desde:
        - env GCP_SERVICE_ACCOUNT_JSON (string JSON)
        - o parámetro local_sa (dict) proveniente de masterkey.local.json
    """
    target = root / "backend" / ".secrets" / "service-account.json"

    if target.exists():
        print("[SKIP] backend/.secrets/service-account.json ya existe; no se modifica.")
        return

    # 1) Intentar desde variable de entorno GCP_SERVICE_ACCOUNT_JSON
    sa_data: Optional[Dict[str, Any]] = None
    env_sa = os.environ.get("GCP_SERVICE_ACCOUNT_JSON")
    if env_sa:
        try:
            sa_data = json.loads(env_sa)
            print("[INFO] Usando GCP_SERVICE_ACCOUNT_JSON desde variables de entorno.")
        except json.JSONDecodeError as e:
            raise SystemExit(
                f"[ERROR] GCP_SERVICE_ACCOUNT_JSON no es un JSON válido: {e}") from e

    # 2) Si no vino del entorno, usamos masterkey.local.json
    if sa_data is None and local_sa is not None:
        sa_data = local_sa
        print("[INFO] Usando 'service_account' desde masterkey.local.json.")

    if sa_data is None:
        print(
            "[WARN] No se encontró configuración de service account.\n"
            " - Define GCP_SERVICE_ACCOUNT_JSON como JSON en tus variables de entorno, o\n"
            " - Completa 'service_account' en masterkey.local.json.\n"
            "Por seguridad, NO se creará un archivo dummy."
        )
        return

    # Validación mínima
    required_keys = {"type", "project_id", "private_key", "client_email"}
    if not required_keys.issubset(set(sa_data.keys())):
        raise SystemExit(
            "[ERROR] El JSON de service account no contiene todas las claves requeridas: "
            f"{required_keys}. Revísalo."
        )

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(sa_data, indent=2), encoding="utf-8")
    print("[OK] Generado backend/.secrets/service-account.json")


# -----------------------------
# main
# -----------------------------

def main() -> None:
    root = find_project_root()
    print(f"[INFO] Raíz del proyecto: {root}")

    local_env, local_sa = load_local_config(root)
    merged_env = merge_env_sources(local_env)

    print("[INFO] Generando archivos .env desde templates...")
    ensure_env_files(root, merged_env)

    print("[INFO] Generando service-account.json si corresponde...")
    ensure_service_account(root, local_sa)

    print("\n[LISTO] masterkey.py terminó. Revisa los .env generados y el archivo de service account.")


if __name__ == "__main__":
    main()

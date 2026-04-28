#!/usr/bin/env python3
"""
Arranca en paralelo analytics-engine e ingestion-service (cada uno con su .venv).

Esos microservicios existen solo para el pipeline Kaggle → MongoDB (descarga / normalización /
ingesta). No forman parte del servidor web ni del api-log-guard; el dashboard solo necesita el
gateway cuando lee datos ya guardados.

Uso (desde la raíz del repo):
  python3 scripts/run_logguard_workers.py

Requisitos:
  - .env en la raíz con MONGODB_URL, RABBITMQ_URL, KAGGLE_*, etc.
  - venvs ya creados y con dependencias instaladas en cada servicio.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_env_file(path: Path, target: dict[str, str]) -> None:
    if not path.is_file():
        print(f"Error: no existe {path}", file=sys.stderr)
        sys.exit(1)
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if not key:
            continue
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        target[key] = val


def venv_python(service_dir: Path) -> Path:
    if sys.platform == "win32":
        return service_dir / ".venv" / "Scripts" / "python.exe"
    return service_dir / ".venv" / "bin" / "python"


def main() -> None:
    root = repo_root()
    env_path = root / ".env"
    extra: dict[str, str] = {}
    load_env_file(env_path, extra)
    env = os.environ.copy()
    env.update(extra)

    analytics_dir = root / "services" / "analytics-engine"
    ingestion_dir = root / "services" / "ingestion-service"
    py_a = venv_python(analytics_dir)
    py_i = venv_python(ingestion_dir)

    for label, p in (("analytics-engine", py_a), ("ingestion-service", py_i)):
        if not p.is_file():
            print(
                f"Error: no existe el intérprete del venv para {label}:\n  {p}\n"
                f"Crea el venv e instala deps, por ejemplo:\n"
                f"  cd {root / 'services' / label} && python3 -m venv .venv && "
                f"source .venv/bin/activate && python3 -m pip install -r requirements.txt",
                file=sys.stderr,
            )
            sys.exit(1)

    procs: list[tuple[str, subprocess.Popen[bytes]]] = []

    def terminate_all() -> None:
        for name, proc in procs:
            if proc.poll() is None:
                proc.terminate()
        deadline = time.monotonic() + 12.0
        for name, proc in procs:
            while proc.poll() is None and time.monotonic() < deadline:
                time.sleep(0.1)
            if proc.poll() is None:
                proc.kill()

    def handle_signal(_signum: int, _frame: object) -> None:
        print("\nDeteniendo workers…", file=sys.stderr)
        terminate_all()
        sys.exit(130)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    print("Iniciando analytics-engine…", file=sys.stderr)
    procs.append(
        (
            "analytics-engine",
            subprocess.Popen(
                [str(py_a), "-u", "main.py"],
                cwd=str(analytics_dir),
                env=env,
                stdout=sys.stdout,
                stderr=sys.stderr,
            ),
        )
    )
    time.sleep(2.0)

    print("Iniciando ingestion-service…", file=sys.stderr)
    procs.append(
        (
            "ingestion-service",
            subprocess.Popen(
                [str(py_i), "-u", "main.py"],
                cwd=str(ingestion_dir),
                env=env,
                stdout=sys.stdout,
                stderr=sys.stderr,
            ),
        )
    )

    # Si uno termina (error o exit), cortar el otro.
    while True:
        for name, proc in procs:
            code = proc.poll()
            if code is not None:
                print(f"\n{name} terminó (código {code}).", file=sys.stderr)
                terminate_all()
                sys.exit(code if code != 0 else 0)
        time.sleep(0.4)


if __name__ == "__main__":
    main()

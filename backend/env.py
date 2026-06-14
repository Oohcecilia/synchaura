import os
from pathlib import Path


def _parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}

    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if not key:
            continue

        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]

        values[key] = value

    return values


def load_local_env() -> None:
    backend_dir = Path(__file__).resolve().parent
    repo_root = backend_dir.parent
    candidate_files = [
        repo_root / ".env.local",
        backend_dir / ".env.local",
    ]

    loaded_from_files: set[str] = set()

    for env_file in candidate_files:
        for key, value in _parse_env_file(env_file).items():
            if key in os.environ and key not in loaded_from_files:
                continue
            os.environ[key] = value
            loaded_from_files.add(key)

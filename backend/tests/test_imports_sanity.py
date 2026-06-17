"""
Regression test for the requirements.txt slim-down (Feb 2026).
Ensures every package that the codebase imports is still installable
and importable. Run with: pytest backend/tests/test_imports_sanity.py
"""

import importlib

# Direct imports performed by the application code.
# If any of these go missing after a requirements edit, this test fails fast.
REQUIRED_PACKAGES = [
    # Web framework
    "fastapi",
    "uvicorn",
    "starlette",
    "multipart",            # python-multipart
    # Validation
    "pydantic",
    "email_validator",
    # MongoDB
    "motor",
    "pymongo",
    # Auth
    "jose",                 # python-jose
    "passlib",
    "bcrypt",
    # Config
    "dotenv",               # python-dotenv
    # Images & PDFs
    "PIL",                  # pillow
    "reportlab",
    # HTTP
    "requests",
    # Payments
    "razorpay",
    # Email
    "resend",
    # Web push
    "pywebpush",
    "py_vapid",
    # Rate limiting
    "slowapi",
    # Tests
    "pytest",
]

# Packages that MUST NOT be installed (the cleanup explicitly removed them).
FORBIDDEN_PACKAGES = [
    "emergentintegrations",
    "litellm",
    "openai",
    "google.generativeai",
    "boto3",
    "stripe",
    "pandas",
    "numpy",
    "tiktoken",
    "huggingface_hub",
]


def test_required_packages_importable():
    """Every package the app actually uses must be importable."""
    missing = []
    for pkg in REQUIRED_PACKAGES:
        try:
            importlib.import_module(pkg)
        except ImportError as exc:
            missing.append(f"{pkg} ({exc})")
    assert not missing, f"Required packages missing: {missing}"


def test_forbidden_packages_absent_from_requirements_file():
    """Removed packages must not be reintroduced to requirements.txt."""
    import os
    req_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "requirements.txt",
    )
    with open(req_path) as f:
        text = f.read().lower()
    leaked = []
    for pkg in FORBIDDEN_PACKAGES:
        # Match both 'openai==x' and 'openai\n' patterns; ignore comments.
        normalized = pkg.replace(".", "-")
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            name = line.split("==")[0].split(">=")[0].split("<=")[0].split("[")[0].strip()
            if name == normalized or name == pkg:
                leaked.append(line)
    assert not leaked, (
        f"These packages were removed from requirements.txt and must not "
        f"be reintroduced without review: {leaked}"
    )


def test_server_module_imports():
    """The FastAPI server module must import without missing-dep errors."""
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import server  # noqa: F401

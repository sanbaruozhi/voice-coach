#!/usr/bin/env python3
"""Fail when tracked files contain likely personal data or credentials."""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEXT_LIMIT = 8 * 1024 * 1024
ALLOWED_EMAILS = {
    "noreply@github.com",
}
ALLOWED_EMAIL_DOMAINS = {
    "example.com",
    "example.org",
    "example.net",
    "users.noreply.github.com",
}
ALLOWED_HOME_USERS = {"runner", "build", "builder", "ci", "root"}
ALLOWED_REDDIT_USERS = {"your_username", "example", "placeholder"}


def tracked_files() -> list[Path]:
    output = subprocess.check_output(
        ["git", "-C", str(ROOT), "ls-files", "-z"], stderr=subprocess.DEVNULL
    )
    return [ROOT / item.decode("utf-8", "surrogateescape") for item in output.split(b"\0") if item]


def is_valid_cn_id(value: str) -> bool:
    if not re.fullmatch(r"[1-8]\d{16}[0-9Xx]", value):
        return False
    weights = (7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2)
    checks = "10X98765432"
    return checks[sum(int(n) * w for n, w in zip(value[:17], weights)) % 11] == value[-1].upper()


def add(findings: list[str], path: Path, line: int, category: str) -> None:
    findings.append(f"{path.relative_to(ROOT)}:{line}: {category}")


def main() -> int:
    findings: list[str] = []
    deny_terms = [
        item.strip().casefold()
        for item in re.split(r"[\n,]", os.environ.get("PRIVACY_DENY_TERMS", ""))
        if item.strip()
    ]

    sensitive_names = re.compile(
        r"(^|/)(?:\.env|id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:p12|pfx|mobileprovision|key|pem))$",
        re.IGNORECASE,
    )
    email_re = re.compile(r"(?i)(?<![\w.+-])([\w.+-]+@[a-z0-9.-]+\.[a-z]{2,})(?![\w.-])")
    home_re = re.compile(r"(?i)(?:/Users/|/home/|C:\\Users\\)([^/\\\s]+)[/\\]")
    phone_re = re.compile(r"(?<!\d)(1[3-9]\d{9})(?!\d)")
    cn_id_re = re.compile(r"(?<!\d)([1-8]\d{16}[0-9Xx])(?!\d)")
    secret_re = re.compile(
        r"(?i)(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|"
        r"sk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|"
        r"AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|"
        r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)"
    )
    team_re = re.compile(r"\b(?:DEVELOPMENT_TEAM|DevelopmentTeam)\s*=\s*[A-Z0-9]{10}\s*;")
    profile_re = re.compile(r"\bPROVISIONING_PROFILE(?:_SPECIFIER)?\s*=\s*[^;\s][^;]*;")
    reddit_re = re.compile(r"(?i)/u/([A-Za-z0-9_-]+)")
    udid_re = re.compile(r"(?i)(?<![0-9a-f])0000[0-9a-f]{4}-[0-9a-f]{16}(?![0-9a-f])")

    for path in tracked_files():
        relative = path.relative_to(ROOT).as_posix()
        if sensitive_names.search(relative) and not relative.endswith((".env.example", "example.env")):
            add(findings, path, 1, "sensitive file type is tracked")
        if "/xcuserdata/" in f"/{relative}" or relative.startswith("xcuserdata/"):
            add(findings, path, 1, "Xcode user data is tracked")
        try:
            data = path.read_bytes()
        except (OSError, ValueError):
            continue
        if len(data) > TEXT_LIMIT or b"\0" in data[:8192]:
            continue
        if relative == "scripts/privacy_scan.py":
            continue
        text = data.decode("utf-8", "replace")
        for line_no, line in enumerate(text.splitlines(), 1):
            folded = line.casefold()
            for term in deny_terms:
                if term and term in folded:
                    add(findings, path, line_no, "repository-specific private term")
            for match in email_re.finditer(line):
                email = match.group(1).casefold()
                domain = email.rsplit("@", 1)[1]
                if re.search(r"@\d+x\.(?:png|jpe?g)$", email):
                    continue
                if email not in ALLOWED_EMAILS and domain not in ALLOWED_EMAIL_DOMAINS:
                    add(findings, path, line_no, "non-placeholder email address")
            for match in home_re.finditer(line):
                if match.group(1).casefold() not in ALLOWED_HOME_USERS:
                    add(findings, path, line_no, "personal absolute home path")
            if phone_re.search(line):
                add(findings, path, line_no, "possible mainland China mobile number")
            for match in cn_id_re.finditer(line):
                if is_valid_cn_id(match.group(1)):
                    add(findings, path, line_no, "possible mainland China identity number")
            if secret_re.search(line):
                add(findings, path, line_no, "credential or private key")
            if team_re.search(line):
                add(findings, path, line_no, "hard-coded Apple development team")
            if profile_re.search(line):
                add(findings, path, line_no, "hard-coded provisioning profile")
            for match in reddit_re.finditer(line):
                if match.group(1).casefold() not in ALLOWED_REDDIT_USERS:
                    add(findings, path, line_no, "hard-coded Reddit account")
            if udid_re.search(line):
                add(findings, path, line_no, "possible device identifier")

    unique = sorted(set(findings))
    if unique:
        print("Privacy scan failed:", file=sys.stderr)
        for finding in unique:
            print(f"- {finding}", file=sys.stderr)
        return 1
    print(f"Privacy scan passed ({len(tracked_files())} tracked files checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

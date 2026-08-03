#!/usr/bin/env python3
"""Scan tracked content and reachable Git history for privacy leaks."""

from __future__ import annotations

import argparse
import io
import os
import re
import subprocess
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAX_BLOB_BYTES = 100 * 1024 * 1024
ALLOWED_EMAILS = {"noreply@github.com"}
ALLOWED_EMAIL_DOMAINS = {
    "example.com",
    "example.org",
    "example.net",
    "trufo.ai",
    "users.noreply.github.com",
}
ALLOWED_HOME_USERS = {"runner", "build", "builder", "ci", "root"}
ALLOWED_REDDIT_USERS = {"your_username", "example", "placeholder"}
ALLOWED_GIT_NAMES = {
    "sanbaruozhi",
    "github-actions[bot]",
    "dependabot[bot]",
}


@dataclass(frozen=True)
class Candidate:
    label: str
    path: str
    data: bytes


def git(*args: str, input_data: bytes | None = None) -> bytes:
    return subprocess.check_output(
        ["git", "-C", str(ROOT), *args], input=input_data, stderr=subprocess.DEVNULL
    )


def split_z(data: bytes) -> list[str]:
    return [item.decode("utf-8", "surrogateescape") for item in data.split(b"\0") if item]


def worktree_candidates(staged: bool) -> list[Candidate]:
    candidates: list[Candidate] = []
    for relative in split_z(git("ls-files", "--cached", "-z")):
        if staged:
            try:
                data = git("show", f":{relative}")
            except subprocess.CalledProcessError:
                continue
        else:
            try:
                data = (ROOT / relative).read_bytes()
            except (OSError, ValueError):
                continue
        candidates.append(Candidate("working tree" if not staged else "index", relative, data))
    return candidates


def history_candidates() -> tuple[list[Candidate], list[tuple[str, bytes]]]:
    candidates: list[Candidate] = []
    commits: list[tuple[str, bytes]] = []
    seen_blob_paths: set[tuple[str, str]] = set()
    revisions = git("rev-list", "--all").decode("ascii").splitlines()
    for revision in revisions:
        commits.append((revision, git("cat-file", "commit", revision)))
        tree = git("ls-tree", "-r", "-z", "--full-tree", revision)
        for entry in tree.split(b"\0"):
            if not entry:
                continue
            metadata, raw_path = entry.split(b"\t", 1)
            mode, kind, oid = metadata.decode("ascii").split()
            relative = raw_path.decode("utf-8", "surrogateescape")
            identity = (oid, relative)
            if kind != "blob" or identity in seen_blob_paths:
                continue
            seen_blob_paths.add(identity)
            size = int(git("cat-file", "-s", oid))
            if size > MAX_BLOB_BYTES:
                candidates.append(Candidate(f"history {revision[:12]}", relative, b""))
                continue
            candidates.append(Candidate(f"history {revision[:12]}", relative, git("cat-file", "blob", oid)))
    return candidates, commits


def is_valid_cn_id(value: str) -> bool:
    if not re.fullmatch(r"[1-8]\d{16}[0-9Xx]", value):
        return False
    weights = (7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2)
    checks = "10X98765432"
    return checks[sum(int(n) * w for n, w in zip(value[:17], weights)) % 11] == value[-1].upper()


def add(findings: list[str], candidate: Candidate, location: str, category: str) -> None:
    findings.append(f"{candidate.label}: {candidate.path}{location}: {category}")


def decoded_views(data: bytes) -> list[str]:
    sample = data[:8192]
    binary_magic = (
        b"\x89PNG\r\n\x1a\n",
        b"\xff\xd8\xff",
        b"GIF87a",
        b"GIF89a",
        b"PK\x03\x04",
        b"\xca\xfe\xba\xbe",
        b"\xcf\xfa\xed\xfe",
        b"\xfe\xed\xfa\xcf",
        b"\xce\xfa\xed\xfe",
        b"\xfe\xed\xfa\xce",
        b"SQLite format 3\x00",
    )
    try:
        sample.decode("utf-8")
        invalid_utf8 = False
    except UnicodeDecodeError:
        invalid_utf8 = True
    controls = sum(byte < 9 or 13 < byte < 32 for byte in sample)
    is_binary = (
        data.startswith(binary_magic)
        or (len(data) > 12 and data[4:8] == b"ftyp")
        or b"\0" in sample
        or invalid_utf8
        or (sample and controls / len(sample) > 0.02)
    )
    if is_binary:
        printable = b"\n".join(re.findall(rb"[\x20-\x7e]{6,}", data))
        views = [printable.decode("ascii", "ignore")]
        for encoding in ("utf-16-le", "utf-16-be"):
            try:
                views.append(data.decode(encoding, "ignore"))
            except UnicodeError:
                pass
        return views
    return [data.decode("utf-8", "replace")]


def embedded_archive_candidates(candidate: Candidate) -> list[Candidate]:
    if not zipfile.is_zipfile(io.BytesIO(candidate.data)):
        return []
    embedded: list[Candidate] = []
    total = 0
    try:
        with zipfile.ZipFile(io.BytesIO(candidate.data)) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                total += info.file_size
                if info.file_size > MAX_BLOB_BYTES or total > MAX_BLOB_BYTES:
                    embedded.append(
                        Candidate(f"{candidate.label} archive-limit", f"{candidate.path}!{info.filename}", b"")
                    )
                    break
                embedded.append(
                    Candidate(candidate.label, f"{candidate.path}!{info.filename}", archive.read(info))
                )
    except (OSError, RuntimeError, zipfile.BadZipFile):
        return []
    return embedded


def scan_candidate(candidate: Candidate, deny_terms: list[str], findings: list[str]) -> None:
    relative = candidate.path.replace("\\", "/")
    folded_path = relative.casefold()
    sensitive_names = re.compile(
        r"(^|/)(?:\.env(?:\..+)?|\.npmrc|\.pypirc|\.netrc|credentials(?:\.[^/]*)?|"
        r"service[-_]?account(?:\.[^/]*)?|google-services\.json|GoogleService-Info\.plist|"
        r"id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:p12|pfx|mobileprovision|provisionprofile|"
        r"keystore|jks|key|pem|sqlite(?:3)?|db|realm|log))$",
        re.IGNORECASE,
    )
    if sensitive_names.search(relative) and not relative.endswith((".env.example", "example.env")):
        add(findings, candidate, "", "sensitive file type is tracked")
    if "/xcuserdata/" in f"/{relative}" or relative.startswith("xcuserdata/"):
        add(findings, candidate, "", "Xcode user data is tracked")
    for term in deny_terms:
        if term in folded_path:
            add(findings, candidate, "", "repository-specific private term in path")
    if not candidate.data and candidate.label.endswith("archive-limit"):
        add(findings, candidate, "", "archive expansion exceeds 100 MiB and was not inspected")
        return
    if not candidate.data and candidate.label.startswith("history "):
        add(findings, candidate, "", "historical blob exceeds 100 MiB and was not inspected")
        return

    email_re = re.compile(r"(?i)(?<![\w.+-])([\w.+-]+@[a-z0-9.-]+\.[a-z]{2,})(?![\w.-])")
    home_re = re.compile(r"(?i)(?:/Users/|/home/|C:\\Users\\)([^/\\\s\x00]+)[/\\]")
    phone_re = re.compile(r"(?<!\d)(1[3-9]\d{9})(?!\d)")
    cn_id_re = re.compile(r"(?<!\d)([1-8]\d{16}[0-9Xx])(?!\d)")
    secret_re = re.compile(
        r"(?i)(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|"
        r"sk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|"
        r"AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|"
        r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|"
        r"https://hooks\.slack\.com/services/[A-Za-z0-9/_-]{20,})"
    )
    team_re = re.compile(r"\b(?:DEVELOPMENT_TEAM|DevelopmentTeam)\s*=\s*[A-Z0-9]{10}\s*;", re.I)
    profile_re = re.compile(r"\bPROVISIONING_PROFILE(?:_SPECIFIER)?\s*=\s*[^;\s][^;]*;", re.I)
    reddit_re = re.compile(r"(?i)(?:reddit\.com)?/u/([A-Za-z0-9_-]+)")
    udid_re = re.compile(r"(?i)(?<![0-9a-f])0000[0-9a-f]{4}-[0-9a-f]{16}(?![0-9a-f])")

    for view_index, text in enumerate(decoded_views(candidate.data)):
        for line_no, line in enumerate(text.splitlines(), 1):
            location = f":{line_no}" if view_index == 0 else f":decoded-{view_index}:{line_no}"
            folded = line.casefold()
            for term in deny_terms:
                if term and term in folded:
                    add(findings, candidate, location, "repository-specific private term")
            for match in email_re.finditer(line):
                email = match.group(1).casefold()
                local, domain = email.rsplit("@", 1)
                if re.search(r"@\d+x\.(?:png|jpe?g)$", email):
                    continue
                if len(local) < 2 or len(domain.split(".", 1)[0]) < 2:
                    continue
                if email not in ALLOWED_EMAILS and domain not in ALLOWED_EMAIL_DOMAINS:
                    add(findings, candidate, location, "non-placeholder email address")
            for match in home_re.finditer(line):
                if match.group(1).casefold() not in ALLOWED_HOME_USERS:
                    add(findings, candidate, location, "personal absolute home path")
            if phone_re.search(line):
                add(findings, candidate, location, "possible mainland China mobile number")
            for match in cn_id_re.finditer(line):
                if is_valid_cn_id(match.group(1)):
                    add(findings, candidate, location, "possible mainland China identity number")
            if secret_re.search(line):
                add(findings, candidate, location, "credential or private key")
            if team_re.search(line):
                add(findings, candidate, location, "hard-coded Apple development team")
            if profile_re.search(line):
                add(findings, candidate, location, "hard-coded provisioning profile")
            for match in reddit_re.finditer(line):
                if match.group(1).casefold() not in ALLOWED_REDDIT_USERS:
                    add(findings, candidate, location, "hard-coded Reddit account")
            if udid_re.search(line):
                add(findings, candidate, location, "possible Apple device identifier")


def scan_commits(commits: list[tuple[str, bytes]], deny_terms: list[str], findings: list[str]) -> None:
    identity_re = re.compile(rb"^(author|committer) (.+) <([^>]+)> (\d+) ([+-]\d{4})$", re.M)
    for revision, raw in commits:
        candidate = Candidate(f"commit {revision[:12]}", "metadata", raw)
        text = raw.decode("utf-8", "replace")
        folded = text.casefold()
        for term in deny_terms:
            if term and term in folded:
                add(findings, candidate, "", "repository-specific private term")
        for role, raw_name, raw_email, _timestamp, _timezone in identity_re.findall(raw):
            name = raw_name.decode("utf-8", "replace")
            email = raw_email.decode("utf-8", "replace").casefold()
            domain = email.rsplit("@", 1)[-1] if "@" in email else ""
            if email not in ALLOWED_EMAILS and domain not in ALLOWED_EMAIL_DOMAINS:
                add(findings, candidate, "", f"{role.decode()} uses a non-placeholder email")
            if name not in ALLOWED_GIT_NAMES and re.search(r"[\u3400-\u9fff]", name):
                add(findings, candidate, "", f"{role.decode()} may use a real name")


def check_local_identity(findings: list[str]) -> None:
    try:
        name = git("config", "--local", "--get", "user.name").decode().strip()
        email = git("config", "--local", "--get", "user.email").decode().strip().casefold()
    except subprocess.CalledProcessError:
        findings.append("local Git identity: repo-local safe identity is not configured")
        return
    domain = email.rsplit("@", 1)[-1] if "@" in email else ""
    if name not in ALLOWED_GIT_NAMES:
        findings.append("local Git identity: user.name is not an approved public handle")
    if email not in ALLOWED_EMAILS and domain not in ALLOWED_EMAIL_DOMAINS:
        findings.append("local Git identity: user.email is not a GitHub noreply address")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--staged", action="store_true", help="scan the Git index instead of working-tree bytes")
    parser.add_argument("--history", action="store_true", help="scan all reachable commits and blobs")
    parser.add_argument("--check-local-identity", action="store_true", help="require a repo-local public Git identity")
    args = parser.parse_args()

    deny_terms = [
        item.strip().casefold()
        for item in re.split(r"[\n,]", os.environ.get("PRIVACY_DENY_TERMS", ""))
        if len(item.strip()) >= 3
    ]
    findings: list[str] = []
    candidates = worktree_candidates(args.staged)
    commits: list[tuple[str, bytes]] = []
    if args.history:
        historical, commits = history_candidates()
        candidates.extend(historical)
    expanded: list[Candidate] = []
    for candidate in candidates:
        expanded.append(candidate)
        expanded.extend(embedded_archive_candidates(candidate))
    for candidate in expanded:
        if candidate.path == "scripts/privacy_scan.py":
            continue
        scan_candidate(candidate, deny_terms, findings)
    if commits:
        scan_commits(commits, deny_terms, findings)
    if args.check_local_identity:
        check_local_identity(findings)

    unique = sorted(set(findings))
    if unique:
        print("Privacy scan failed:", file=sys.stderr)
        for finding in unique:
            print(f"- {finding}", file=sys.stderr)
        return 1
    scopes = ["index" if args.staged else "working tree"]
    if args.history:
        scopes.append("reachable history")
    if args.check_local_identity:
        scopes.append("local Git identity")
    print(f"Privacy scan passed ({', '.join(scopes)}; {len(expanded)} file versions checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

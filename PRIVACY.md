# Public repository privacy policy

This repository is designed to remain safe if its visibility is changed to
public.

The repository must not contain personal email addresses, real names, phone or
identity numbers, home paths, device identifiers, signing-team identifiers,
provisioning profiles, service-account names, credentials, private keys,
private datasets, chat logs, or exported user content.

Machine-specific settings and credentials belong in ignored local files or
environment variables. Example configuration files may contain placeholders
only.

After cloning, install the repository-local Git identity and pre-commit guard:

```bash
./scripts/setup_privacy_guard.sh
```

Before changing repository visibility, run the full check explicitly:

```bash
python3 scripts/privacy_scan.py --history --check-local-identity
```

The pre-commit hook scans the exact staged snapshot. GitHub Actions scans the
current snapshot, all reachable commits and commit email addresses. A private
repository secret named
`PRIVACY_DENY_TERMS` may contain additional comma- or newline-separated terms
that must never appear in tracked paths, files or commit metadata.

Automated checks reduce risk but cannot understand every face, document or
screen visible inside an image or video. New media must also be inspected
visually and checked for EXIF/location metadata before it is committed.

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

Run the privacy check before publishing or pushing:

```bash
python3 scripts/privacy_scan.py
```

The same check runs in GitHub Actions. A private repository secret named
`PRIVACY_DENY_TERMS` may contain additional comma- or newline-separated terms
that must never appear in tracked files.

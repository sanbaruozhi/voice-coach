# Restore on another machine

1. Sign in to the GitHub account that can access this repository and clone it.
2. Run `python3 scripts/privacy_scan.py` to verify the checkout.
3. Follow the project `README.md` to install its documented toolchain and
   dependencies.
4. Supply credentials through environment variables, the operating-system
   keychain, or ignored local configuration files. Never commit them.

For Apple projects, the repository intentionally does not contain a personal
development-team identifier or provisioning profile. Open the project in
Xcode, choose the local Apple development team under Signing & Capabilities,
and let Xcode manage provisioning. The checked-in bundle namespace is public
and non-personal.

For an installation that must retain an older bundle identity or App Group,
apply those values only in an ignored local configuration before building.
Do not commit that local override.

The repository stores source code, not account credentials. A restore is
therefore reproducible without publishing personal configuration, but services
that require credentials will remain disabled until the owner supplies them
locally.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-09-26

### Added

- Comprehensive unit and integration test suites
- GitHub Actions CI/CD pipeline with CodeQL security scanning
- Automated dependency updates via Dependabot
- CodeQL security analysis
- Automated linting and formatting
- Reproducible package inventory, clean-install ESM import, and TypeScript declaration smoke verification.
- Forwarder JUnit evidence (`npm run test:forwarder:junit`) consumed by verdict-core acceptance gate G4.4.

### Changed

- Declared explicit npm package exports, shipped-file allowlist, Node engine floor, and publication metadata for the upcoming package release.
- Documented package-boundary publication evidence and npm install usage in the README.
- Declared Express as the middleware peer boundary and shipped its public TypeScript declarations as a runtime type dependency.
- Replaced long-lived npm publication credentials with a release-note-gated OIDC trusted-publishing workflow and a mandatory dry run.
- Depends on `@bodanglin/verdict-contracts` `^0.3.0` (Execution Envelope v1, `RoutingDecision.execution_envelope`).
- Fail-closed execution-envelope enforcement by default (`requireExecutionEnvelope` defaults to `true`).

### Fixed

- `createNextApiHandler` fail-open after Core 503 refusal (BOD-86).

## [0.1.0] - 2026-07-26

### Added

- Initial release

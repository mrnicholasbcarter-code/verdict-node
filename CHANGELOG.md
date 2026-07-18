# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive unit and integration test suites
- GitHub Actions CI/CD pipeline with CodeQL security scanning
- Automated dependency updates via Dependabot
- CodeQL security analysis
- Automated linting and formatting
- Reproducible package inventory, clean-install ESM import, and TypeScript declaration smoke verification.

### Changed

- Declared explicit npm package exports, shipped-file allowlist, Node engine floor, and publication metadata for the upcoming package release.
- Documented package-boundary publication evidence and npm install usage in the README.
- Declared Express as the middleware peer boundary and shipped its public TypeScript declarations as a runtime type dependency.
- Replaced long-lived npm publication credentials with a release-note-gated OIDC trusted-publishing workflow and a mandatory dry run.

## [0.1.0] - 2024-01-15

### Added

- Initial release

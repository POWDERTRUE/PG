# OMEGA V31 Changelog

All notable changes to this project will be documented in this file.

## v1.0.0-input-subsystem

Added:
- `InputPriorityStack` scheduler
- `InteractionModeController` subsystem
- `PG:HUD_MODE` kernel integration

Improved:
- Camera inertia transitions via native `UniverseNavigationSystem.js` auto-brake dispatch.
- TargetTracking jitter mitigation via specific pause dispatch.
- HUD pointer-event routing (semantic Z-Index locking and Mouse Escape).

Architecture:
- First cockpit-grade input arbitration layer, setting up foundation for Docking and Terminal mode integration.

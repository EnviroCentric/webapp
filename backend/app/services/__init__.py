"""Service package.

Services are intentionally imported from their concrete modules. Avoid eager
imports here so calculation/rendering utilities can run without initializing
database and authentication configuration.
"""

__all__ = []

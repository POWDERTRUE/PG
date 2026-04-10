#!/bin/sh
# .git/hooks/pre-commit — REGLA 8 Zero-GC Gate
# =============================================
# Bloquea commits si hay instanciación dinámica de objetos matemáticos
# dentro de funciones update() en archivos de fase physics/simulation.
#
# Instalación automática: npm run lint:gc:install
# Instalación manual: cp .git/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

echo "⚡ [Pre-commit] Validando REGLA 8 — Zero-GC Physics..."

node tools/zero-gc-lint.js --strict --silent
LINT_EXIT=$?

if [ $LINT_EXIT -ne 0 ]; then
    echo ""
    echo "❌ COMMIT BLOQUEADO — Violaciones de REGLA 8 detectadas."
    echo "   Ejecuta 'npm run lint:gc' para ver el detalle."
    echo "   Guía de corrección: UNIVERSE_LAWS.md#regla-8"
    echo ""
    exit 1
fi

echo "✅ REGLA 8: Zero-GC compliant. Commit autorizado."
exit 0

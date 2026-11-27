# Regla de Flujo de Trabajo del Proyecto (VidFlow)

1. **Commits atómicos (Conventional Commits):**
   - Cada cambio lógico o funcionalidad implementada debe guardarse en un commit atómico independiente (por ejemplo: `feat(browser): ...`, `fix(downloads): ...`, `chore(build): ...`).
   - No mezclar cambios no relacionados en un mismo commit.

2. **Subida continua a GitHub:**
   - Después de verificar los cambios (`npm run typecheck`, `npm run lint`, `npm test`), hacer `git push` a `origin` para mantener el repositorio remoto actualizado.

3. **Build portable tras cada cambio:**
   - Generar siempre el ejecutable portable sin instalador ejecutando `npm run build:portable` (`release/VidFlow 0.1.0.exe`) para poder probar cada cambio de inmediato.

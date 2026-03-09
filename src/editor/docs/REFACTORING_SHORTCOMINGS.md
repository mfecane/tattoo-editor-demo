# Refactoring Shortcomings (Editor Audit)

Scope: `frontend/editor`
Mode: report only (no behavioral changes in this pass)

## Confirmed Dead/Stale Candidates

- `frontend/editor/hooks/useImageUpload.ts` (`useImageUpload` definition-only)
- `frontend/editor/lib/geometries.ts` (`BentTubeGeometry` definition-only)
- `frontend/editor/main/environment/gradientSkybox.ts` (`createGradientSkybox` definition-only)

## Probable Refactor Gaps

- Reorder feature looks partially removed (commented panel + dead command path)
- `editorStore.designId` is set during load but has no active read path
- `viewSettingsStore` is marked deprecated but still consumed in active components

## Architecture Risks

- `registerEditorServices()` runs in component render path
- Dual RAF loops: `Editor.animate()` and `EditorController.animate()`
- `Project.setProjectData()` appends stamps without explicit clear
- per-stamp load errors are caught and continued (partial-load risk)

## Quick Verification Commands

```bash
rg -n "\buseImageUpload\b|\bBentTubeGeometry\b|\bcreateGradientSkybox\b" frontend/editor
rg -n "createReorderCommand\(|ReorderStampsCommand\(|createClearStampsCommand\(|ClearStampsCommand\(" frontend/editor
rg -n "^\s*//\s*(import|export)" frontend/editor/components/ImagesPanel.tsx
rg -n "useEditorStore\(\(state\) => state\.designId\)|setDesignId\(" frontend/editor
```

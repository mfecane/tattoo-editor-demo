# Baking Algorithm

How a `drapedPatch` (a regionMesh wrapped onto the body surface) gets turned into pixels on the
body's editable texture. Two separate pipelines cooperate:

- **PatchBaker** - expensive, per-patch, async, cached. Produces one patch's `bakedTarget`
  (`Piece.bakedTarget`).
- **BodyTextureComposer** - cheap, synchronous, cache-only. Composites all cached `bakedTarget`s
  onto the body's texture.

They're split so the body texture never goes stale/blank while a background bake is in flight,
and so composing never redoes the expensive search/rasterize work.

## When it runs

A bake is triggered only when the user leaves a dirty patch's edit context
(`EditorController.setSelectedPlacedMeshId`, on deselect) - never on every command. There's no
explicit bake button and no blocking spinner. `PlacedMeshList` marks a `drapedPatch` `bakeDirty`
whenever it's wrapped/edited; `PatchBaker.scheduleBake` is a no-op unless the entry is a dirty
`drapedPatch`.

Stale in-flight jobs are handled with a per-entry generation counter
(`PatchBaker.generationByEntry`): each `scheduleBake` call bumps the entry's generation and stamps
it on the request as `jobId`. If the entry goes dirty again (rescheduled) before a job resolves,
the older response's `jobId` no longer matches and is discarded silently in
`handleSearchResult`.

`EditorController.refreshBakeAndVisibility` runs after every command (select/deselect, history
execute/undo/redo). It keeps at most one wrapped patch "live" - the selected one, rendered as a
real mesh - and hides every other wrapped patch, relying on `BodyTextureComposer.compositeAll` to
paint their baked contribution into the body texture instead.

## Pipeline stage by stage

### 1. Request marshalling - `BakeRequestBuilder`

Pulls the plain typed-array + matrix payload a search algorithm needs out of live Three.js
objects - no GL context, no live mesh references cross into the search step. Snapshots:

- Body: `position`/`normal`/`uv` + index, restricted later to the tile-1001 editable material
  group (`groupRange`), plus `matrixWorld`.
- Patch: `position`/`uv` + index, plus `matrixWorld`.

Returns `null` if either geometry is missing required attributes (e.g. body has no editable
group) - `PatchBaker` treats that as "nothing to do".

### 2. UV search - `UVSearchAlgorithm` (`RaycastUVSearch`)

Goal: for every body vertex that could be covered by the patch, find the corresponding UV on the
patch's own sketch texture. Patch-centric, margin-expanded raycasting:

1. **Push** (`GeometryUtils.push`) - offsets the patch's local-space vertices outward along
   averaged vertex normals by `RAYCAST_UV_SEARCH_CONSTANTS.NORMAL_MARGIN` (0.02). Gives body
   vertices near the patch's silhouette, but just outside its raw footprint, something to hit.
2. **Grow boundary rim** (`GeometryUtils.growBoundaryEdges`) - adds one new rim vertex per
   boundary vertex, grown radially outward in both position and UV space by
   `RAYCAST_UV_SEARCH_CONSTANTS.BOUNDARY_GROWTH` (0.08), stitched to the boundary loop with new
   triangles. Extrapolates UVs past the patch's real edge so rays landing just past the boundary
   still resolve a source UV. Push and grow are independent steps (not a single bundled call).
3. Expanded patch positions are transformed to world space and built into a raycast target mesh
   (`DoubleSide`, since the patch's winding vs. the body's outward normal isn't guaranteed).
4. Every body vertex in the editable group is raycast from its world position along its world
   normal onto the expanded patch mesh. On a hit, the hit's barycentric coordinate against the
   expanded triangle is used to interpolate a source UV (`GeometryUtils.interpolateUv`) from the
   expanded patch's UVs.
5. Output is a new `BufferGeometry`: only body vertices that got a hit, only triangles whose 3
   vertices all got a hit. Carries body `position`/`normal`/`uv` plus `uv1` = the interpolated
   source UV on the patch. `coverage` = hit vertices / affected vertices.

A `Visual3dDebugger` can optionally be attached (`RaycastUVSearch.setDebugger`) to visualize the
expanded patch wireframe and every ray, color-coded hit/miss.

`UVSearchAlgorithm` is an interface specifically so the raycast approach can be swapped later
without touching `PatchBaker`/`BakeRequestBuilder`.

### 3. Rasterize - `FootprintRasterizer`

One GPU draw call that turns the search result into a texture: body UV (`uv`) becomes the
clip-space vertex position, `uv1` (source UV) is sampled from the patch's sketch texture in the
fragment shader. Renders into a `BAKE_RESOLUTION` (4096²) `WebGLRenderTarget`, cleared fully
transparent (alpha 0) so untouched pixels outside the patch's footprint stay transparent for
later compositing.

Result becomes `entry.bakedTarget`, cached until the patch goes dirty again
(`PlacedMeshList.setBakedLayer` / `markDirty`).

### 4. Composite - `BodyTextureComposer`

Synchronous, cache-only, runs after every command via `refreshBakeAndVisibility`. Starts from the
body's original editable texture and multiplies every non-excluded `drapedPatch`'s `bakedTarget`
over it in placement order, ping-ponging between two scratch render targets
(`compositeTargetA`/`B`). Each layer step (`renderMultiplyOver`) does straight (non-premultiplied)
alpha compositing:

```
outColor = mix(base.rgb, base.rgb * layer.rgb, layer.a)
outAlpha = layer.a + base.a * (1 - layer.a)
```

`excludeId` (the currently-selected patch) is skipped - it's still rendered live as a real mesh
instead, per `refreshBakeAndVisibility`. The final composited texture is assigned as the body's
editable material `map`.

## Why the split

- Search+rasterize (`PatchBaker`) is the expensive part (raycasting every affected body vertex,
  full-resolution GPU draw) - only worth redoing when a patch is actually dirty, so it's async and
  cached per patch.
- Composite (`BodyTextureComposer`) is cheap (a handful of full-screen shader passes over cached
  textures) - safe to rerun after every single command so the body never shows a stale texture.

## Key files

- `src/editor/services/BakeRequestBuilder.ts` - live Three.js objects → plain request payload.
- `src/editor/services/UVSearchAlgorithm.ts` - search interface + request/response shape.
- `src/editor/services/RaycastUVSearch.ts` - the raycast search implementation.
- `src/editor/services/GeometryUtils.ts` - `push`, `growBoundaryEdges`, `interpolateUv`.
- `src/editor/services/PatchBaker.ts` - orchestrates search → rasterize per dirty patch, generation-based stale-result guard.
- `src/editor/services/FootprintRasterizer.ts` - GPU draw: search result → `bakedTarget`.
- `src/editor/services/BodyTextureComposer.ts` - composites cached `bakedTarget`s onto the body texture.
- `src/editor/constants.ts` - `RAYCAST_UV_SEARCH_CONSTANTS`, `MESH_BAKE_CONSTANTS`.

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

### 2. UV search - `UVSearchAlgorithm` (`RaycastUVSearch` / `ClosestPointUVSearch`)

Goal: for every body vertex that could be covered by the patch, find the corresponding UV on the
patch's own sketch texture. Two interchangeable implementations, picked by
`MESH_BAKE_CONSTANTS.UV_SEARCH_ALGORITHM` in `PatchBaker`'s constructor - same
`UVSearchAlgorithm` contract, same expand-and-grow-boundary patch-centric approach, different core
query.

Both funnel their per-vertex results through the same shared pair (`UvSearchHit` /
`UvTransferResultBuilder`) rather than each building the output geometry itself:

- **`UvSearchHit`** - the common "uv transfer" unit: a hit patch triangle (resolved vertex
  indices) plus barycentric coordinates within it. Either algorithm produces a
  `Map<bodyVertexIndex, UvSearchHit>`.
- **`UvTransferResultBuilder`** - `collectAffectedRegion` scans `body.groupRange` once for its
  triangles/vertex indices (shared by both algorithms' setup); `buildUvTransferResult` turns a
  `Map<number, UvSearchHit>` into the final output geometry (interpolating each hit's source UV via
  `GeometryUtils.interpolateUv`), computing `coverage` along the way.

#### RaycastUVSearch - margin-expanded raycasting

1. **Push** (`PushModifier`) - offsets the patch's local-space vertices outward along averaged
   vertex normals (`GeometryUtils.computeVertexNormals`) by
   `RAYCAST_UV_SEARCH_CONSTANTS.NORMAL_MARGIN` (0.005). Since the patch is draped onto the body, it
   sits almost exactly *on* the body surface along the raycast direction - without separation, hits
   can land at `t ≈ 0` (lost to float noise) or, after relax smooths the patch inward on curved
   regions, at negative `t` (behind the ray origin, unrecoverable regardless of face culling).
   Pushing the patch out guards against both.
2. **Grow boundary rim** (`GrowBoundaryEdgesModifier`) - adds one new rim vertex per boundary
   vertex, grown radially outward in both position and UV space by
   `RAYCAST_UV_SEARCH_CONSTANTS.BOUNDARY_GROWTH` (0.08), stitched to the boundary loop with new
   triangles. Extrapolates UVs past the patch's real edge so rays landing just past the boundary
   still resolve a source UV. Push and grow are independent `GeometryModifier`s (not a single
   bundled call).
3. Expanded patch positions are transformed to world space and built into a raycast target mesh
   (`DoubleSide`, since the patch's winding vs. the body's outward normal isn't guaranteed).
4. Every body vertex in the editable group is raycast from its world position along its world
   normal onto the expanded patch mesh. On a hit, the hit's barycentric coordinate against the
   expanded triangle plus its resolved vertex indices become a `UvSearchHit`.
5. `UvTransferResultBuilder.buildUvTransferResult` turns the hit map into the output geometry (see
   above) against the expanded patch's UVs.

A `Visual3dDebugger` can optionally be attached (`RaycastUVSearch.setDebugger`) to visualize the
expanded patch wireframe and every ray, color-coded hit/miss.

**`GeometryModifier`** is the shared interface behind step 1 and 2: `apply(geometry: BufferGeometry)
=> BufferGeometry`, implemented by `PushModifier` (constructed with a margin) and
`GrowBoundaryEdgesModifier` (constructed with a growth distance), each a pure transform that
returns a new geometry rather than mutating its input. `GeometryUtils` holds the plain math
functions both modifiers share (`computeVertexNormals`, `normalizeWinding`) plus `interpolateUv`,
used by `UvTransferResultBuilder`.

#### ClosestPointUVSearch - BVH-accelerated closest point, normal-gated

Same patch-centric setup, minus the push margin (a closest-point query doesn't need surface
separation the way a raycast does) - only `GrowBoundaryEdgesModifier` runs, using its own
`CLOSEST_POINT_UV_SEARCH_CONSTANTS.BOUNDARY_GROWTH`. The expanded patch (world space) is built into
a `MeshBVH` (`three-mesh-bvh`) instead of a raycast target mesh.

For each affected body vertex, a `MeshBVH.shapecast` traversal finds the closest point on any
patch triangle (edge/face, not nearest vertex) to that vertex's world position:

- **Branch-and-bound pruning by distance** - `intersectsBounds` skips any subtree whose bounding
  box can't beat the current closest distance; `boundsTraverseOrder` visits the nearer child first
  so the bound tightens as early as possible.
- **Normal-gated candidates** - `intersectsTriangle` rejects any triangle whose normal's dot
  product with the query vertex's normal falls below
  `CLOSEST_POINT_UV_SEARCH_CONSTANTS.NORMAL_DOT_THRESHOLD` (0 = past 90°) before even considering
  its distance. Without this, closest-point-in-space snaps across concave folds (armpits, between
  fingers) to geometrically-near but surface-unrelated patch regions - confirmed failure mode, not
  hypothetical.
- A match past `CLOSEST_POINT_UV_SEARCH_CONSTANTS.MAX_DISTANCE` doesn't count as a hit.

The winning triangle + barycentric coordinate of the closest point become a `UvSearchHit`, same as
the raycast path, then flow through the same `buildUvTransferResult`.

`UVSearchAlgorithm` is an interface specifically so either search approach can be swapped, A/B'd,
or (eventually) blended by region without touching `PatchBaker`/`BakeRequestBuilder`.

### 3. Region mask - `PatchRegionMaskRasterizer`

Both `GrowBoundaryEdgesModifier` variants above extrapolate `uv1` past the patch's real boundary
so search hits landing just past the edge still resolve to *some* source UV - a coverage margin,
not a content boundary. Left uncorrected, `FootprintRasterizer` would sample the sketch texture at
those extrapolated UVs as-is: outside the design's authored region, into whatever the wrap mode
puts there (smeared edge texels on clamp, wrapped-around unrelated pixels on repeat).

`PatchRegionMaskRasterizer` renders the patch's own *un-grown, un-pushed* UV footprint - same
technique as `FootprintRasterizer` step 4, but the patch's own `uv` is the clip-space position
instead of the body's - into a small (`REGION_MASK_CONSTANTS.MASK_RESOLUTION`, 512²) alpha mask,
then blurs it with a two-pass separable kernel (`BLUR_RADIUS_TEXELS`). Small resolution + blur is
deliberate: the mask only needs to mark "inside the real design footprint" in the same UV space
`uv1` lives in, and the blur turns a hard cutoff into a feathered falloff instead of just moving
the visible seam. It depends only on the patch's UV shape, not on sketch pixel content, so its
cache lifecycle is naturally coarser than the color bake's - recomputed once per bake alongside it
for now, but a candidate to cache separately if that ever matters.

A footprint can itself touch or fill the mask's own UV-space border (u/v = 0 or 1) - a patch using
the full sketch texture, say - leaving the blur nothing to feather against there. A final pass
forces the mask down to 0 within `EDGE_FADE_TEXELS` of that border regardless of footprint shape,
so the design's very edge is always a soft falloff into transparency, never a hard cut.

### 4. Rasterize - `FootprintRasterizer`

One GPU draw call that turns the search result into a texture: body UV (`uv`) becomes the
clip-space vertex position, `uv1` (source UV) is sampled from the patch's sketch texture in the
fragment shader, multiplied by the region mask (step 3) sampled at the same `uv1` - this is what
zeroes out samples that landed on the grown rim's extrapolated UVs. Renders into a
`BAKE_RESOLUTION` (4096²) `WebGLRenderTarget`, cleared fully transparent (alpha 0) so untouched
pixels outside the patch's footprint stay transparent for later compositing.

Result becomes `entry.bakedTarget`, cached until the patch goes dirty again
(`PlacedMeshList.setBakedLayer` / `markDirty`).

### 5. Composite - `BodyTextureComposer`

Synchronous, cache-only, runs after every command via `refreshBakeAndVisibility`. Starts from the
body's original editable texture and multiplies every non-excluded `drapedPatch`'s `bakedTarget`
over it in placement order, ping-ponging between two scratch render targets
(`compositeTargetA`/`B`). Each layer step (`renderMultiplyOver`) does straight (non-premultiplied)
alpha compositing, first pushing that piece's own contrast (`Piece.contrast`, a live setting - see
`ReactBridge.setPlacedMeshContrast` and `AppliedPieceSettings`) around the 0.5 midpoint:

```
contrasted = clamp((layer.rgb - 0.5) * piece.contrast + 0.5, 0, 1)
outColor = mix(base.rgb, base.rgb * contrasted, layer.a)
outAlpha = layer.a + base.a * (1 - layer.a)
```

`Piece.contrast` defaults to `MESH_BAKE_CONSTANTS.DEFAULT_LAYER_CONTRAST` (1, a no-op); the
user-facing slider lives behind each card's chevron in the applied-pieces stack panel.

`excludeId` (the currently-selected patch) is skipped - it's still rendered live as a real mesh
instead, per `refreshBakeAndVisibility`. The final composited texture is assigned as the body's
editable material `map`.

## Why the split

- Search+rasterize (`PatchBaker`) is the expensive part (searching for every affected body
  vertex's source UV, full-resolution GPU draw) - only worth redoing when a patch is actually
  dirty, so it's async and cached per patch.
- Composite (`BodyTextureComposer`) is cheap (a handful of full-screen shader passes over cached
  textures) - safe to rerun after every single command so the body never shows a stale texture.

## Key files

- `src/editor/services/BakeRequestBuilder.ts` - live Three.js objects → plain request payload.
- `src/editor/services/UVSearchAlgorithm.ts` - search interface + request/response shape.
- `src/editor/services/RaycastUVSearch.ts` - margin-expanded raycasting search implementation.
- `src/editor/services/ClosestPointUVSearch.ts` - BVH-accelerated, normal-gated closest-point search implementation.
- `src/editor/services/UvSearchHit.ts` - shared per-vertex hit contract (patch triangle + barycoord) both implementations produce.
- `src/editor/services/UvTransferResultBuilder.ts` - shared `AffectedRegion` scan + `UvSearchHit` map → output geometry builder.
- `src/editor/services/GeometryModifier.ts` - shared `BufferGeometry -> BufferGeometry` transform interface.
- `src/editor/services/PushModifier.ts` - `GeometryModifier`: pushes vertices along their normals.
- `src/editor/services/GrowBoundaryEdgesModifier.ts` - `GeometryModifier`: grows a boundary rim with UV extrapolation.
- `src/editor/services/GeometryUtils.ts` - shared pure math: `computeVertexNormals`, `normalizeWinding`, `interpolateUv`.
- `src/editor/services/PatchBaker.ts` - orchestrates search → mask → rasterize per dirty patch, generation-based stale-result guard, picks the search implementation.
- `src/editor/services/PatchRegionMaskRasterizer.ts` - renders + blurs the patch's true (un-grown) UV footprint, used to zero out samples from the search algorithms' boundary-growth margin.
- `src/editor/services/FootprintRasterizer.ts` - GPU draw: search result + region mask → `bakedTarget`.
- `src/editor/services/BodyTextureComposer.ts` - composites cached `bakedTarget`s onto the body texture, applying each piece's live contrast setting.
- `src/editor/components/AppliedPieceSettings.tsx` - per-card popover (opened from its chevron in the applied-pieces stack panel) holding that piece's contrast slider.
- `src/editor/constants.ts` - `RAYCAST_UV_SEARCH_CONSTANTS`, `CLOSEST_POINT_UV_SEARCH_CONSTANTS`, `MESH_BAKE_CONSTANTS`, `REGION_MASK_CONSTANTS`.

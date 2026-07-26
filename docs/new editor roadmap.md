# Tattoo sketch → 3D body placement — architecture summary

## Problem

Place a 2D tattoo sketch (or several) onto a custom 3D body/body-part mesh
with PBR textures, for a non-technical end user, covering large continuous
designs (full sleeves, chest-to-shoulder pieces) across anatomy with
mixed curvature (cylindrical limbs, doubly-curved shoulder/armpit).

Hard constraints:
- User never sees a UV editor or is asked to think in UV space.
- Target mesh may have no authored UV at all, and may be re-modified later.
- Must handle large designs spanning multiple curvature regimes, not just
  small isolated motifs.

## Rejected approaches (for context, don't revisit)

- **Single planar decal/projector per stamp.** Fine for small motifs, breaks
  down for anything spanning more than local curvature — a flat projection
  only stays accurate near its own click point (error grows as `d²/2R`
  with distance from the seed point and local radius of curvature).
- **UV-rectangle stamping** (treating UV distance as a proxy for world
  distance). Only valid if the UV chart itself is already near-isometric;
  breaks completely across seams and on non-cylindrical charts (chest,
  palm).
- **Cloth simulation as the primary placement mechanism** (drop a flat
  grid, let PBD relax it onto the body from scratch). Works, but is
  unreliable at scale: a naive flat initial seed frequently fails to find
  any surface hit for large sheets, and is prone to ICP-style bad local
  minima (matching to the wrong side of a thin limb). Physics is too
  weak a tool to also be responsible for *discovering* the wrap — it's
  good at refinement, bad at initial correspondence.

## Core design: discrete exponential map + physics cleanup

Two clearly separated jobs:

1. **Placement (deterministic, geometric).** A discrete exponential map
   computed by marching outward from the user's click point, front by
   front, across the actual body mesh. This is the well-established
   "discrete exponential map for decal placement" technique (Schmidt,
   Grimm, Wyvill 2006) — built for exactly this problem.
2. **Cleanup / live editing (physics, local only).** Position-based
   dynamics (PBD), used only to relax small residual drift after
   placement and to drive live drag-to-fine-tune of individual vertices.
   Not used to discover the wrap from scratch.

### 1. Selection & triangulation

- User uploads a sketch image.
- Lasso tool selects an arbitrary (possibly concave) region — no
  rectangle-only constraint. Tight selection matters: PBD/relaxation
  constraints couple neighbors, so a large empty rectangular fringe can
  destabilize regions the user actually cares about.
- Triangulate via constrained Delaunay (Shewchuk's Triangle, via Zig
  `@cImport`, compiled to WASM) with a fixed max-area parameter for
  interior refinement — dense enough interior mesh to drape smoothly,
  not just a coarse boundary fan.

> [!warning] Questionable

- Area-weighted polygon centroid (not vertex average — wrong on
  asymmetric/concave shapes) becomes the local origin of the 2D grid.


### 2. Placement origin & basis

- User clicks a point on the body mesh → raycast gives world position
  `P`, surface normal `N`.
- Gizmo lets the user rotate/scale before committing — this picks the
  tangent `T` (orthogonal to `N`) and scale of the local 2D→3D mapping.
  This choice matters: it's what determines whether the design wraps
  lengthwise or like a belt around a limb.

### 3. Marching the exponential map (the core algorithm)

Grid nodes are visited in order of accumulated geodesic distance from
the origin (front-marching, same structure as the Fast Marching Method
/ Dijkstra on a mesh):

- For each new node, gather **all already-visited neighbors**, not just
  one parent.
- Predict its position as an inverse-squared-distance-weighted average
  of `parent_i.position + delta * T_i` over those neighbors.
- **Reproject** the averaged position onto the true surface immediately
  (closest-point-on-mesh / short raycast) — an average of two valid
  surface points is generally not itself on the surface.
- **Frames don't average linearly.** Average the tangent vectors only,
  project out the normal component, re-orthogonalize (Gram-Schmidt) to
  rebuild a valid basis. Do not attempt to average full rotations.

Why multi-parent averaging matters: single-parent (Dijkstra-style)
marching produces a visible seam wherever two propagation fronts meet,
because parallel-transporting a frame around different paths on a
curved surface doesn't converge to the same result (this is a direct
consequence of nonzero Gaussian curvature — not fixable by better code,
only distributable). Multi-parent weighted averaging spreads that same
total error into smooth low-magnitude shear across the whole grid
instead of concentrating it into one crack.

*Cheaper MVP substitute:* single-parent Dijkstra march, followed by a
few passes of Laplacian smoothing (pull each node toward its neighbor
average, reproject) as a separate cleanup step. Less elegant, much
easier to implement/debug in isolation; upgrade to true multi-neighbor
weighting later if needed on worst-case meshes.

### 4. Mesh1 → 3D transfer

For every vertex of the triangulated sketch mesh (mesh1) at local
coordinates `(x, y)`: locate its grid cell, bilinearly interpolate the
four corner world positions (and slerp frames for normals). No BVH
query needed at this stage — the grid already encodes the mapping.

### 5. Failure handling — partial application, not pass/fail

Per-node validity checks during the march:
- **Coverage stall** — front dies before covering mesh1's footprint
  (hit a silhouette edge, hole, disconnected region like fingers).
- **Distortion blowup** — marched cell area vs. rest area exceeds a
  threshold.
- **Frame degeneracy** — marching direction goes near-tangent to the
  normal (grazing a silhouette).
- **Self-fold** — normal flip relative to parent (deep concavity, e.g.
  armpit).

Instead of aborting the whole march on first failure: mark individual
bad nodes/triangles as excluded and keep going. Show the user a live
red/gray overlay directly on their flat 2D sketch selection (not on the
3D view) indicating which part of the design can't be applied. Clip or
skip triangles touching excluded vertices at bake/transfer time so the
boundary is a clean hole, not an interpolated smear.

**UI contract:** Apply is enabled whenever coverage > 0%, with an
"N% applied" indicator. Zero coverage is the only real reject state.
User can shrink/move the selection and retry, or accept the gap.

**Async wiring:** debounce gizmo transform changes (~150–300ms),
run the validity march in a Worker/WASM off the main thread, cancel
stale in-flight computations when a newer transform supersedes them.
Apply button is tri-state (pending / valid+coverage% / zero-coverage),
never left showing a stale success after the transform has moved on.

### 6. Post-placement editing

- Settled result is edited directly by dragging individual mesh1
  vertices on the body mesh — local PBD relaxation (pin dragged vertex,
  solve a small neighborhood, warm-started) handles the live feel.
- Multiple independent stamps (same or different source images) can be
  positioned to touch or connect: snap-to-vertex when dragging a
  boundary vertex near another stamp's boundary, optionally weld into a
  shared vertex for later joint editing.
- No limit on how many stamps / how much coverage — a user can in
  principle tile the entire body.

### 7. No UV requirement on the target mesh

The entire placement pipeline (position map bake aside) operates on raw
world positions, normals, and closest-point/raycast queries against
triangle soup. Any reasonably smooth mesh works regardless of UV
authoring quality — including meshes with no UVs at all.

UV only re-enters if a **flat exported texture** is needed (for use
outside this tool's own renderer — game engine, static render, print).
In that case, auto-unwrap the target mesh on demand (e.g. `xatlas` in
WASM) purely as a bake target; the user never sees or touches it.

**Open decision:** whether the product stays "live draped decal layers,
rendered directly, never baked to a flat texture" (simplest, no UV ever
needed) or also supports flat-texture export (adds the auto-UV +
backward-bake step). Affects whether Phase 6 below is built at all.

## Backward bake (only if flat texture export is needed)

For each texel of the body's (auto-generated) UV texture: nearest point
on the settled decal mesh in world space → pull `sourceUV` from the hit
triangle's barycentric coordinates → sample the sketch image. Immune to
UV seams by construction, since the correspondence never interpolates
in UV space. Fold-cull (reject hits whose normal opposes the local body
normal) to avoid the underside of a fold bleeding through. Alpha-fade
texels beyond a distance threshold instead of forcing a bad mapping.

Composite multiple stamps as ordered, non-destructive layers.

## Performance / scaling notes

- Each stamp keeps its own decal mesh + relaxation state only while
  actively selected/edited. Freeze/merge finalized stamps into a single
  static buffer once deselected (same pattern as "apply modifier" in
  Blender or "merge down" in Substance) — needed once a user is tiling
  dozens+ of stamps.
- Cloth/relaxation resolution controls drape accuracy only; image detail
  comes entirely from the source texture resolution — fully decoupled,
  so the solver grid can stay coarse and cheap.

## Suggested build order

1. Foundation: Three.js viewer, position/normal map bake, `three-mesh-bvh`.
2. Exponential-map marcher on a synthetic primitive (cylinder/sphere)
   before touching a real body mesh — isolate marching bugs from mesh
   complexity.
3. Real click → march → mesh1 transfer, live preview as offset decal
   geometry (no texture bake yet).
4. Partial-coverage validity overlay + debounced async wiring.
5. Selection/lasso + constrained-Delaunay triangulation (parallelizable
   with steps 2–3).
6. Layer stack (thumbnail-only rail), vertex-drag fine-tuning via local
   PBD, undo/redo, autosave (serialize inputs — selection, transform,
   dragged-vertex deltas — re-march deterministically on load, don't
   persist raw solver state).
7. Backward bake + export, only if the flat-texture decision above says
   it's needed.
8. Render panel (explicit, non-automatic action) consuming the
   composited result.
9. Hardening: self-collision in the PBD cleanup pass for cleaner
   armpit folds, adaptive grid density in high-curvature zones,
   snap/weld for connecting stamps.

## Stack

- Three.js for viewer/rendering.
- `three-mesh-bvh` for closest-point/raycast queries.
- Zig, compiled to WASM, for: constrained Delaunay triangulation
  (`@cImport` of Shewchuk's Triangle) and the PBD cleanup solver's inner
  loop, if profiling shows plain TS isn't fast enough (don't assume it
  upfront — the cleanup-pass grids are small, TS/typed-arrays may well
  be sufficient).

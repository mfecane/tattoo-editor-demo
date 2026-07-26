# Project Context

## What this repository actually is

This is a showcase/portfolio project - but it is not a simplified copy of some other, "real"
codebase. It is also the active R&D playground for the underlying 3D editor engine: new
projection strategies, wrap/bake pipelines, interaction handlers, and refactors are designed,
prototyped, and hardened here first. Proper development happens in this codebase. Once a piece
of work is proven out here, it gets transferred into the main product.

## How the main product relates to this one

The main product is a larger SaaS application that wraps this same core editor. It adds
everything a multi-tenant SaaS needs on top of the editor engine that lives here, none of which
this repo implements itself:

- user accounts and access management
- sharing/collaboration
- project persistence, serialization, schema versioning, and migrations
- render storage (see `RenderData` in `src/editor/types/projectTypes.ts` for the schema shape
  the main product persists into - this demo constructs that shape but never writes it anywhere;
  `EditorProject`'s doc comment already notes "No placed-mesh persistence yet")

So: treat this repo as the editor engine plus a self-contained demo shell around it. Code quality,
architecture, and correctness here matter for reasons beyond this demo - changes made here are
expected to migrate upstream into the main product, not just serve the showcase build.

## Terms

**sketch** - Any image (uploaded or built-in) that can be placed on a body. Should be uniquely identified by id.

**region** - Square or polygon selection on a sketch.

**regionMesh** - Tesselated/triangulated flat region extracted from a sketch.

**drapedPatch** - A regionMesh wrapped around a BodyMesh surface. This is the 3D representation of a region placed on the body.

**BodyMesh** - The 3D mesh onto which patches are placed. This is the body geometry.

**bakedLayer** - One patch's contribution to the final composed texture. Represents how a single drapedPatch contributes to the final baked texture.

**Project** - Container holding: a BodyMesh reference, list of Sketches, Regions, Patches (drapedPatches), and layer composition order.

## Common editor architecture

Layers:
- React UI
- Rendering library UI (three/pixi)
- Business logic

- Editor - root object owns everything, services, controller, ReactBridge, three.js / pixi.js rendering.

	- useEditorStore - Editor is used by react layer via useEditorStore. Zustand-backed store to keep editor instance, editor lifetime-related state - loading/error/projectId. Those are required to create editor instance.

- EditorController owns appliation business logic layer state and methods to modify it. Also it dows own tools, HistoryController, commands - All the abstrations that do mutate application state.

- EditorController also owns Project object - serializeable state that is persisted in the database.

- HistoryController - application's state is mutated via command interface - undoable/redoable. Applies/tracks unapplies commands.

- Editor is instanciated via useEditor hook

- Views (tsx files) - react components, allowed to own only local state

- ReactBridge - owns dom ui-only global state - state that only required to update the UI. react bridge is accessed by components via useReactBridge hook.

### Interaction system

CanvasEventHandler - raw events pre-processor, detects drag, double click, single click.

InteractionHandlerRouter - dispatches synthetic event object to handlers. decides which handler should be called based on handler's ability to handle certain event, whether handler is capturing the events, handlers prority.

InteractionHandler - event handler interface. Each concrete event handler acts depending on the application state. Uses controller to mutate state.

## Based on this architecture sketch two editors

src/editor/main/ - 3d tattoo on body placement editor
src/editor/polygon/ - 2d polygon definition on single sketch

Polygon editor shares part of the global state with 3d editor - list of polygons defined on sketches.

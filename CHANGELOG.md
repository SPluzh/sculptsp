# Changelog

All notable changes to this project will be documented in this file.

## [0.9.0]
- **Camera**: Fixed a bug where ZSpheres disappeared when moving/zooming/orbiting the camera. Camera near/far clipping planes are now optimized based on the bounding box of active elements (including ZSpheres and grid) even if the mesh count is zero. Safe margins are now added to prevent aggressive clipping when working with small bounding volumes or zooming closely/distantly.
- **ZSphere Tool**: Added a **Rotate** mode that allows rotating the chain of descendant ZSpheres around the selected sphere using camera-aligned mouse dragging.
- **ZSphere Tool**: Made the link connections between ZSpheres render at full thickness, tapering smoothly from the parent sphere's radius to the child sphere's radius.
- **ZSphere Tool**: Improved link-splitting usability by making hit detection depth-sorted, ensuring background ZSpheres do not block interaction with foreground link connections.
- **ZSphere Tool**: Added a visual hover feedback system in Draw mode, displaying a green preview ZSphere at the cursor position along the link and highlighting only the hovered link cylinder.
- **ZSphere Tool**: Kept ZSpheres persistently visible in the scene when switching to and activating other sculpting tools (e.g. Brushes).
- **ZSphere Tool**: Implemented automatic merging of ZSpheres. When drawing or moving a sphere, if it is placed close enough to any other sphere (distance less than 30% of the sum of their radii), it automatically merges into it. All children are correctly reparented, preserving the skeletal hierarchy.
- **ZSphere Tool**: Increased the initial root ZSphere size (radius) from 1.0 to 2.5 for better visibility and proportion.
- **ZSphere Tool**: Updated the drawing interaction so that newly dragged ZSpheres automatically maintain the same radius as the parent ZSphere they are dragged from.
- **ZSphere Tool**: Added a "Create Root ZSphere" button in the ZSphere tool UI to allow manually generating the first ZSphere at the camera center if the graph is empty or cleared.
- **UI/Translations**: Added Russian and English translation strings for the new "Create Root ZSphere" button and the ZSphere mode controls.
- **ZSphere Tool**: Added a complete ZSphere sculpting system, allowing users to build complex organic skeletal armatures using interconnected spherical nodes.
- **ZSphere Tool Activation & Rendering**: Added automatic creation of a root ZSphere at the camera center upon tool activation. Resolved rendering issues by adding the ZSphere drawable to the scene's opaque drawing pass, fixed attribute buffer binding errors in the shader rendering pipeline, ensured sphere geometries call `initRender()` to allocate their WebGL buffers, added console logs to trace tool activation/deactivation events, and optimized key event listeners to register only while the ZSphere tool is active.
- **Fix**: Resolved critical issues that caused the application to crash or throw errors upon startup when initializing the ZSphere tool (specifically, missing WebGL context retrieval and missing math matrix references).
- **ZSphere Interaction**: Implemented intuitive mode controls to Draw (extending new nodes or splitting existing connections), Move (adjusting node positions in 3D space), and Scale (changing node sizes). Added support for Alt-clicking to delete nodes.
- **SDF Mesh Generation**: Added a "Create Mesh" feature that automatically evaluates a Signed Distance Field (SDF) of the ZSphere skeleton and reconstructs a smooth, watertight manifold mesh using Marching Cubes.
- **UI**: Added a 3D navigation cube (Snap Cube) in the top-right corner of the viewport. It displays the current camera orientation, features solid (opaque) axis-based coloring, blocks double-click zoom actions, and supports clicking faces, edges, and corners to snap the camera to 90-degree and 45-degree angles.
- **Fix**: Corrected the Y-axis rotation angles for all Snap Cube elements to align with the camera/orbit coordinate system, and added a quaternion hemisphere check to guarantee smooth, shortest-path animations without flips.
- **Aesthetics**: Switched the Snap Cube to orthographic projection (removing perspective distortions) and adjusted the sizes and translations of faces, edges, and corners to connect them seamlessly. Styled all corners as perfect triangles (using CSS clip-path and nested pseudo-element borders) and connected them watertight to the rectangular edges and square faces. Additionally, colored all edges and corners using blended axis-based background colors (connecting Red, Green, and Blue hues).
- **UI**: Fixed a bug where the Snap Cube corners (triangles) would occasionally disappear at specific camera angles due to backface culling, and adjusted dimensions and depths to eliminate subpixel rendering gaps (cracks) between adjacent faces, edges, and corners.
- **Fix**: Prevented navigation cube corners (triangles) from disappearing at certain camera angles by correcting their depth placement, forcing hardware acceleration, and removing hover z-index values that broke the 3D rendering context.

# Changelog

All notable changes to this project will be documented in this file.

## [0.9.0]
- **UI**: Added a 3D navigation cube (Snap Cube) in the top-right corner of the viewport. It displays the current camera orientation, features solid (opaque) axis-based coloring, blocks double-click zoom actions, and supports clicking faces, edges, and corners to snap the camera to 90-degree and 45-degree angles.
- **Fix**: Corrected the Y-axis rotation angles for all Snap Cube elements to align with the camera/orbit coordinate system, and added a quaternion hemisphere check to guarantee smooth, shortest-path animations without flips.
- **Aesthetics**: Switched the Snap Cube to orthographic projection (removing perspective distortions) and adjusted the sizes and translations of faces, edges, and corners to connect them seamlessly. Styled all corners as perfect triangles (using CSS clip-path and nested pseudo-element borders) and connected them watertight to the rectangular edges and square faces. Additionally, colored all edges and corners using blended axis-based background colors (connecting Red, Green, and Blue hues).
- **UI**: Fixed a bug where the Snap Cube corners (triangles) would occasionally disappear at specific camera angles due to backface culling, and adjusted dimensions and depths to eliminate subpixel rendering gaps (cracks) between adjacent faces, edges, and corners.

# Game Design Blueprint: AR Voxel Builder (Project: "Holo-Lego")

## 1. Core Vision & Concept
A seamless, markerless Augmented Reality (AR) spatial puzzle game built directly in the web browser. The game transforms the physical space of the exhibition booth into a digital canvas where players use their bare hands to pick, place, and destroy 3D voxels to match specific architectural blueprints.

**Target Experience:** Intuitive, futuristic, and highly responsive. It should feel like operating a professional 3D software (like Blender) using only hand gestures, optimized for a fast-paced exhibition environment.

---

## 2. Visual & Audio Aesthetics ("Juiciness")
To elevate the prototype into a polished product, the visual and auditory feedback must be deeply satisfying and instantly communicative.

*   **Seamless AR Integration:** The webcam feed is not just a static background. The 3D scene utilizes an ambient light sensor (or camera brightness approximation) so the virtual voxels dynamically adjust their lighting and shadows to match the real-world booth environment.
*   **Premium Voxel Materials:** Instead of flat colors, voxels use a "Sci-Fi Glassmorphism" shader—slightly transparent, glowing at the edges, and emitting a soft neon light.
*   **Micro-Interactions (Particles & Audio):**
    *   *Placement:* A successful "Pinch" triggers a satisfying snap sound, accompanied by a small burst of digital sparks (particle system) at the exact placement coordinates.
    *   *Deletion:* A "Fist" gesture on a block triggers a shattering glass sound, and the voxel explodes into tiny, physics-based fragments that dissolve over a few seconds.

---

## 3. Control Scheme: Dual-Hand State Machine
Navigation and action are separated into two hands to prevent gesture overlapping and to mimic professional 3D modeling workflows.

**Right Hand (Action & Manipulation):**
*   **Idle (Open Hand):** Projects the Smart Reticle (cursor).
*   **Add (Pinch - Thumb & Index):** Spawns and snaps a voxel to the grid.
*   **Delete (Closed Fist):** Removes the targeted voxel.

**Left Hand (Navigation & Camera):**
*   **Orbit (Open Hand + Swipe):** Rotates the camera around the central grid based on horizontal movement, applying a lerp (linear interpolation) function for smooth, cinematic panning.
*   **Zoom (Pinch + Y-Axis Move):** Moving the pinched hand up/down adjusts the camera radius (zooming in and out of the structure).

**The Smart Reticle (Cursor):**
*   *Adaptive Shape:* A floating dot when idle. As the thumb and index finger get closer (anticipating a pinch), the dot morphs into a transparent wireframe cube.
*   *Error State:* If the user attempts to pinch in empty mid-air (without a grid or existing block beneath), the reticle turns red, indicating an invalid placement.
*   *Depth Guide:* A thin, glowing vertical laser line drops from the cursor straight down to the floor grid, helping players perceive Z-axis depth on a 2D screen.

---

## 4. Core Gameplay Loop: "Time-Attack Architect"
To maintain high engagement and keep the exhibition line moving, the game avoids endless sandbox mode in favor of structured, bite-sized challenges.

*   **The Blueprint Phase:** A rotating, semi-transparent 3D model (e.g., a pyramid, a bridge, or a staircase) appears in the top-right corner of the HUD (Heads-Up Display).
*   **The Build Phase:** The player has a set time limit (e.g., 60 seconds) to replicate the exact structure on the main grid.
*   **Real-Time AI Validation:** An array matrix algorithm constantly compares the coordinates of the player's voxels against the target blueprint matrix. 
*   **The Climax:** Upon achieving 100% structural accuracy, the game immediately pauses. The screen flashes green, a "LEVEL CLEARED" banner drops, and a massive digital confetti particle effect explodes across the AR space.

---

## 5. UI, UX & Onboarding
First-time users need zero friction to understand how to interact with the system.

*   **Auto-Calibration Screen:** Before the game starts, a glowing outline of two hands appears on the screen. The player must align their real hands with the outline. Once matched, a "CALIBRATION SUCCESS" animation plays, ensuring the player is standing at the optimal distance from the camera.
*   **Glassmorphism HUD:** The user interface features frosted-glass panels that do not obstruct the AR view.
*   **Dynamic Gesture Tooltips:** If the system detects a player struggling (e.g., hovering the cursor but not placing anything for 10 seconds), a small, looping GIF of a hand performing a "Pinch" appears next to the cursor as a gentle hint.

---

## 6. Exhibition Engagement (The Crowd Puller)
Mechanics designed specifically to draw a crowd and encourage replayability at a school fair.

*   **The "Victory Pose" Snapshot:** Upon beating a level in record time, a 3-second countdown begins. The player is prompted to strike a pose (e.g., a Peace sign) next to their virtual creation. The system takes an automated screenshot.
*   **Local Leaderboard:** The captured photo, along with the player's clear time, is instantly pushed to a "Top Builders" leaderboard displayed on a secondary monitor facing the hallway, driving competitive engagement among students.
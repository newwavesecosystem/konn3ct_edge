---
name: Core Connectivity System
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fd'
  surface-container: '#ededf8'
  surface-container-high: '#e7e7f2'
  surface-container-highest: '#e1e2ec'
  on-surface: '#191b23'
  on-surface-variant: '#424654'
  inverse-surface: '#2e3038'
  inverse-on-surface: '#f0f0fb'
  outline: '#737785'
  outline-variant: '#c3c6d6'
  surface-tint: '#0856cf'
  primary: '#0041a2'
  on-primary: '#ffffff'
  primary-container: '#0b57d0'
  on-primary-container: '#ced9ff'
  inverse-primary: '#b2c5ff'
  secondary: '#5b5f64'
  on-secondary: '#ffffff'
  secondary-container: '#dde0e6'
  on-secondary-container: '#5f6368'
  tertiary: '#802b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#a83b00'
  on-tertiary-container: '#ffcfbe'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001847'
  on-primary-fixed-variant: '#0040a1'
  secondary-fixed: '#dfe3e8'
  secondary-fixed-dim: '#c3c7cc'
  on-secondary-fixed: '#181c20'
  on-secondary-fixed-variant: '#43474c'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb599'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#7f2b00'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ec'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  margin-mobile: 1rem
  gutter-md: 1rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 1.5rem
  tap-target-min: 48px
---

## Brand & Style
The design system is engineered for high-stakes professional communication. It prioritizes clarity, reliability, and cognitive ease, ensuring users can focus on the conversation rather than the interface. 

The aesthetic is **Corporate Modern** with a layer of **Glassmorphism** specifically for active call states. It blends the structural integrity of traditional enterprise tools with the fluid, high-fidelity finish of modern mobile OS paradigms. The emotional goal is to feel "installed" and native—a tool that is both a powerful utility and a seamless part of the user's professional workflow.

## Colors
The palette is rooted in "Meeting Blue," a color scientifically associated with stability and focus. 

- **Primary (#0B57D0):** Used for critical actions like starting a meeting or primary navigation.
- **Surface & Backgrounds:** We use a tiered neutral scale. The base background is a cool off-white, while cards and containers use pure white to pop.
- **Semantic Colors:** Vibrant Green (#1E8E3E) is reserved exclusively for "Join" and "Live" status indicators. Deep Red (#D93025) is used for high-impact destructive actions like "End Meeting" to prevent accidental triggers.
- **Translucency:** In-call overlays utilize a white-tinted glass effect with a 20px backdrop blur to maintain legibility over moving video feeds.

## Typography
Inter is used across the entire system for its exceptional legibility on mobile screens and its neutral, professional tone.

- **Headlines:** Use tight letter-spacing and bold weights to provide a strong anchor for meeting titles and page headers.
- **Body:** Standardized at 16px for primary information to ensure comfort for all users.
- **Labels:** Used for metadata (timestamps, participant counts). The `label-sm` utilizes uppercase tracking for better scanning in dense lists.

## Layout & Spacing
The layout follows a **Fluid Grid** model optimized for one-handed mobile use. 

- **Safe Zones:** All primary content is inset by 16px (`margin-mobile`) from the screen edges.
- **Vertical Rhythm:** Elements are stacked using an 8px base unit. Small gaps (8px) for related items, medium (16px) for distinct sections, and large (24px) for major layout transitions.
- **Tap Targets:** No interactive element (button, icon-toggle, or list item) is smaller than 48px in height/width to ensure accessible interaction during movement or while multitasking.

## Elevation & Depth
This design system uses a combination of **Tonal Layers** for the pre-join experience and **Glassmorphism** for the in-meeting experience.

1.  **Level 0 (Background):** Neutral Gray (#F8F9FA), flat.
2.  **Level 1 (Cards):** White background with a 1px soft stroke (#E0E0E0) and a very subtle ambient shadow (4px blur, 2% opacity).
3.  **Level 2 (Modals/Sheets):** White background with a more pronounced shadow (16px blur, 8% opacity).
4.  **In-Call Overlays:** Backdrop blur (20px) with a semi-transparent white fill (70% opacity). This creates a sense of depth where the controls float "above" the video stream without disconnecting from the context.

## Shapes
The shape language is friendly yet structured. We use a standardized 12px (`rounded-md`) radius for most cards and input fields. Large buttons and meeting containers use 16px (`rounded-lg`) to feel more approachable and modern.

Icons should follow a "solid-rounded" style—avoiding sharp points or hair-line strokes to maintain visual weight against video backgrounds.

## Components

- **Primary Buttons:** High-contrast blue background, white text, 16px corner radius. Minimum height 52px for mobile prominence.
- **Action Chips:** Used for toggling "Mute," "Camera," or "Raise Hand." When active, they use the primary color; when inactive, they use a translucent glass effect.
- **Meeting Cards:** White surface, 12px radius, featuring a clear "Join" button in success-green pinned to the bottom-right for thumb-reach.
- **Video Tiles:** 12px rounded corners on the video container. In-tile labels (name, mute status) are placed in the bottom-left on a 40% black gradient overlay.
- **Bottom Sheets:** Use 24px top-only rounding. Includes a horizontal drag-handle at the top to indicate gestural dismissibility.
- **Input Fields:** 12px radius, 1px neutral stroke that shifts to 2px primary blue on focus. 
- **Iconography:** 24px grid-based icons with a 2px stroke weight. High-contrast (Primary Blue or Neutral Black) to ensure visibility.
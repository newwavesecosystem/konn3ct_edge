# Konn3ct Edge - Public Website & Marketing Funnels Master Specification

**Target Role:** Lukman (Frontend Website & Marketing Lead)  
**Blueprint Reference:** Volume 2 (Marketing & Funnels) and Volume 8 (Commercial)  
**Context:** This document provides the master technical specification and action plan for the public-facing Konn3ct Edge marketing website, country-specific landing pages, and the event ticketing frontend.

---

## 1. Action Plan & Technical Strategy

Lukman is responsible for the top of the funnel: ensuring users arrive at a blazingly fast, highly converting, and locally relevant website before they even log into the main Konn3ct app.

### Action Plan Steps:
1.  **Architecture Setup:** Initialize a Next.js (App Router) project optimized for Static Site Generation (SSG) to ensure instant page loads for SEO.
2.  **Country-Specific Landing Pages:** Build dynamic route segments (e.g., `/ng`, `/ke`, `/global`) that display tailored copy, localized testimonials, and pricing tables strictly in the local currency.
3.  **Event Ticketing & Public Replay Storefront:** Develop the public catalog pages where users can browse upcoming paid webinars and past recorded replays.
4.  **Checkout UI Integration:** Build the frontend checkout flow. Instead of handling secure payment logic directly, the frontend will integrate Paystack/Stripe drop-ins and pass control to Kay's backend APIs for verification.
5.  **Marketing Tracking:** Inject Google Tag Manager, Meta Pixel, and PostHog to track the user journey from landing page view -> add to cart -> successful ticket purchase.

## 2. Frontend Responsibilities (Lukman)

*   **Public Website UI:** Homepage, Features, Pricing, About Us, and Contact pages.
*   **Localized Pricing Tables:** Fetching or displaying geo-appropriate pricing (e.g., NGN vs USD).
*   **SEO & Core Web Vitals:** Strict adherence to semantic HTML, meta tags, OpenGraph imagery, and sub-second Largest Contentful Paint (LCP) times.
*   **Checkout Experience:** The visual flow for buying a ticket (forms, payment gateway overlays, loading states, and success/receipt UI).

## 3. Backend Responsibilities (Kay)

Lukman's frontend will rely on Kay's backend APIs for the heavy lifting regarding security and data processing. Corresponding tasks have been created for Kay to handle:
*   **Geo-IP Detection API:** To inform Lukman's frontend which country the user is browsing from.
*   **Payment Initialization APIs:** Securely generating the Paystack/Stripe checkout sessions.
*   **Webhook Verification:** Validating the payment success cryptographically from the payment provider (never trusting the frontend).
*   **Ticket Provisioning:** Unlocking the room or replay in the database once the webhook clears.

## 4. Delivery Checklist

Lukman will execute his frontend requirements via the task list in [lukman_website_tasks.csv](file:///C:/conn3ct_meeting/docs/blueprint/lukman_website_tasks.csv).
Kay will execute the supporting backend payment tasks via [kay_fintech_api_tasks.csv](file:///C:/conn3ct_meeting/docs/blueprint/kay_fintech_api_tasks.csv).

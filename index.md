---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "MicroCoreOS"
  text: "The Atomic Microkernel"
  tagline: "Ultra-decoupled architecture optimized for AI-Driven Development."
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quick-start
    - theme: alt
      text: Philosophy
      link: /guide/philosophy
    - theme: alt
      text: Problems It Solves
      link: /guide/problems

features:
  - title: 1 File = 1 Feature
    details: Plugins are self-contained. AI assistants can add features by writing just one file. No merge conflicts by design.
    icon: 🧩
  - title: AI-Native Manifest
    details: Auto-generates AI_CONTEXT.md with live tool signatures for zero-noise prompting. AI gets it right on the first attempt.
    icon: 🤖
  - title: Atomic Decoupling
    details: No cross-domain imports. Communication happens exclusively via a typed EventBus. Architectural decay is structurally impossible.
    icon: ⚛️
  - title: Hybrid Async Engine
    details: Automatically offloads blocking sync code to threads. Focus on logic, not event loop management.
    icon: ⚡
  - title: Graceful Degradation
    details: ToolProxy intercepts all infrastructure failures. If logging goes down, payments keep running. Resilience is automatic.
    icon: 🛡️
  - title: Swappable Infrastructure
    details: Plugins declare what they need by name. Switch from SQLite to PostgreSQL by changing one Tool. Zero plugin changes required.
    icon: 🔄
---


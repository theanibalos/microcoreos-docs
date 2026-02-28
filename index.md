---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "MicroCoreOS"
  text: "The Atomic Microkernel"
  tagline: "Ultra-decoupled architecture optimized for AI-Driven Development."
  image:
    src: /logo.png
    alt: MicroCoreOS Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quick-start
    - theme: alt
      text: Philosophy
      link: /guide/philosophy

features:
  - title: 1 File = 1 Feature
    details: Plugins are self-contained. AI assistants can add features by writing just one file.
    icon: 🧩
  - title: AI-Native Manifest
    details: Auto-generates AI_CONTEXT.md with live tool signatures for zero-noise prompting.
    icon: 🤖
  - title: Atomic Decoupling
    details: No cross-domain imports. Communication happens exclusively via a sharded EventBus.
    icon: ⚛️
  - title: Hybrid Async Engine
    details: Automatically offloads blocking sync code to threads. Focus on logic, not event loop management.
    icon: ⚡
---


---
type: "query"
date: "2026-09-09T12:37:00.075760+00:00"
question: "Why Explorer init/category skeleton never gets replaced after leaving Viz; AbortController pageshow dam-booting; CDP Runtime.evaluate death"
contributor: "graphify"
source_nodes: ["init", "paintCategorySkeleton", "startExplorerIndexBind", "loadExplorerPrimaryIndex", "applyExplorerIndexBundle", "bindExplorerData", "resumeExplorerAfterRestore", "dismissExplorerLoader", "abortAll", "loadIndex"]
---

# Q: Why Explorer init/category skeleton never gets replaced after leaving Viz; AbortController pageshow dam-booting; CDP Runtime.evaluate death

## Answer

Freeze path is init paintCategorySkeleton+setStatus then startExplorerIndexBind->loadExplorerPrimaryIndex->applyExplorerIndexBundle->bindExplorerData. Skeleton stays if bind never runs. Resume is bindExplorerResumeListeners->resumeExplorerAfterRestore. Graph has no nodes for explorerIndexInFlight/pageshow/skipGlobalAbort. abortAll has no path to index fetch. Viz loadIndex has no path to dismissExplorerLoader. Stale INFERRED init->DamLoader.start. CDP death is doctrine hyperedge main-thread busy plus html.dam-booting. Not PASS.

## Source Nodes

- init
- paintCategorySkeleton
- startExplorerIndexBind
- loadExplorerPrimaryIndex
- applyExplorerIndexBundle
- bindExplorerData
- resumeExplorerAfterRestore
- dismissExplorerLoader
- abortAll
- loadIndex
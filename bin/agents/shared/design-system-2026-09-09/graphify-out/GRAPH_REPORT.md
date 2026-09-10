# Graph Report - graphify-out  (2026-09-09)

## Corpus Check
- 8 files · ~120,924 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 865 nodes · 2497 edges · 48 communities (41 shown, 7 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 75 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Explorer freeze restore
- Device path bridge
- Search viz index
- Abort timeout fetch
- Viz grid grouping
- Lifecycle status disk
- Explorer tree render
- Viz product modal
- Lifecycle history admin
- Grid reveal IO
- Explorer carrier cards
- Viz filters flags
- Explorer add product
- Explorer search filters
- Explorer materials
- Shell chrome boot
- Loader overlay dock
- Explorer pakiet files
- Shell trail nav
- Doctrine runtime traps
- Viz assoc picker
- Explorer nav stack
- Shell sticky chrome
- Loader progress
- Explorer meta loads
- P0 control plane
- P1 rhythm tokens
- P1 ownership copy
- P2 evidence
- Design system docs
- Shell menu inject
- Grid reveal modal
- Search suggest
- Explorer index load
- Misc utilities
- Evidence screenshots
- Thin community 36
- Thin community 37
- Thin community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47

## God Nodes (most connected - your core abstractions)
1. `openProductModal()` - 77 edges
2. `renderMain()` - 42 edges
3. `esc()` - 36 edges
4. `init()` - 34 edges
5. `init()` - 30 edges
6. `renderGroup()` - 25 edges
7. `init()` - 25 edges
8. `applyLifecycleStatusNow()` - 23 edges
9. `bridgeUrl()` - 22 edges
10. `normPathKey()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `init()` --shares_data_with--> `Slim file-index fields=explorer bridge route`  [INFERRED]
  corpus/js/dam-explorer.js → evidence/P0-control-plane.md
- `Explorer copy split i18n vs JS literals` --rationale_for--> `init()`  [INFERRED]
  evidence/P1-ownership-map.md → corpus/js/dam-explorer.js
- `responseJsonOffMain()` --rationale_for--> `Explorer return freeze`  [INFERRED]
  corpus/js/dam-explorer.js → corpus/code-doctrine.md
- `Explorer F5 white screen` --rationale_for--> `unlockBootFailsafe()`  [EXTRACTED]
  corpus/code-doctrine.md → corpus/js/dam-panic-reload.js
- `unlockBootFailsafe()` --implements--> `html.dam-booting`  [EXTRACTED]
  corpus/js/dam-panic-reload.js → corpus/code-doctrine.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Explorer slim index bind flow** — corpus_js_dam_explorer_init, corpus_js_dam_explorer_startexplorerindexbind, corpus_js_dam_explorer_loadexplorerprimaryindex, corpus_js_dam_explorer_applyexplorerindexbundle, corpus_js_dam_explorer_bindexplorerdata, corpus_js_dam_explorer_paintcategoryskeleton [EXTRACTED 1.00]
- **Explorer return restore after Wizualizacje** — corpus_js_dam_explorer_bindexplorerresumelisteners, corpus_js_dam_explorer_resumeexplorerafterrestore, corpus_js_dam_explorer_startexplorerindexbind, corpus_code_doctrine_explorer_return_freeze, corpus_code_doctrine_skip_global_abort [EXTRACTED 1.00]
- **html.dam-booting unlock failsafe chain** — corpus_js_dam_panic_reload_unlockbootfailsafe, corpus_js_dam_shell_finishboot, corpus_js_dam_explorer_unlockexplorerboot, corpus_code_doctrine_html_dam_booting [INFERRED 0.85]
- **Explorer runtime module stack** — p0_explorer_canvas, corpus_js_dam_explorer_init, corpus_js_dam_search_bindsearchbox, corpus_js_dam_tag_bar_bind, corpus_js_dam_grid_reveal_reveal, corpus_js_dam_shell_settrailleaf [INFERRED 0.85]

## Communities (48 total, 7 thin omitted)

### Community 0 - "Explorer freeze restore"
Cohesion: 0.08
Nodes (58): window._DAM_SEARCH_INDEX, cursor-ide-browser stall, CDP Runtime.evaluate hang, DamSearch.reload vs searchOnly, Explorer freeze after Wizualizacje, file-index slim fields=explorer, adoptWarmCaches(), appendFileIndexMatches() (+50 more)

### Community 1 - "Device path bridge"
Cohesion: 0.12
Nodes (56): basename(), baseStorageKey(), bindPathActions(), bridgeAuthHeaders(), bridgeBase(), bridgeErrorMessage(), checkBridge(), copyPath() (+48 more)

### Community 2 - "Search viz index"
Cohesion: 0.08
Nodes (45): applyCardZoom(), applyOverrideToItem(), basePreviewZoom(), bindCardZoomControl(), bridgeBase(), buildModalItems(), clearChromeRevealInline(), clearThumbOverride() (+37 more)

### Community 3 - "Abort timeout fetch"
Cohesion: 0.08
Nodes (45): applyPakietFileToProduct(), buildCurrentLifecycleRow(), captureLifecycleContext(), carrierCardExpandKey(), computeChecklist(), revisionHasElements(), dedupeLifecycleTwinRevisions(), elementsOpenPath() (+37 more)

### Community 4 - "Viz grid grouping"
Cohesion: 0.13
Nodes (41): badgeTierOpt(), carrierHuman(), collectVariantIndexKeys(), countManualForProduct(), displayIndex(), flagKey(), hasThumbOverride(), heroMediaUrl() (+33 more)

### Community 5 - "Lifecycle status disk"
Cohesion: 0.09
Nodes (39): bindAddProductCtas(), bindCategoryAddButton(), buildVizStudioModel(), heroesFor(), categoryTitleOf(), diskPathShort(), enrichedProductTitle(), enrichVizFile() (+31 more)

### Community 6 - "Explorer tree render"
Cohesion: 0.10
Nodes (37): applyLifeHistPatches(), buildLifecycleModalRows(), filterLifecycleHistoryRows(), historyEntryApplyStatus(), lifecycleAuthorShort(), lifecycleChipClass(), lifecycleHistHashtag(), lifecycleLetterFromStatus() (+29 more)

### Community 7 - "Viz product modal"
Cohesion: 0.14
Nodes (31): animateClip(), armPendingThumbs(), armThumbLoadTimeout(), doneOk(), autoInit(), clearHeaderRevealInline(), clearRevealStyles(), clearThumbLoadWatch() (+23 more)

### Community 8 - "Lifecycle history admin"
Cohesion: 0.12
Nodes (34): applyStatusLetterFilter(), bindCopyButtons(), bindLifecycleControls(), bindMaterialFolderClicks(), bindPanelNav(), bindProductRowClicks(), clearSearchPanel(), clearStatusLetterFilter() (+26 more)

### Community 9 - "Grid reveal IO"
Cohesion: 0.12
Nodes (29): bestDisplayPath(), buildMaterialFolderRowHtml(), buildProductRowHtml(), canWriteLifecycleStatus(), carrierCardDomId(), carrierLabel(), codeFromRev(), collectProductLangs() (+21 more)

### Community 10 - "Explorer carrier cards"
Cohesion: 0.10
Nodes (24): adminSwitchHtml(), applyDobraKaloriaLogo(), authorPopupInnerHtml(), bindDamHeaderPopups(), bindSearchClearInputs(), bindThemeCustomizerSync(), ensureAccentCss(), ensureAdminModeSwitch() (+16 more)

### Community 11 - "Viz filters flags"
Cohesion: 0.13
Nodes (19): buildHeaderNav(), buildSidebarNav(), buildTrailCrumbs(), closeTopmostOverlayIfAny(), currentNavUrl(), currentPageKey(), ensureSidebarFooterEl(), escapeHtml() (+11 more)

### Community 12 - "Explorer add product"
Cohesion: 0.13
Nodes (26): applySearchResultsToPanel(), applySearchToPanel(), bindExplorerData(), bindGlobalExplorerFilters(), bindProductToolbar(), bindSearchPanelSync(), filterProductsForExplorerView(), filterSearchResponse() (+18 more)

### Community 13 - "Explorer search filters"
Cohesion: 0.15
Nodes (26): expandModalWizkiVariants(), findRevisionByFolderPath(), matchInProduct(), matchRev(), findRevisionInProduct(), matchRev(), findRevisionRecord(), findRevisionWizki() (+18 more)

### Community 14 - "Explorer materials"
Cohesion: 0.14
Nodes (21): renderSection(), ensureVizLangPickerFooterCss(), esc(), getLinkedMaterialIds(), init(), boot(), loadVizFlags(), mountSubcatRow() (+13 more)

### Community 15 - "Shell chrome boot"
Cohesion: 0.26
Nodes (20): Explorer return freeze, armExplorerIndexWatchdogs(), bindExplorerResumeListeners(), bindExplorerRetryButtons(), clearExplorerIndexWatchdogs(), dismissExplorerLoader(), explorerFolderEmpty(), explorerNeedsBind() (+12 more)

### Community 16 - "Loader overlay dock"
Cohesion: 0.17
Nodes (20): applyLifecycleStatusNow(), authHeaders(), bootLifecycleReconcile(), bridgeFetchJson(), clearLifecyclePending(), _dbgLifeLog(), ensureBridgeSession(), ensureExplorerIndexPoller() (+12 more)

### Community 17 - "Explorer pakiet files"
Cohesion: 0.19
Nodes (18): bindProductVariantStrip(), orderedButtons(), paintActive(), paintSelection(), selectedButtons(), buildProductVariantStripHtml(), enrichVizStudioMeta(), ensureVariantSelectCss() (+10 more)

### Community 18 - "Shell trail nav"
Cohesion: 0.21
Nodes (17): applyCollapsedIconTrackVars(), applySidebarCollapse(), applySidebarCollapsedClass(), clearSidebarMorphInline(), clearSidebarMorphVars(), collapsedLinkPadForIcon(), injectSidebarCollapse(), isSidebarCollapsedNow() (+9 more)

### Community 19 - "Doctrine runtime traps"
Cohesion: 0.15
Nodes (14): Explorer F5 white screen, html.dam-booting, abortAll(), softInterrupt(), unlockBootFailsafe(), finishBoot(), reveal(), loadGsapShell() (+6 more)

### Community 20 - "Viz assoc picker"
Cohesion: 0.19
Nodes (16): applyDeepLink(), enrichSearchProduct(), findProductByRevisionIndex(), findProductByRevisionPath(), getFileIndexIdSet(), isStatusStorePathKey(), normSearchText(), openProduct() (+8 more)

### Community 21 - "Explorer nav stack"
Cohesion: 0.30
Nodes (14): clearDockTimers(), dockAnchor(), dockToFab(), dockWithGsap(), done(), ensureCss(), ensureEl(), loadGsap() (+6 more)

### Community 22 - "Shell sticky chrome"
Cohesion: 0.19
Nodes (14): bindAdminControls(), syncAdminUi(), bindForcePreviewInteractions(), confirmAndRefreshIndex(), confirmInfoTileHtml(), ensureExplorerCtaUnifyCss(), exportStatusJson(), isAdminRole() (+6 more)

### Community 23 - "Loader progress"
Cohesion: 0.22
Nodes (14): countProductsUnderMaterialRoot(), getProductsForCanonCat(), isExplorerMaterialItem(), isExplorerProductItem(), isMaterialMarketingFolderName(), loadMaterialFolderBrowse(), loadMaterialRoots(), materialCategoryMetaText() (+6 more)

### Community 24 - "Explorer meta loads"
Cohesion: 0.31
Nodes (13): bindVizModalStudioControls(), cur(), frameHtml(), inActiveProductVariant(), orderedPersps(), orderedSizes(), paint(), go() (+5 more)

### Community 25 - "P0 control plane"
Cohesion: 0.29
Nodes (11): Ładowanie indeksu, autoMount(), bind(), applyQuery(), render(), buildGroupRow(), esc(), fetchTagGroups() (+3 more)

### Community 26 - "P1 rhythm tokens"
Cohesion: 0.32
Nodes (12): applyIndexRename(), bindCarrierInteractions(), toggleCarrierFromEl(), bridgeUrl(), openCreateVariantFromTemplates(), openElementsLinkPicker(), packPrintPackage(), persistElementsLinksLocal() (+4 more)

### Community 27 - "P1 ownership copy"
Cohesion: 0.23
Nodes (12): cancelVariantInfoHide(), closeVariantInfoPopover(), copyToClipboard(), folderDirFromPath(), openFolderPicker(), openCombo(), revealActiveFileInExplorer(), openThumbPicker() (+4 more)

### Community 28 - "P2 evidence"
Cohesion: 0.25
Nodes (11): loadAllMeta(), loadCarrierOverrides(), loadElementsLinks(), loadExplorerMetaLight(), loadLifecycleStore(), applyLifecyclePayload(), loadLifecycleFileFallback(), loadStatusStore() (+3 more)

### Community 29 - "Design system docs"
Cohesion: 0.36
Nodes (10): enrichVizRowFromProducts(), expandVizFromProducts(), firstWizkiPath(), isRealIndex(), normalizeVizRow(), pathLooksArchive(), resolveIndexBase(), revisionLangsForRow() (+2 more)

### Community 30 - "Shell menu inject"
Cohesion: 0.24
Nodes (10): applyLifecycleStatus(), openAddVariantModal(), openComboPick(), updateMarket(), overrideForRev(), parseCode(), resolveCarrierCode(), saveCarrierOverride() (+2 more)

### Community 31 - "Grid reveal modal"
Cohesion: 0.24
Nodes (10): applyUserAvatar(), avatarForEmail(), bindLogoutAndDeviceLinks(), goDeviceSessionPaths(), performLogout(), polishBalanceMenu(), polishGeexChrome(), polishUserMenu() (+2 more)

### Community 32 - "Search suggest"
Cohesion: 0.39
Nodes (9): bindAdminModeSwitch(), clearAdminChrome(), enforceAuth(), ensureAdminSession(), hasValidSession(), isAdminModeOn(), isAdminRole(), setAdminMode() (+1 more)

### Community 33 - "Explorer index load"
Cohesion: 0.28
Nodes (7): buildMessagesPopup(), buildNotificationsPopup(), enableMessagePopupResize(), escHtml(), findBadgeNearPopup(), formatBadgeCount(), setHeaderBadge()

### Community 34 - "Misc utilities"
Cohesion: 0.25
Nodes (9): adminVisibilityKey(), applyFilters(), applyStatusLetterFilterViz(), onSearch(), isAdminMode(), isAdminRole(), normalizeSearchText(), rowIsArchive() (+1 more)

### Community 35 - "Evidence screenshots"
Cohesion: 0.48
Nodes (7): applyExplorerIndexBundle(), clearExplorerRevealResidue(), explorerHasNumericCounts(), renderTagChips(), runDeferredLifecycleBoot(), scheduleDeferredSearchIndexLoad(), scheduleExplorerRender()

### Community 36 - "Thin community 36"
Cohesion: 0.40
Nodes (5): fetchWithTimeout(), hydrateExplorerProduct(), loadExplorerPrimaryIndex(), mergeHydratedExplorerProduct(), responseJsonOffMain()

### Community 37 - "Thin community 37"
Cohesion: 0.50
Nodes (5): renderGroup(), cardThumbSrc(), mediaPreviewUrl(), staticCardThumbFallback(), syncKar6xFrontThumb()

### Community 38 - "Thin community 38"
Cohesion: 0.83
Nodes (4): applyDiskRenameResult(), patchItem(), remapPath(), normPathKey()

### Community 39 - "Community 39"
Cohesion: 0.50
Nodes (4): Explorer P0 live screenshot evidence, Explorer page canvas dam-explorer.js, Global shell chrome dam-shell.js, Slim file-index fields=explorer bridge route

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (3): Frozen card anatomy owner dam-brand.css, Explorer P1 rhythm live screenshot, Vertical rhythm --dam-bento-gap 16px

## Ambiguous Edges - Review These
- `cursor-ide-browser stall` → `Explorer freeze after Wizualizacje`  [AMBIGUOUS]
  corpus/code-doctrine.md · relation: conceptually_related_to

## Knowledge Gaps
- **14 isolated node(s):** `ADR-0008`, `Explorer P0 live screenshot evidence`, `Explorer P1 rhythm live screenshot`, `Global shell chrome dam-shell.js`, `Frozen card anatomy owner dam-brand.css` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 49 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `cursor-ide-browser stall` and `Explorer freeze after Wizualizacje`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `init()` connect `Shell chrome boot` to `Explorer freeze restore`, `Lifecycle status disk`, `Viz product modal`, `Community 39`, `Viz filters flags`, `Explorer add product`, `Loader overlay dock`, `Explorer nav stack`, `Shell sticky chrome`, `P0 control plane`?**
  _High betweenness centrality (0.460) - this node is a cross-community bridge._
- **Why does `fetchVizIndexFromBridge()` connect `Explorer freeze restore` to `Search viz index`, `Explorer search filters`?**
  _High betweenness centrality (0.367) - this node is a cross-community bridge._
- **Why does `bindSearchBox()` connect `Explorer freeze restore` to `Shell chrome boot`?**
  _High betweenness centrality (0.249) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `init()` (e.g. with `getLinkedMaterialIds()` and `getLinkedVariantProductIds()`) actually correct?**
  _`init()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0008`, `Explorer P0 live screenshot evidence`, `Explorer P1 rhythm live screenshot` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Explorer freeze restore` be split into smaller, more focused modules?**
  _Cohesion score 0.07656341320864991 - nodes in this community are weakly interconnected._
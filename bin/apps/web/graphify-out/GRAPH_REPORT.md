# Graph Report - web  (2026-09-02)

## Corpus Check
- Large corpus: 412 files · ~1,706,048 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 4348 nodes · 10966 edges · 204 communities (177 shown, 11 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 372 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Inbox messages
- Tutorial overlay
- Project costs
- Add product wizard
- Bootstrap UI helpers
- Project page
- Bento resize
- Path bridge helpers
- Assoc editor
- Bootstrap vendor
- GSAP vendor
- jQuery vendor
- Settings page
- Badges and tags
- Tasks Asana
- Explorer lifecycle
- Branding filters
- DamLabels naming
- Projects grid
- Assoc save payload
- Visualizations grid
- Branding gallery
- Module 22
- Module 23
- Module 24
- Shared modal chrome
- Viz card flags
- Module 27
- Module 28
- Module 29
- Module 30
- Module 31
- Module 32
- Module 33
- Module 34
- Module 35
- Module 36
- Module 37
- Module 38
- Module 39
- Module 40
- Module 41
- Module 42
- Module 43
- Module 44
- Module 45
- Module 46
- Module 47
- Module 48
- Module 49
- DamSearch engine
- Module 51
- Module 52
- Module 53
- Module 54
- Module 55
- Module 56
- Module 57
- Module 58
- Module 59
- Module 60
- Module 61
- Module 62
- Module 63
- Module 64
- Tag bar search
- Module 66
- Module 67
- Module 68
- Module 69
- Module 70
- Module 71
- Module 72
- Module 73
- Module 74
- Module 75
- Module 76
- Module 77
- Module 78
- Module 79
- Module 80
- Module 81
- Module 82
- Module 83
- Module 84
- Module 85
- Module 86
- Module 87
- Module 88
- Module 89
- Module 90
- Module 91
- Module 92
- Module 93
- Module 94
- Module 95
- Module 96
- Module 97
- Module 98
- Module 99
- Module 100
- Module 101
- Module 102
- Module 103
- Module 104
- Module 105
- Module 106
- Module 107
- Module 108
- Module 109
- Module 110
- Module 111
- Module 112
- Module 113
- Module 114
- Module 115
- Module 116
- Module 117
- Module 118
- Module 119
- Module 120
- Module 121
- Module 122
- Module 123
- Module 124
- Module 125
- Module 126
- Module 127
- Module 128
- Module 129
- Module 130
- Module 131
- Module 132
- Search suggestions
- Module 134
- Module 135
- Module 136
- Module 137
- Module 138
- Module 139
- Module 140
- Module 141
- Module 142
- Module 143
- Module 144
- Module 145
- Module 146
- Module 147
- Module 148
- Module 149
- Module 150
- Module 151
- Module 152
- Module 153
- Module 154
- Module 155
- Module 156
- Module 157
- Module 158
- Module 159
- Module 160
- Module 161
- Module 162
- Module 163
- Search scope chips
- Search box binding
- Module 166
- Module 167
- Module 168
- Module 169
- Module 170
- Module 171
- Module 172
- Module 173
- Module 174
- Module 175
- Module 176
- Module 177
- Module 178
- Module 179
- Module 180
- Module 181
- Module 182
- Module 184
- Module 185
- Module 186
- Module 187
- Module 201

## God Nodes (most connected - your core abstractions)
1. `openProductModal()` - 75 edges
2. `paintPicker()` - 45 edges
3. `defineWidgets()` - 45 edges
4. `cs` - 40 edges
5. `renderMain()` - 38 edges
6. `loadLinkedBrandingMaterialsList()` - 34 edges
7. `openAsset()` - 33 edges
8. `esc()` - 32 edges
9. `renderTagFilters()` - 31 edges
10. `renderMeta()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `damFileSearch` --conceptually_related_to--> `DamSearch (globalna wyszukiwarka)`  [INFERRED]
  explorer.html → assets/js/dam-search.js
- `damProjectsSearch` --conceptually_related_to--> `DamSearch (globalna wyszukiwarka)`  [INFERRED]
  index.html → assets/js/dam-search.js
- `vizSearch` --conceptually_related_to--> `DamSearch (globalna wyszukiwarka)`  [INFERRED]
  visualizations.html → assets/js/dam-search.js
- `damBrandingSearch` --conceptually_related_to--> `DamSearch (globalna wyszukiwarka)`  [INFERRED]
  branding.html → assets/js/dam-search.js
- `Skanuj dysk` --conceptually_related_to--> `Odśwież z dysku`  [AMBIGUOUS]
  index.html → explorer.html

## Import Cycles
- None detected.

## Communities (204 total, 11 thin omitted)

### Community 0 - "Inbox messages"
Cohesion: 0.08
Nodes (76): actorFootHtml(), applyUrlTag(), authHeaders(), bind(), bindHistoryActions(), bindModeration(), after(), bridgeUrl() (+68 more)

### Community 1 - "Tutorial overlay"
Cohesion: 0.08
Nodes (72): animateBubbleIn(), applyExploreCopy(), applyPose(), bindCheerHooks(), boot(), buildExploreCompanion(), buildOverlay(), canCheer() (+64 more)

### Community 2 - "Project costs"
Cohesion: 0.07
Nodes (64): addDays(), applyProjectCosts(), authHeaders(), bindSync(), bridgeUrl(), easterSunday(), escapeHtml(), filteredProjects() (+56 more)

### Community 3 - "Add product wizard"
Cohesion: 0.08
Nodes (63): activeModalRoot(), appendDemoSuffixClient(), authHeaders(), bootstrapVariantList(), brandFromProductPath(), bridgeUrl(), categoryFolderName(), closeAnyModal() (+55 more)

### Community 4 - "Bootstrap UI helpers"
Cohesion: 0.07
Nodes (6): Bt, cs, d(), on(), remove(), gn()

### Community 5 - "Project page"
Cohesion: 0.08
Nodes (41): assetMatchesRevision(), bindMarketingTiles(), bindSlotRows(), boot(), brandingLinkForProduct(), bridgeUrl(), dash(), digitsOnly() (+33 more)

### Community 6 - "Bento resize"
Cohesion: 0.10
Nodes (56): applyStyles(), bindMove(), onMove(), onUp(), previewNeighborShift(), bindResize(), onMove(), onUp() (+48 more)

### Community 7 - "Path bridge helpers"
Cohesion: 0.12
Nodes (56): basename(), baseStorageKey(), bindPathActions(), bridgeAuthHeaders(), bridgeBase(), bridgeErrorMessage(), checkBridge(), copyPath() (+48 more)

### Community 8 - "Assoc editor"
Cohesion: 0.07
Nodes (49): adminModeOn(), allFileTileKey(), applyAllFileSoftHide(), assetDirKey(), assocSaveAssetKey(), bindAssocCtas(), bindAssocSection(), bindMaterialsPane() (+41 more)

### Community 9 - "Bootstrap vendor"
Cohesion: 0.09
Nodes (46): Ae(), be(), Ce(), D(), De(), di(), $e(), Ee() (+38 more)

### Community 10 - "GSAP vendor"
Cohesion: 0.05
Nodes (34): Ab(), Bb(), cb(), Context(), Ec(), ee(), fb(), Fc() (+26 more)

### Community 11 - "jQuery vendor"
Cohesion: 0.08
Nodes (38): Gw(), u(), A(), Ae(), b(), be(), Bt(), l() (+30 more)

### Community 12 - "Settings page"
Cohesion: 0.08
Nodes (48): applyElementyConvUi(), applySettingsVisibility(), authHeaders(), boot(), bridge(), esc(), escHtml(), filterJumpRegistry() (+40 more)

### Community 13 - "Badges and tags"
Cohesion: 0.09
Nodes (44): applyTagFilter(), badgeHtml(), bindClicks(), bindCopyOnRightClick(), brandingBadgeData(), brandingFileExt(), brandingFormatLabel(), brandingGradientTileClass() (+36 more)

### Community 14 - "Tasks Asana"
Cohesion: 0.09
Nodes (47): avatarColor(), bindHome(), countTab(), walk(), enrichTasks(), ensureTasksThemeRespectsPref(), esc(), filterTab() (+39 more)

### Community 15 - "Explorer lifecycle"
Cohesion: 0.09
Nodes (48): applyDeepLink(), applyIndexRename(), applyLifecycleStatusNow(), authHeaders(), bindAdminControls(), syncAdminUi(), bindCarrierInteractions(), bootLifecycleReconcile() (+40 more)

### Community 16 - "Branding filters"
Cohesion: 0.09
Nodes (46): activateTab(), appearanceKey(), applyBadgeFilter(), applyCollection(), applyDatePreset(), applyQuickSearch(), assetRoleChipsFromIndex(), bestTabForTagKey() (+38 more)

### Community 17 - "DamLabels naming"
Cohesion: 0.08
Nodes (31): carrierLabel(), carrierLabelLong(), carrierShort(), categoryCanonId(), categoryTitle(), cleanProductDisplayName(), detectMarketFromPath(), extractGram() (+23 more)

### Community 18 - "Projects grid"
Cohesion: 0.10
Nodes (45): applyFileIndexMeta(), bindProjectsSortControl(), boot(), cardCategoryLabel(), cardTitleHtml(), clearProjectsSearchFilters(), computeWideChecklist(), esc() (+37 more)

### Community 19 - "Assoc save payload"
Cohesion: 0.10
Nodes (43): applyAssocSaveSuccess(), assocPickerStartDir(), assocSavePayload(), authHeaders(), bustAssocThumbsInScope(), bustMaterialAssocCaches(), collectLinkedIdsFromCtx(), dedupeProductIds() (+35 more)

### Community 20 - "Visualizations grid"
Cohesion: 0.08
Nodes (42): applyCardZoom(), applyOverrideToItem(), basePreviewZoom(), bindCardZoomControl(), bridgeBase(), buildModalItems(), cancelVariantInfoHide(), clearChromeRevealInline() (+34 more)

### Community 21 - "Branding gallery"
Cohesion: 0.09
Nodes (40): applyBrandingCardZoom(), assetDirKey(), bindBrandingCardZoomControl(), bindTabs(), boot(), kickSearchIndex(), brandingCardZoomRoots(), buildBrandingGroupContext() (+32 more)

### Community 22 - "Module 22"
Cohesion: 0.16
Nodes (41): apiFetch(), authHeaders(), authSettings(), bridgeAuthUrl(), buildVariantEntry(), clearLocalAuth(), completeness(), deviceId() (+33 more)

### Community 23 - "Module 23"
Cohesion: 0.11
Nodes (42): buildBrandingPickerDisplayRows(), closePicker(), debounce(), esc(), expandPicksToAllProductRevisions(), flattenBrandingGroupSelection(), hydratePickerThumbs(), linkedMetaByIdFromRecords() (+34 more)

### Community 24 - "Module 24"
Cohesion: 0.12
Nodes (39): arm(), armLabel(), cleanupRing(), complete(), endHold(), fireConfirm(), onBlur(), onClickCapture() (+31 more)

### Community 25 - "Shared modal chrome"
Cohesion: 0.08
Nodes (38): assetTitleKey(), bindChromeFit(), bindEditableAssetTitle(), commit(), bindModalClose(), bindPreviewNav(), goTo(), paintBtns() (+30 more)

### Community 26 - "Viz card flags"
Cohesion: 0.12
Nodes (41): badgeTierOpt(), carrierHuman(), collectVariantIndexKeys(), countManualForProduct(), displayIndex(), ensureVizGridCardCss(), flagKey(), hasThumbOverride() (+33 more)

### Community 27 - "Module 27"
Cohesion: 0.09
Nodes (7): st, s(), xt, ct(), ut(), yt(), Z()

### Community 28 - "Module 28"
Cohesion: 0.10
Nodes (39): applyLifeHistPatches(), bindAddProductCtas(), bindCategoryAddButton(), categoryTitleOf(), diskPathShort(), enrichedProductTitle(), filterSourceFilesForView(), folderBasename() (+31 more)

### Community 29 - "Module 29"
Cohesion: 0.10
Nodes (41): applyLifecycleStatus(), bindCopyButtons(), bindLifecycleControls(), bindPanelNav(), bindProductRowClicks(), enrichSearchProduct(), findProductByRevisionIndex(), findProductByRevisionPath() (+33 more)

### Community 30 - "Module 30"
Cohesion: 0.15
Nodes (39): authHeaders(), bindActions(), bindConfigForms(), bridge(), cardHtml(), chipLabelForStatus(), configAccordion(), costRatesCard() (+31 more)

### Community 31 - "Module 31"
Cohesion: 0.09
Nodes (37): applyCardZoomPct(), assetFileBaseName(), assetIdChipHtml(), assetMatchesElementAssoc(), assocLabelRow(), assocPaneSkeletonCellsHtml(), assocPaneSkeletonHtml(), assocSkeletonRowOpacity() (+29 more)

### Community 32 - "Module 32"
Cohesion: 0.06
Nodes (41): sync-gc-viz-from-g visualization sync job, G:\Sprzedaż Marketing\GC WIZUALIZACJE, D:\Marketing\- EKSPORT\01 - PRODUCTS\- GC, Asana API consent, dam_consents (localStorage), Microsoft Graph consent (Teams + Outlook), Microsoft scopes: openid profile offline_access User.Read Mail.Read ChannelMessage.Read.All, OAuth callback http://127.0.0.1:8766/oauth/callback (+33 more)

### Community 33 - "Module 33"
Cohesion: 0.09
Nodes (40): applyPakietFileToProduct(), buildCurrentLifecycleRow(), captureLifecycleContext(), carrierCardExpandKey(), computeChecklist(), revisionHasElements(), dedupeLifecycleTwinRevisions(), elementsOpenPath() (+32 more)

### Community 34 - "Module 34"
Cohesion: 0.10
Nodes (35): asanaFormatDueLabel(), asanaLooksLikeProject(), asanaParseDue(), asanaShortPill(), asanaStartOfDay(), bindLayoutToggle(), brandingBridgeBase(), brandingHrefForAsset() (+27 more)

### Community 35 - "Module 35"
Cohesion: 0.10
Nodes (37): applySearchResultsToPanel(), applySearchToPanel(), bindExplorerData(), bindGlobalExplorerFilters(), bindMaterialFolderClicks(), bindSearchPanelSync(), clearSearchPanel(), countProductsUnderMaterialRoot() (+29 more)

### Community 36 - "Module 36"
Cohesion: 0.12
Nodes (34): _distinctive_tokens(), extract_skus(), filter_adequate_product_ids(), _fold(), _is_ultra_generic_phrase(), _norm(), _phrase_non_generic_token_count(), _phrases_from_product() (+26 more)

### Community 37 - "Module 37"
Cohesion: 0.07
Nodes (5): focusableChildren(), H, sn, W, Y

### Community 38 - "Module 38"
Cohesion: 0.14
Nodes (32): applyResultToExplorer(), authHeaders(), bridgeUrl(), coachHighlight(), collectSiblingJobs(), consumeCoachFromStorage(), ctxFromButton(), dryOne() (+24 more)

### Community 39 - "Module 39"
Cohesion: 0.13
Nodes (33): atomic_write_json(), detect_raster_background(), enrich_branding_taxonomy(), enrich_raster_backgrounds(), _file_matches(), format_technical_for(), image_has_transparent_pixels(), infer_asset_role() (+25 more)

### Community 40 - "Module 40"
Cohesion: 0.10
Nodes (34): bestDisplayPath(), toggleCarrierFromEl(), buildMaterialFolderRowHtml(), buildProductRowHtml(), carrierCardDomId(), carrierLabel(), codeFromRev(), collectProductLangs() (+26 more)

### Community 41 - "Module 41"
Cohesion: 0.17
Nodes (33): addDraftToInvoice(), applyInvoices(), authHeaders(), bindErpActions(), bridgeUrl(), buildMailBodyText(), copyMailBody(), ensureCtaStyles() (+25 more)

### Community 42 - "Module 42"
Cohesion: 0.16
Nodes (32): advanceSyncStep(), animateSyncToast(), applyPing(), applyStatus(), authHeaders(), bridgeBase(), check(), checkFull() (+24 more)

### Community 43 - "Module 43"
Cohesion: 0.15
Nodes (32): alignStackedToAssoc(), bridgeBase(), ensureThumbPickerTilesCss(), esc(), fetchJsonWithTimeout(), mediaPreviewUrl(), normPathKey(), open() (+24 more)

### Community 44 - "Module 44"
Cohesion: 0.14
Nodes (30): _association_file(), build_folder_stems(), build_product_stem_index(), cached_association_reverse(), cached_product_stem_index(), enrich_folder_groups(), extract_legacy_archive_tags(), _filter_product_ids() (+22 more)

### Community 45 - "Module 45"
Cohesion: 0.13
Nodes (31): activeFilterHint(), activeFilterLabels(), assetInSectionTab(), assetMatchesActiveTags(), assetMatchesAuthor(), assetMatchesCampaign(), assetMatchesChannel(), assetMatchesDateRange() (+23 more)

### Community 46 - "Module 46"
Cohesion: 0.18
Nodes (30): authHeaders(), autofitColumn(), bind(), bindColumnUi(), onMove(), onUp(), boot(), bridge() (+22 more)

### Community 47 - "Module 47"
Cohesion: 0.13
Nodes (29): media_type_for(), Zamknieta lista IPTC: image | vector | video | source | document., attach_product_links(), build_search_index(), build_tags(), catalog_index_map(), dedupe_by_path(), file_overlap_key() (+21 more)

### Community 48 - "Module 48"
Cohesion: 0.14
Nodes (30): badgesHtml(), brandingCardActionsHtml(), brandingCardDisplayAssets(), brandingCardIdChipHtml(), brandingCardIndexBlockHtml(), brandingCardIndexLabels(), brandingCardMetaHtml(), brandingCardSubtitle() (+22 more)

### Community 49 - "Module 49"
Cohesion: 0.13
Nodes (29): asanaHomePeopleHtml(), asanaHomeProjectsHtml(), asanaHomeTaskRowsHtml(), bindAsanaHomeWidget(), bindHonestThumbFallbacks(), brandingBadgesHtml(), brandingThumbPlaceholderDataUri(), brandingThumbUrl() (+21 more)

### Community 50 - "DamSearch engine"
Cohesion: 0.17
Nodes (27): appendFileIndexMatches(), bindHitsClick(), buildStructuredHits(), dedupeHits(), digitsOnly(), explorerShowAllEnabled(), getActiveFileIndex(), latestRevisions() (+19 more)

### Community 51 - "Module 51"
Cohesion: 0.20
Nodes (28): authHeaders(), boot(), bridge(), ensureInjectedCss(), esc(), isPlaceholderKod(), loadProductLabels(), loadQueue() (+20 more)

### Community 52 - "Module 52"
Cohesion: 0.15
Nodes (13): is_branding_grid_eligible(), Any, Return True when asset may appear in branding-grid-index/head and Branding UI., _atomic_write_json(), _build_head_assets(), compute_generation_id(), _is_head_graphic(), main() (+5 more)

### Community 53 - "Module 53"
Cohesion: 0.15
Nodes (27): applySave(), bindListInteractions(), customizeDescription(), customizeLabel(), customizeMeta(), defaultOrder(), ensureModal(), findWidget() (+19 more)

### Community 54 - "Module 54"
Cohesion: 0.17
Nodes (23): animateClip(), autoInit(), clearHeaderRevealInline(), clearRevealStyles(), ensureGridObserver(), initModalObserver(), isModalOverlay(), isVisible() (+15 more)

### Community 55 - "Module 55"
Cohesion: 0.11
Nodes (26): doCopy(), closeModal(), collectAssetLinkedProductIds(), add(), copyToClipboard(), effectiveLinkedProductIds(), enrichAssocOnOpen(), ensureGlobalMarketingIdCopy() (+18 more)

### Community 56 - "Module 56"
Cohesion: 0.13
Nodes (19): buildHeaderNav(), buildSidebarNav(), buildTrailCrumbs(), closeTopmostOverlayIfAny(), currentNavUrl(), currentPageKey(), ensureSidebarFooterEl(), escapeHtml() (+11 more)

### Community 57 - "Module 57"
Cohesion: 0.15
Nodes (24): allCarrierTypes(), applyLightProductCatalogFromSearch(), bilingualSubcatLabel(), collectIndexOptions(), collectSubcategoryOptions(), addSub(), confirmBrandSafety(), confirmBrandTagChange() (+16 more)

### Community 58 - "Module 58"
Cohesion: 0.13
Nodes (26): addTagButtonLabel(), bindTagPopoverReposition(), closePopover(), ensureTagPopoverBtnStyles(), ensureTagPopoverWideCss(), findTagPopoverScrollRoots(), onDocClick(), onDocKey() (+18 more)

### Community 59 - "Module 59"
Cohesion: 0.15
Nodes (27): expandModalWizkiVariants(), findRevisionByFolderPath(), matchInProduct(), matchRev(), findRevisionInProduct(), matchRev(), findRevisionRecord(), folderPathFromPicked() (+19 more)

### Community 62 - "Module 62"
Cohesion: 0.18
Nodes (25): assetHasLinks(), authHeaders(), bindSearch(), run(), boot(), bridge(), currentItem(), decide() (+17 more)

### Community 63 - "Module 63"
Cohesion: 0.13
Nodes (25): buildVizStudioModel(), heroesFor(), enrichVizFile(), fileExt(), isArchiveFile(), isVizImageFile(), mediaUrl(), onEsc() (+17 more)

### Community 64 - "Module 64"
Cohesion: 0.16
Nodes (25): assocEmptyMaterialsHtml(), assocGroupDisplayLabel(), bindElementyToggle(), bindIdChipCopy(), bindLinkedAssetClicks(), openWithLinked(), captureAssocGridThumbs(), clearAssocPaneLoadingState() (+17 more)

### Community 65 - "Tag bar search"
Cohesion: 0.13
Nodes (24): autoMount(), bind(), applyQuery(), render(), buildGroupRow(), esc(), fetchTagGroups(), loadTagGroups() (+16 more)

### Community 66 - "Module 66"
Cohesion: 0.13
Nodes (26): _a(), ac(), _assertThisInitialized(), Co(), db(), ea(), eb(), ga() (+18 more)

### Community 67 - "Module 67"
Cohesion: 0.17
Nodes (24): enrich_all_branding_taxonomy(), extract_theme_tags(), cached_path_tokens(), enrich_all_assets(), enrich_asset_tags(), extract_appearance_from_text(), extract_folder_segment_tags(), extract_placement_tags() (+16 more)

### Community 68 - "Module 68"
Cohesion: 0.12
Nodes (23): adminSwitchHtml(), applyDobraKaloriaLogo(), authorPopupInnerHtml(), bindDamHeaderPopups(), bindSearchClearInputs(), bindThemeCustomizerSync(), ensureAccentCss(), ensureAdminModeSwitch() (+15 more)

### Community 69 - "Module 69"
Cohesion: 0.16
Nodes (24): bindSearchPreview(), activate(), bridgeUrl(), cachedPickerListThumb(), loadOne(), isPlaceholderThumb(), listSafeThumb(), normalizeBridgeMediaUrl() (+16 more)

### Community 70 - "Module 70"
Cohesion: 0.14
Nodes (18): blob(), digitsOnly(), extractMonthYear(), formatMarketingAssetId(), isBanner(), isGoogle(), isKeyVisual(), isMeta() (+10 more)

### Community 71 - "Module 71"
Cohesion: 0.14
Nodes (24): bindVizModalStudioControls(), cur(), frameHtml(), inActiveProductVariant(), orderedPersps(), orderedSizes(), paint(), go() (+16 more)

### Community 72 - "Module 72"
Cohesion: 0.15
Nodes (23): asset(), editableFilesFor(), push(), pushIfSource(), linkedBrandingProductTokens(), add(), loadLinkedBrandingAssetsForProduct(), loadLinkedBrandingForContext() (+15 more)

### Community 73 - "Module 73"
Cohesion: 0.15
Nodes (20): brandingAssetMatches(), brandingPickerBlocksIndexLoad(), digitsOnly(), ensureBrandingCounts(), ensureSearchIndex(), attemptLoad(), filterBrandingAssets(), getBrandingCount() (+12 more)

### Community 74 - "Module 74"
Cohesion: 0.23
Nodes (21): authHeaders(), bridgeUrl(), clampCardZoom(), clampPageSize(), clampVizScale(), collectLegacyMigrationPatch(), getAssocSplit(), getCardZoom() (+13 more)

### Community 75 - "Module 75"
Cohesion: 0.13
Nodes (21): adminVisibilityKey(), applyFilters(), getLinkedMaterialIds(), init(), boot(), onSearch(), isAdminMode(), isAdminRole() (+13 more)

### Community 77 - "Module 77"
Cohesion: 0.13
Nodes (17): apply_product_aliases(), classify_slot_role(), infer_carrier_from_files(), is_wizki_dir(), load_product_aliases(), looks_like_date_token(), normalize_carrier_code(), parse_carrier() (+9 more)

### Community 78 - "Module 78"
Cohesion: 0.16
Nodes (21): build_search(), build_tag_groups(), canonicalize_tag(), extract_tags(), finalize_tags(), is_lang_evidence_slot(), is_noise_tag(), merge_global_tag_groups() (+13 more)

### Community 79 - "Module 79"
Cohesion: 0.15
Nodes (21): asAssetList(), countSliceAssets(), fmtElements(), fmtFiles(), fmtGridCount(), groupBrandingAssets(), groupDisplayLabel(), groupKeyVisualAssets() (+13 more)

### Community 80 - "Module 80"
Cohesion: 0.17
Nodes (21): badgesHtml(), bindProduktyToggle(), dedupeSourceFilesByExt(), esc(), extTagClass(), firstLinkedProductId(), loadIndexAssets(), bindSourceButtons() (+13 more)

### Community 81 - "Module 81"
Cohesion: 0.15
Nodes (21): classifyAssocAsset(), fileExt(), hasUsableMarketingPreview(), isCampaignMarketingPath(), isEditableSourceAsset(), isElementPath(), isLikelyPhoneDumpAsset(), isLinksRawPath() (+13 more)

### Community 82 - "Module 82"
Cohesion: 0.19
Nodes (19): _looks_like_marketing_root(), _machine_config_bases(), marketing_candidates(), Path, Shared marketing root resolution for DAM index/build scripts. Order (HARD,…, Read base_path from desktop machine-config (per Windows user)., Prefer configured / M: root over legacy X:/Marketing., All candidate roots for existence checks (deduped). (+11 more)

### Community 83 - "Module 83"
Cohesion: 0.19
Nodes (20): brandingAssetFromIndex(), brandingEntryToPickerRow(), brandingThumbUrl(), collectBrandingPickerRows(), enrichBrandingAssetsByIds(), fetchPickerJson(), fileExtPicker(), isBrandingPickerDeliverable() (+12 more)

### Community 84 - "Module 84"
Cohesion: 0.19
Nodes (20): buildLifecycleModalRows(), filterLifecycleHistoryRows(), historyEntryApplyStatus(), lifecycleAuthorShort(), lifecycleChipClass(), lifecycleHistHashtag(), lifecycleLetterFromStatus(), openLifecycleHistoryModal() (+12 more)

### Community 86 - "Module 86"
Cohesion: 0.14
Nodes (13): Ca(), P(), H(), i(), ht(), i(), M(), nt() (+5 more)

### Community 87 - "Module 87"
Cohesion: 0.22
Nodes (19): _blob_has_token(), classify_element_assoc_terms(), enrich_element_associations(), ensure_assoc_in_search_blob(), is_any_links_or_elementy_path(), is_materialy_elementy_path(), is_product_element_path(), is_product_links_path() (+11 more)

### Community 88 - "Module 88"
Cohesion: 0.24
Nodes (19): build_entry(), col_map(), compute_tags(), cross_ref_products(), extract_automat_alias(), find_header(), import_from_rows(), import_path() (+11 more)

### Community 89 - "Module 89"
Cohesion: 0.16
Nodes (17): applyShiftToScope(), bindShiftHoverHost(), setShift(), ensureFileIndexForPicker(), ensureGlobalShiftKeyLatch(), onKey(), scopeOpen(), ensureInjectedCss() (+9 more)

### Community 90 - "Module 90"
Cohesion: 0.19
Nodes (19): assocMaterialGroupKey(), assocMaterialGroupScope(), assocPickerOpen(), baseNameNoExt(), creativeKey(), dedupeVariantsByCreative(), dirOfPath(), familyCreativeKey() (+11 more)

### Community 91 - "Module 91"
Cohesion: 0.22
Nodes (17): adminModeOn(), buildBodyHtml(), card(), closeHelp(), ensureFab(), ensureModal(), fillModalBody(), isAdminRole() (+9 more)

### Community 92 - "Module 92"
Cohesion: 0.23
Nodes (18): bindAll(), bindElement(), bindFacetTag(), ensureFacetTip(), escapeTipText(), facetHintDismissed(), facetTagDesc(), getOrCreateTip() (+10 more)

### Community 93 - "Module 93"
Cohesion: 0.15
Nodes (19): Aa(), Animation(), be(), _d(), fa(), ia(), ie(), ja() (+11 more)

### Community 94 - "Module 94"
Cohesion: 0.14
Nodes (17): buildAssocExclude(), addIdx(), collectProductPickerRows(), collectVizGridGroupedRows(), isVisualizationLike(), latestProductIndexBase(), linkedProductIndexFallback(), mapEnrichedLinkedProducts() (+9 more)

### Community 95 - "Module 95"
Cohesion: 0.30
Nodes (17): addListenerOnce(), brandLabel(), cloneBrands(), commitBrands(), init(), closePanel(), getOrCreatePanel(), openPanel() (+9 more)

### Community 96 - "Module 96"
Cohesion: 0.19
Nodes (18): assetBlobNorm(), assetMatchesCanonicalFacet(), assetMatchesSearchQuery(), assocChipLabel(), associationProductIdsForTokens(), buildDiscoveryFilterGroups(), findThumbForTile(), isCanonicalCovered() (+10 more)

### Community 97 - "Module 97"
Cohesion: 0.24
Nodes (17): applyNormalizedPath(), boot(), ensureCss(), ensureFocusStyle(), esc(), focusSection(), mount(), bindDeleteButton() (+9 more)

### Community 98 - "Module 98"
Cohesion: 0.20
Nodes (18): applyAssocSplitRatio(), assocSplitStorageKey(), bindAssocSplitterDrag(), currentRatio(), onPointerDown(), onMove(), onUp(), pid() (+10 more)

### Community 99 - "Module 99"
Cohesion: 0.12
Nodes (18): archive_looks_like_print(), classify_special_document(), detect_lang(), detect_lang_explicit(), file_entry(), is_archive_name(), _is_elements_dirname(), is_viz_image_name() (+10 more)

### Community 100 - "Module 100"
Cohesion: 0.18
Nodes (16): bridgeUrl(), captureVideoPosterFrame(), elementyToggleBlockHtml(), heroSrcFromAsset(), maybeCapture(), isRasterPreviewable(), isVideoAsset(), linkedBrandingCardHtml() (+8 more)

### Community 101 - "Module 101"
Cohesion: 0.28
Nodes (16): authHeaders(), bridgeBase(), check(), ensureBridgeSession(), ensureOfflineBar(), ensureUi(), reloadIndexesGlobally(), rootPath() (+8 more)

### Community 102 - "Module 102"
Cohesion: 0.21
Nodes (17): applyCollapsedIconTrackVars(), applySidebarCollapse(), applySidebarCollapsedClass(), clearSidebarMorphInline(), clearSidebarMorphVars(), collapsedLinkPadForIcon(), injectSidebarCollapse(), isSidebarCollapsedNow() (+9 more)

### Community 103 - "Module 103"
Cohesion: 0.25
Nodes (17): adminModeOn(), applyTagPickerChoice(), autoEnableAdminModeIfPrivileged(), bridgeAuthHeaders(), bridgeUrl(), decideProposal(), fetchProposals(), isAdmin() (+9 more)

### Community 105 - "Module 105"
Cohesion: 0.16
Nodes (16): dedupe_lifecycle_folder_twins(), finalize_revision_groups(), infer_index_from_files(), parse_date(), parse_index(), Carrier guess + is_latest (wspolne dla live i archiwum)., Skan folderow-wariantow w katalogu produktu (live lub archiwum)., Usun koncowke statusu folderu: - F / - X / - D. (+8 more)

### Community 106 - "Module 106"
Cohesion: 0.17
Nodes (16): cleanFolderName(), fileStem(), humanizeCampaignLabel(), humanizeMarketingFilename(), isGenericAppearanceTag(), isGenericFolderName(), isNumberedBucketFolder(), isTechnicalFolderName() (+8 more)

### Community 107 - "Module 107"
Cohesion: 0.27
Nodes (14): buildCtx(), enrichPanelTask(), escapeHtml(), fillSidePanel(), fillTeamsPanel(), formatDate(), init(), loadVizFlags() (+6 more)

### Community 108 - "Module 108"
Cohesion: 0.31
Nodes (15): closePopover(), enhanceField(), ensurePopover(), init(), isSameDate(), onKeyDown(), onOutsideClick(), openPopover() (+7 more)

### Community 109 - "Module 109"
Cohesion: 0.21
Nodes (16): bindProductVariantStrip(), orderedButtons(), paintActive(), paintSelection(), selectedButtons(), buildProductVariantStripHtml(), ensureVariantSelectCss(), filterUnlinkedVariants() (+8 more)

### Community 110 - "Module 110"
Cohesion: 0.22
Nodes (15): Counter, author_search_tokens(), find_asana(), first_name(), load_author_by_index(), load_product_people(), main(), norm() (+7 more)

### Community 111 - "Module 111"
Cohesion: 0.29
Nodes (14): _adjust_to_target(), _ancestors_up_to(), build_all_segments(), _child_dirs_with_media(), collect_folder_stats(), FolderStats, _initial_roots(), is_media_file() (+6 more)

### Community 112 - "Module 112"
Cohesion: 0.18
Nodes (16): _atomic_write_json(), attach_marketing_links(), count_files_in_dir(), discover_marketing_materials(), _ensure_roots(), _is_valid_jpeg(), main(), merge_product_catalog_packaging() (+8 more)

### Community 113 - "Module 113"
Cohesion: 0.22
Nodes (14): push(), buildAsanaProjectCatalog(), add(), buildVizThumbByIndex(), bulkMtimeMinutes(), flattenProductTags(), matchAsanaProject(), normDashText() (+6 more)

### Community 114 - "Module 114"
Cohesion: 0.30
Nodes (14): clearDockTimers(), dockAnchor(), dockToFab(), dockWithGsap(), done(), ensureCss(), ensureEl(), loadGsap() (+6 more)

### Community 115 - "Module 115"
Cohesion: 0.26
Nodes (12): checkIndex(), emit(), isEnabled(), loadSeen(), permission(), saveSeen(), setEnabled(), showNotification() (+4 more)

### Community 116 - "Module 116"
Cohesion: 0.15
Nodes (15): apply_brand_lang_baseline(), apply_lang_overrides(), canonicalize_lang_code(), infer_langs_from_files(), is_lang_evidence_file(), load_lang_overrides(), parse_folder_langs(), parse_langs_from_text() (+7 more)

### Community 117 - "Module 117"
Cohesion: 0.18
Nodes (14): bindCards(), bindEditableCardTitles(), bindMetaTooltips(), bindVideoPosterFallback(), campaignLabel(), filteredAssets(), getCampaignList(), hydrateVideoPosters() (+6 more)

### Community 118 - "Module 118"
Cohesion: 0.21
Nodes (14): allIds(), allowedForRole(), buildDraftFromLayout(), ensureDashWinDelegation(), loadLayout(), migrateAsanaHomeOrder(), migrateNewestProductsFOrder(), migrateProjectsInProgressOrder() (+6 more)

### Community 119 - "Module 119"
Cohesion: 0.23
Nodes (14): applyLifecycleFromHistRow(), applyLifeHistFetchResult(), bindChangeLogBar(), bridgeBase(), fetchLifeHistBundle(), formatChangeLogEntry(), formatChangeLogTs(), mountChangeLogBarInSearchScope() (+6 more)

### Community 120 - "Module 120"
Cohesion: 0.22
Nodes (14): bindLifeHistRoot(), allRows(), bindRowActions(), repaint(), visibleRows(), changelogChipClass(), esc(), findLifeRowById() (+6 more)

### Community 121 - "Module 121"
Cohesion: 0.36
Nodes (13): bindClicks(), bindErrors(), bindFetch(), bindNavigation(), bridgeBase(), describeClick(), ensureSession(), flush() (+5 more)

### Community 122 - "Module 122"
Cohesion: 0.23
Nodes (13): apply_background_scan_cache(), Carry-over wynikow skanu do assetow (rebuild indeksu nie gubi pixel-scanu)., _scan_cache_key(), apply_branding_assoc_overrides(), apply_global_product_links(), build_variant_to_product_map(), extract_variant_ids_from_asset(), Any (+5 more)

### Community 123 - "Module 123"
Cohesion: 0.19
Nodes (13): assetDisplayPriority(), assetSectionId(), compareAssetsForDisplay(), currentSortMode(), extractYearFromAsset(), filterByDiscovery(), filterByWhen(), folderClusterRank() (+5 more)

### Community 124 - "Module 124"
Cohesion: 0.26
Nodes (12): bindQuickLinksWidget(), buildQuickLinksBodyHtml(), closeQuickLinksPicker(), loadQuickLinkKeys(), openQuickLinksPicker(), quickLinksFallbackPool(), quickLinksPool(), quickLinksStorageKey() (+4 more)

### Community 125 - "Module 125"
Cohesion: 0.23
Nodes (9): bridgeUrl(), createPoller(), kick(), schedule(), tick(), isRunning(), damBrandingRebuild, branding.html (Branding) (+1 more)

### Community 126 - "Module 126"
Cohesion: 0.26
Nodes (13): changelogAuthorShort(), changeLogEntryParts(), changeLogRowDetail(), humanCarrierForLog(), humanDiskStatusLabel(), lifeHistHashtag(), lifeHistStatusCode(), mergeLifeHistRows() (+5 more)

### Community 127 - "Module 127"
Cohesion: 0.31
Nodes (12): enrichVizRowFromProducts(), expandVizFromProducts(), firstWizkiPath(), isRealIndex(), labelForLang(), normalizeVizRow(), pathLooksArchive(), populateLangFilter() (+4 more)

### Community 128 - "Module 128"
Cohesion: 0.35
Nodes (11): boot(), bridgeUrl(), checkRemote(), cmpVer(), ensureBanner(), ensureVersionPill(), hardReload(), parseVer() (+3 more)

### Community 129 - "Module 129"
Cohesion: 0.23
Nodes (12): brandingAssetMtimeMs(), collectRecentBrandingThumbs(), dirnamePath(), folderLabel(), groupBrandingAssets(), isBrandingLatestSourceFile(), isBrandingWidgetThumb(), isRasterPreviewPath() (+4 more)

### Community 130 - "Module 130"
Cohesion: 0.21
Nodes (12): bindForcePreviewInteractions(), bindProductToolbar(), ensureExplorerCtaUnifyCss(), openAddVariantModal(), openComboPick(), updateMarket(), close(), saveCarrierOverride() (+4 more)

### Community 131 - "Module 131"
Cohesion: 0.30
Nodes (12): associationsFooterHtml(), folderVariantsHtml(), isPhantomMaterialVariant(), isPhantomProductIndex(), isSourceVariantFile(), materialSiblingTileLabel(), productIndexKeyFromVariant(), productIndexVariantsHtml() (+4 more)

### Community 132 - "Module 132"
Cohesion: 0.33
Nodes (9): applyFallbackEl(), bridgeUrl(), fallbackTitle(), fileAvailability(), mediaPreviewUrl(), onErrorTitle(), thumbCacheUrl(), toLocal() (+1 more)

### Community 133 - "Search suggestions"
Cohesion: 0.33
Nodes (11): attach(), hide(), paint(), refresh(), attachAll(), ensureSuggestCss(), ensureTagKeys(), esc() (+3 more)

### Community 134 - "Module 134"
Cohesion: 0.20
Nodes (3): damCloseSidebar(), damIsMobileNav(), damOpenSidebar()

### Community 135 - "Module 135"
Cohesion: 0.24
Nodes (11): build_linked_product_meta(), build_product_name_index(), cached_product_name_index(), match_products_by_display_names(), (normalized phrase, product_id, display_name) posortowane po dlugosci frazy…, resolve_viz_thumb(), _link_new_elements(), _load_build_branding_index() (+3 more)

### Community 136 - "Module 136"
Cohesion: 0.35
Nodes (11): match_products_by_associations(), Laczy wszystkie strategie dopasowania produktow dla folderu kampanii., resolve_folder_products(), segment_matches_asset(), find_segment(), link_products_from_text(), load_json(), main() (+3 more)

### Community 137 - "Module 137"
Cohesion: 0.33
Nodes (11): cell_at(), col_map(), is_header_row(), load_existing_links(), load_rows_xlsx(), main(), norm_header(), norm_key() (+3 more)

### Community 138 - "Module 138"
Cohesion: 0.29
Nodes (8): assetRoleLabel(), assetRoleOptions(), effectiveBackground(), isEffectiveTransparent(), isEffectiveWhite(), isGraphicMediaType(), mediaTypeLabel(), normalizeMediaType()

### Community 139 - "Module 139"
Cohesion: 0.24
Nodes (11): isBrandingMaterialId(), looksLikeFullPath(), looksLikeIndexChipLabel(), pickerCompactMetaLine(), pickerFileBasename(), pickerFileExt(), pickerItemDisplayTitle(), pickerMarketingId() (+3 more)

### Community 140 - "Module 140"
Cohesion: 0.29
Nodes (7): afterOverlayApplied(), applyTranslations(), buildSwitcher(), loadLang(), markReady(), nbspPl(), t()

### Community 141 - "Module 141"
Cohesion: 0.29
Nodes (7): bridgeHealth(), bridgeUrl(), ensureServices(), requestEnsureServices(), uiOrigin(), waitBridgeUp(), tick()

### Community 142 - "Module 142"
Cohesion: 0.35
Nodes (9): bridgeUrl(), close(), esc(), loadLastChannels(), onKey(), open(), saveChannels(), showToast() (+1 more)

### Community 144 - "Module 144"
Cohesion: 0.36
Nodes (10): date, hourly_rate(), main(), match_invoices(), match_task_hours(), norm(), parse_date(), primary_project() (+2 more)

### Community 145 - "Module 145"
Cohesion: 0.22
Nodes (10): carrier_label_pl(), collect_viz_latest(), is_mix_product(), is_viz_image(), lang_label(), pick_thumb_file(), Priority: FRONT-S (lekki podglad), potem S-SKLEP, FRONT-L/XL, inne FRONT, PREV.…, Unikalna nazwa miniatury - NIGDY wspolne unknown_pl.jpg dla wielu produktow. (+2 more)

### Community 146 - "Module 146"
Cohesion: 0.27
Nodes (10): closeActionMenu(), closeActionMenuOnKey(), closeActionMenuOnOutside(), isPhantomProductIndex(), mergeVariantIdsForProducts(), openActionMenu(), revisionVariantIdsForProduct(), add() (+2 more)

### Community 147 - "Module 147"
Cohesion: 0.24
Nodes (10): applyUserAvatar(), avatarForEmail(), bindLogoutAndDeviceLinks(), goDeviceSessionPaths(), performLogout(), polishBalanceMenu(), polishGeexChrome(), polishUserMenu() (+2 more)

### Community 148 - "Module 148"
Cohesion: 0.36
Nodes (10): changeHistoryTriggerBtns(), closeChangeHistoryPopover(), closeLifeHistOverlay(), onChangeHistoryEscape(), onChangeHistoryOutsideClick(), onLifeHistOverlayEsc(), openChangeHistoryPopover(), openLifeHistOverlay() (+2 more)

### Community 149 - "Module 149"
Cohesion: 0.31
Nodes (7): main(), ocr_image(), Path, video_frame(), CANONICAL_TAGS (facet:*), FOLDER_PRODUCT_HINTS, Wyszukiwanie brandingu README

### Community 150 - "Module 150"
Cohesion: 0.42
Nodes (9): apply_queue(), link_by_index(), link_by_name(), link_by_pdfs(), load_json(), main(), product_maps(), Path (+1 more)

### Community 151 - "Module 151"
Cohesion: 0.40
Nodes (9): is_project_file(), iter_revision_dirs(), main(), norm(), Path, Zwraca kandydata (dict) jesli PROJEKT jest pusty a MATERIALY ma pliki…, scan_variant(), slot_kind() (+1 more)

### Community 152 - "Module 152"
Cohesion: 0.33
Nodes (8): compactDashMinSizes(), dashBentoItemsOverlap(), mountDashBento(), apply(), collectNoStretch(), widgetSig(), repairDashBentoLayout(), syncQuickLinksLayout()

### Community 153 - "Module 153"
Cohesion: 0.39
Nodes (9): bindAdminModeSwitch(), clearAdminChrome(), enforceAuth(), ensureAdminSession(), hasValidSession(), isAdminModeOn(), isAdminRole(), setAdminMode() (+1 more)

### Community 154 - "Module 154"
Cohesion: 0.28
Nodes (7): buildMessagesPopup(), buildNotificationsPopup(), enableMessagePopupResize(), escHtml(), findBadgeNearPopup(), formatBadgeCount(), setHeaderBadge()

### Community 155 - "Module 155"
Cohesion: 0.25
Nodes (9): finishBoot(), reveal(), loadGsapShell(), finish(), pageReadyMark(), purgeLegacyPageSkeleton(), revealAfterOverlayReady(), scheduleBootReveal() (+1 more)

### Community 156 - "Module 156"
Cohesion: 0.22
Nodes (7): branding, dash, fs, jsDir, path, truth, widgets

### Community 157 - "Module 157"
Cohesion: 0.54
Nodes (7): init(), itemLabel(), onMutations(), rebindTips(), tipAllInDocument(), tipForItem(), tipMenu()

### Community 158 - "Module 158"
Cohesion: 0.61
Nodes (7): collect_from_elements_dir(), file_entry(), find_elements(), is_elements_dir(), main(), norm(), Path

### Community 159 - "Module 159"
Cohesion: 0.54
Nodes (7): build_gc_revision_map(), copy_never_overwrite(), ensure_dir(), find_indexes(), main(), Path, Map index_base -> list of revision dirs that contain 4 - VISUALS (or create…

### Community 160 - "Module 160"
Cohesion: 0.25
Nodes (6): code, fs, path, root, saveIdx, saveSlice

### Community 161 - "Module 161"
Cohesion: 0.25
Nodes (8): Kalkulator kosztów (costs.html), Rozliczenia (billing placeholder), ERP CSV import (invCsvImport), ERP bidirectional sync (ERP ↔ DAM), Header search placeholder (Szukaj...), Faktury (invoice history), Invoice status filters (all/paid/pending/overdue), dam_theme_pref localStorage

### Community 162 - "Module 162"
Cohesion: 0.52
Nodes (7): applyPageSize(), bindBrandingPageSizeControl(), onDraft(), clampPageSize(), persistPageSize(), readStoredPageSize(), syncPageSizeControls()

### Community 163 - "Module 163"
Cohesion: 0.43
Nodes (5): previewMockHtml(), barTrack(), listRows(), skLine(), skRow()

### Community 164 - "Search scope chips"
Cohesion: 0.48
Nodes (7): bindScopeChips(), paint(), getScope(), getScopeMode(), loadScopeFromStorage(), setScope(), setScopeMode()

### Community 165 - "Search box binding"
Cohesion: 0.52
Nodes (7): bindSearchBox(), notifyResults(), render(), runSearch(), buildHitItemHtml(), escapeHtml(), renderHitsHtml()

### Community 166 - "Module 166"
Cohesion: 0.62
Nodes (6): apply(), boot(), currentPref(), normalizePref(), resolve(), systemDark()

### Community 167 - "Module 167"
Cohesion: 0.29
Nodes (6): hb(), lb(), oa(), ob(), Wa(), at()

### Community 168 - "Module 168"
Cohesion: 0.33
Nodes (7): is_category_archive_folder(), merge_category_archive(), Folder kategorii — ARCHIWUM (nie rozszerzenie .zip)., Usun sufiks ' - F/X/D' z nazwy folderu produktu w archiwum., Dolacz warianty z — ARCHIWUM do istniejacych produktow (bez duplikatu produktu)., scan_root(), strip_product_folder_status_suffix()

### Community 169 - "Module 169"
Cohesion: 0.67
Nodes (5): apply(), current(), hexToRgb(), normalizeHex(), reset()

### Community 170 - "Module 170"
Cohesion: 0.47
Nodes (4): bindChecklistRows(), bindWinButtons(), winButtonHtml(), winExplorerSvg()

### Community 171 - "Module 171"
Cohesion: 0.67
Nodes (5): load_index(), main(), norm_path(), Path, scan_disk()

### Community 172 - "Module 172"
Cohesion: 0.60
Nodes (5): fetch_price(), load_json(), main(), Path, save_json()

### Community 173 - "Module 173"
Cohesion: 0.33
Nodes (4): code, fs, path, vizPath

### Community 174 - "Module 174"
Cohesion: 0.33
Nodes (4): code, fs, path, vizPath

### Community 175 - "Module 175"
Cohesion: 0.33
Nodes (4): code, fs, path, vizPath

### Community 176 - "Module 176"
Cohesion: 0.70
Nodes (4): abortAll(), hardReload(), onHardResetKey(), softInterrupt()

### Community 177 - "Module 177"
Cohesion: 0.60
Nodes (4): crop_content(), main(), Przytnij do zawartosci (bbox alpha) + maly margines., remove_bg()

### Community 178 - "Module 178"
Cohesion: 0.60
Nodes (4): apply_text(), main(), _needs_boundary(), Short/stem replacements are unsafe as raw substring replace.

### Community 179 - "Module 179"
Cohesion: 0.83
Nodes (3): pick(), pickOne(), poseUrl()

### Community 180 - "Module 180"
Cohesion: 0.83
Nodes (4): applyDiskRenameResult(), patchItem(), remapPath(), normPathKey()

### Community 181 - "Module 181"
Cohesion: 1.00
Nodes (3): build_reverse(), main(), norm()

### Community 182 - "Module 182"
Cohesion: 0.83
Nodes (3): label_for(), main(), pack_id()

## Ambiguous Edges - Review These
- `dam-tag-edit.js` → `inbox.html (Wiadomości)`  [AMBIGUOUS]
  inbox.html · relation: conceptually_related_to
- `Skanuj dysk` → `Odśwież z dysku`  [AMBIGUOUS]
  index.html · relation: conceptually_related_to
- `damDevicePathsRoot (device paths panel)` → `D:\Marketing\- EKSPORT\01 - PRODUCTS\- GC`  [AMBIGUOUS]
  data/sync-gc-viz-log.txt · relation: conceptually_related_to

## Knowledge Gaps
- **46 isolated node(s):** `ADR-0008`, `fs`, `path`, `jsDir`, `dash` (+41 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 439 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `dam-tag-edit.js` and `inbox.html (Wiadomości)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Skanuj dysk` and `Odśwież z dysku`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `damDevicePathsRoot (device paths panel)` and `D:\Marketing\- EKSPORT\01 - PRODUCTS\- GC`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `a()` connect `jQuery vendor` to `Module 80`, `Module 90`, `Module 86`, `Module 167`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `asset()` connect `Module 72` to `Module 64`, `Module 80`, `Assoc save payload`, `Module 22`, `Shared modal chrome`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `restoreSeed()` connect `Assoc save payload` to `Module 72`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `paintPicker()` (e.g. with `onDocClick()` and `onDocKey()`) actually correct?**
  _`paintPicker()` has 3 INFERRED edges - model-reasoned connections that need verification._
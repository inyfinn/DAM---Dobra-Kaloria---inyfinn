<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\ChecklistStatus;
use App\Models\ChecklistTemplate;
use App\Models\Variant;
use Illuminate\Support\Carbon;

/**
 * Materializes checklist_status for a variant.
 * Completeness reads ONLY checklist_status - never hot-path JOIN of assets.
 */
class RecomputeChecklistStatus
{
    public function forVariant(Variant $variant, ?ChecklistTemplate $template = null): ChecklistStatus
    {
        $template ??= ChecklistTemplate::query()
            ->where('code', 'food-pack-dk')
            ->orderByDesc('version')
            ->firstOrFail();

        $required = collect($template->schema_json['required_roles'] ?? [])
            ->pluck('asset_role')
            ->filter()
            ->values();

        $presentRoles = Asset::query()
            ->where('variant_id', $variant->id)
            ->whereNotNull('current_revision_id')
            ->pluck('asset_role');

        $missing = $required->diff($presentRoles)->values()->all();
        $status = $missing === [] ? 'complete' : 'incomplete';

        return ChecklistStatus::query()->updateOrCreate(
            [
                'variant_id' => $variant->id,
                'checklist_template_id' => $template->id,
            ],
            [
                'status' => $status,
                'missing_roles' => $missing,
                'computed_at' => Carbon::now(),
            ]
        );
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChecklistStatus;
use App\Models\Variant;
use App\Services\RecomputeChecklistStatus;
use Illuminate\Http\JsonResponse;

class CompletenessController extends Controller
{
    public function show(Variant $variant): JsonResponse
    {
        $row = ChecklistStatus::query()
            ->where('variant_id', $variant->id)
            ->first();

        return response()->json([
            'variant_id' => $variant->id,
            'status' => $row?->status ?? 'unknown',
            'missing_roles' => $row?->missing_roles ?? [],
            'computed_at' => $row?->computed_at,
            'source' => 'checklist_status',
        ]);
    }

    public function recompute(Variant $variant, RecomputeChecklistStatus $service): JsonResponse
    {
        $row = $service->forVariant($variant);

        return response()->json([
            'variant_id' => $variant->id,
            'status' => $row->status,
            'missing_roles' => $row->missing_roles,
            'computed_at' => $row->computed_at,
            'source' => 'checklist_status',
        ]);
    }
}

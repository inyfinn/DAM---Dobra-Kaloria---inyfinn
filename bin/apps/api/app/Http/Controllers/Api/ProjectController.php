<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChecklistStatus;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index(): JsonResponse
    {
        $projects = Project::query()
            ->orderBy('product_index')
            ->get(['id', 'product_index', 'title', 'market']);

        $variantIds = \App\Models\Variant::query()
            ->selectRaw('DISTINCT ON (project_id) id, project_id')
            ->orderBy('project_id')
            ->orderByDesc('id')
            ->pluck('id', 'project_id');

        $statuses = ChecklistStatus::query()
            ->whereIn('variant_id', $variantIds->values())
            ->get()
            ->keyBy('variant_id');

        $data = $projects->map(function (Project $project) use ($variantIds, $statuses) {
            $variantId = $variantIds[$project->id] ?? null;
            /** @var ChecklistStatus|null $status */
            $status = $variantId ? ($statuses[$variantId] ?? null) : null;

            return [
                'id' => $project->id,
                'product_index' => $project->product_index,
                'title' => $project->title,
                'market' => $project->market,
                'variant_id' => $variantId,
                'completeness' => $status?->status ?? 'unknown',
                'missing_roles' => $status?->missing_roles ?? [],
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_index' => ['required', 'string', 'max:64'],
            'title' => ['required', 'string', 'max:255'],
            'market' => ['nullable', 'string', 'max:16'],
        ]);

        $project = Project::query()->create($data);

        return response()->json(['data' => $project], 201);
    }

    public function show(Project $project): JsonResponse
    {
        $project->load(['variants.assets.currentRevision', 'variants.checklistStatus']);

        return response()->json(['data' => $project]);
    }
}

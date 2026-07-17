<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\NotifyTeamsMissingAssetsJob;
use App\Jobs\SyncAsanaChecklistJob;
use App\Models\Variant;
use App\Services\IngestPolskaPointers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IngestController extends Controller
{
    public function pointers(Request $request, IngestPolskaPointers $ingest): JsonResponse
    {
        $data = $request->validate([
            'index' => ['nullable', 'string', 'max:64'],
        ]);

        $stats = $ingest->run($data['index'] ?? null);

        return response()->json(['data' => $stats]);
    }

    public function notifyIntegrations(Variant $variant): JsonResponse
    {
        SyncAsanaChecklistJob::dispatch($variant->id);
        NotifyTeamsMissingAssetsJob::dispatch($variant->id);

        return response()->json([
            'message' => 'Asana + Teams jobs queued (stub without credentials logs only).',
            'variant_id' => $variant->id,
        ]);
    }
}

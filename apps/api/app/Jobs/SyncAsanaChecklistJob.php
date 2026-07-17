<?php

namespace App\Jobs;

use App\Models\Variant;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncAsanaChecklistJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $variantId) {}

    public function handle(): void
    {
        $token = config('dam.integrations.asana.access_token');
        $variant = Variant::query()->with('checklistStatus', 'project')->find($this->variantId);

        if (! $variant) {
            return;
        }

        $status = $variant->checklistStatus;
        $missing = $status?->missing_roles ?? [];

        if ($token === null || $token === '') {
            Log::info('Asana stub: no token', [
                'variant_id' => $this->variantId,
                'status' => $status?->status,
                'missing' => $missing,
            ]);

            return;
        }

        // Real create/update when credentials present (Asana Tasks API).
        Http::withToken($token)
            ->acceptJson()
            ->post('https://app.asana.com/api/1.0/tasks', [
                'data' => [
                    'name' => sprintf(
                        'DAM incomplete: %s',
                        $variant->project?->product_index ?? $variant->id
                    ),
                    'notes' => 'Missing roles: '.implode(', ', $missing),
                    'workspace' => config('dam.integrations.asana.workspace_gid'),
                ],
            ]);
    }
}

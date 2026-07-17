<?php

namespace App\Jobs;

use App\Models\Variant;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NotifyTeamsMissingAssetsJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $variantId) {}

    public function handle(): void
    {
        $webhook = config('dam.integrations.teams.webhook_url');
        $variant = Variant::query()->with('checklistStatus', 'project')->find($this->variantId);

        if (! $variant) {
            return;
        }

        $status = $variant->checklistStatus;
        $missing = $status?->missing_roles ?? [];
        $text = sprintf(
            'DAM ETA: projekt %s ma status %s. Braki: %s',
            $variant->project?->product_index ?? (string) $variant->id,
            $status?->status ?? 'unknown',
            $missing === [] ? '(brak)' : implode(', ', $missing)
        );

        if ($webhook === null || $webhook === '') {
            Log::info('Teams stub: no webhook', ['text' => $text]);

            return;
        }

        Http::post($webhook, [
            'text' => $text,
        ]);
    }
}

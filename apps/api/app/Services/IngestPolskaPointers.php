<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetRevision;
use App\Models\Project;
use App\Models\Variant;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * Read-only ingest: register filesystem pointers (no copy to vault).
 * Roots from config dam.ingest.roots (P seed + optional M:/D: POLSKA).
 */
class IngestPolskaPointers
{
    /** Slot folder prefix => asset_role (food-pack DK) */
    private const SLOT_MAP = [
        '0' => 'archive',
        '1' => 'artwork',
        '2' => 'viz_3d',
        '3' => 'print_pdf',
        '4' => 'tech',
    ];

    public function __construct(
        private readonly RecomputeChecklistStatus $recompute,
    ) {}

    /**
     * @return array{projects:int, variants:int, assets:int, roots:list<string>, skipped_roots:list<string>}
     */
    public function run(?string $limitIndex = null): array
    {
        $stats = [
            'projects' => 0,
            'variants' => 0,
            'assets' => 0,
            'roots' => [],
            'skipped_roots' => [],
        ];

        foreach (config('dam.ingest.roots', []) as $root) {
            $root = rtrim((string) $root, "\\/");
            if ($root === '' || ! is_dir($root)) {
                $stats['skipped_roots'][] = $root;

                continue;
            }
            $stats['roots'][] = $root;
            $this->scanRoot($root, $limitIndex, $stats);
        }

        return $stats;
    }

    /**
     * @param  array{projects:int, variants:int, assets:int, roots:list<string>, skipped_roots:list<string>}  $stats
     */
    private function scanRoot(string $root, ?string $limitIndex, array &$stats): void
    {
        $dirs = File::directories($root);
        foreach ($dirs as $dir) {
            $name = basename($dir);
            if (! preg_match('/(?P<index>\d{7}(?:\.\d{2})?)/', $name, $m)) {
                // one level deeper (carrier / product group)
                foreach (File::directories($dir) as $child) {
                    $this->ingestVariantFolder($child, $limitIndex, $stats);
                }

                continue;
            }
            $this->ingestVariantFolder($dir, $limitIndex, $stats);
        }
    }

    /**
     * @param  array{projects:int, variants:int, assets:int, roots:list<string>, skipped_roots:list<string>}  $stats
     */
    private function ingestVariantFolder(string $dir, ?string $limitIndex, array &$stats): void
    {
        $name = basename($dir);
        if (! preg_match('/(?P<index>\d{7})(?:\.(?P<rev>\d{2}))?/', $name, $m)) {
            return;
        }

        $base = $m['index'];
        $rev = $m['rev'] ?? '00';
        $productIndex = $base.'.'.$rev;

        if ($limitIndex !== null && $limitIndex !== '' && ! Str::startsWith($productIndex, $limitIndex) && $base !== $limitIndex) {
            return;
        }

        $title = trim(preg_replace('/\s*[-_]?\s*\d{7}(?:\.\d{2})?.*/', '', $name) ?? $name);
        if ($title === '') {
            $title = $productIndex;
        }

        $project = Project::query()->firstOrCreate(
            ['product_index' => $productIndex],
            ['title' => $title, 'market' => null]
        );
        if ($project->wasRecentlyCreated) {
            $stats['projects']++;
        }

        $variant = Variant::query()->firstOrCreate(
            [
                'project_id' => $project->id,
                'index_revision' => $rev,
            ],
            [
                'carrier' => $this->guessCarrier($name),
                'variant_date' => null,
                'label' => $title,
            ]
        );
        if ($variant->wasRecentlyCreated) {
            $stats['variants']++;
        }

        foreach (File::directories($dir) as $slotDir) {
            $slotName = basename($slotDir);
            if (! preg_match('/^(?P<slot>[0-4])\s*-/', $slotName, $sm)) {
                continue;
            }
            $role = self::SLOT_MAP[$sm['slot']] ?? null;
            if ($role === null || $role === 'archive') {
                continue;
            }

            $files = File::files($slotDir);
            if ($files === []) {
                // allow one nested level
                foreach (File::directories($slotDir) as $nested) {
                    $files = array_merge($files, File::files($nested));
                }
            }
            if ($files === []) {
                continue;
            }

            $first = $files[0]->getPathname();
            $asset = Asset::query()->firstOrCreate(
                [
                    'variant_id' => $variant->id,
                    'asset_role' => $role,
                ]
            );

            $pointer = $this->normalizePointer($first);
            $existing = $asset->current_revision_id
                ? AssetRevision::query()->find($asset->current_revision_id)
                : null;

            if ($existing && $existing->path_or_pointer === $pointer) {
                continue;
            }

            $revision = AssetRevision::query()->create([
                'asset_id' => $asset->id,
                'storage_kind' => 'pointer',
                'path_or_pointer' => $pointer,
                'checksum' => null,
            ]);
            $asset->update(['current_revision_id' => $revision->id]);
            $stats['assets']++;
        }

        $this->recompute->forVariant($variant->fresh());
    }

    private function guessCarrier(string $folderName): string
    {
        if (preg_match('/doypack/i', $folderName)) {
            return 'DOYPACK';
        }
        if (preg_match('/baton/i', $folderName)) {
            return 'BATON';
        }

        return 'UNKNOWN';
    }

    private function normalizePointer(string $path): string
    {
        return str_replace('\\', '/', $path);
    }
}

<?php

namespace App\Console\Commands;

use App\Services\IngestPolskaPointers;
use Illuminate\Console\Command;

class IngestPolskaPointersCommand extends Command
{
    protected $signature = 'dam:ingest-pointers {--index= : Limit to product index prefix}';

    protected $description = 'Register read-only POLSKA filesystem pointers into DAM (no file copy)';

    public function handle(IngestPolskaPointers $ingest): int
    {
        $stats = $ingest->run($this->option('index') ?: null);
        $this->info('Ingest done.');
        $this->table(
            ['metric', 'value'],
            [
                ['roots', implode('; ', $stats['roots']) ?: '(none)'],
                ['skipped_roots', implode('; ', $stats['skipped_roots']) ?: '(none)'],
                ['projects', (string) $stats['projects']],
                ['variants', (string) $stats['variants']],
                ['assets', (string) $stats['assets']],
            ]
        );

        return self::SUCCESS;
    }
}

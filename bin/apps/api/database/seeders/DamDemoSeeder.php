<?php

namespace Database\Seeders;

use App\Models\Asset;
use App\Models\AssetRevision;
use App\Models\ChecklistTemplate;
use App\Models\Project;
use App\Models\User;
use App\Models\Variant;
use App\Services\RecomputeChecklistStatus;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DamDemoSeeder extends Seeder
{
    public function run(): void
    {
        $schemaPath = 'P:\\DAM\\packages\\domain-schemas\\food-pack-dk.v0.json';
        $schema = json_decode(file_get_contents($schemaPath), true, 512, JSON_THROW_ON_ERROR);

        $template = ChecklistTemplate::query()->updateOrCreate(
            ['code' => 'food-pack-dk'],
            [
                'title' => $schema['title'] ?? 'Food pack DK',
                'version' => (int) ($schema['version'] ?? 0),
                'schema_json' => $schema,
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'admin@dam.local'],
            [
                'name' => 'DAM Admin',
                'password' => Hash::make('DamAdmin123!'),
                'role' => User::ROLE_ADMIN,
                'auth_provider' => 'local',
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'power@dam.local'],
            [
                'name' => 'DAM Power User',
                'password' => Hash::make('DamPower123!'),
                'role' => User::ROLE_POWER_USER,
                'auth_provider' => 'local',
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'user@dam.local'],
            [
                'name' => 'DAM User',
                'password' => Hash::make('DamUser123!'),
                'role' => User::ROLE_USER,
                'auth_provider' => 'local',
            ]
        );

        $project = Project::query()->updateOrCreate(
            ['product_index' => '6300729.00'],
            [
                'title' => 'Tiramisu czekolada kakao',
                'market' => 'DK',
            ]
        );

        $variant = Variant::query()->updateOrCreate(
            [
                'project_id' => $project->id,
                'carrier' => 'DOYPACK 65 g',
                'variant_date' => '2026-07-01',
                'index_revision' => '00',
            ],
            ['label' => 'kulki deserowe']
        );

        foreach (['artwork', 'tech'] as $role) {
            $asset = Asset::query()->updateOrCreate(
                [
                    'variant_id' => $variant->id,
                    'asset_role' => $role,
                ],
                []
            );

            $rev = AssetRevision::query()->create([
                'asset_id' => $asset->id,
                'storage_kind' => 'pointer',
                'path_or_pointer' => "M:/demo/{$role}/6300729.00",
                'checksum' => null,
            ]);

            $asset->update(['current_revision_id' => $rev->id]);
        }

        app(RecomputeChecklistStatus::class)->forVariant($variant->fresh(), $template);
    }
}

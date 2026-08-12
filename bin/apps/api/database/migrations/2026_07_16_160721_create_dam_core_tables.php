<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('product_index', 64)->unique();
            $table->string('title');
            $table->string('market', 16)->nullable();
            $table->timestamps();
        });

        Schema::create('variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('carrier', 128)->nullable();
            $table->date('variant_date')->nullable();
            $table->string('index_revision', 32)->nullable();
            $table->string('label')->nullable();
            $table->timestamps();
            $table->unique(['project_id', 'carrier', 'variant_date', 'index_revision'], 'variants_axis_a_unique');
        });

        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variant_id')->constrained('variants')->cascadeOnDelete();
            $table->string('asset_role', 64);
            $table->unsignedBigInteger('current_revision_id')->nullable();
            $table->timestamps();
            $table->unique(['variant_id', 'asset_role']);
        });

        Schema::create('asset_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->string('storage_kind', 16)->default('vault');
            $table->text('path_or_pointer');
            $table->string('checksum', 128)->nullable();
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        Schema::table('assets', function (Blueprint $table) {
            $table->foreign('current_revision_id')
                ->references('id')
                ->on('asset_revisions')
                ->nullOnDelete();
        });

        Schema::create('checklist_templates', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('title');
            $table->unsignedInteger('version')->default(0);
            $table->json('schema_json');
            $table->timestamps();
        });

        Schema::create('checklist_status', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variant_id')->constrained('variants')->cascadeOnDelete();
            $table->foreignId('checklist_template_id')->constrained('checklist_templates')->cascadeOnDelete();
            $table->string('status', 32);
            $table->json('missing_roles')->nullable();
            $table->timestamp('computed_at')->nullable();
            $table->timestamps();
            $table->unique(['variant_id', 'checklist_template_id'], 'checklist_status_variant_template_unique');
        });

        Schema::create('audit_log', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('actor_user_id')->nullable();
            $table->string('action', 64);
            $table->string('entity_type', 64)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();
            $table->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_log');
        Schema::dropIfExists('checklist_status');
        Schema::dropIfExists('checklist_templates');
        Schema::table('assets', function (Blueprint $table) {
            $table->dropForeign(['current_revision_id']);
        });
        Schema::dropIfExists('asset_revisions');
        Schema::dropIfExists('assets');
        Schema::dropIfExists('variants');
        Schema::dropIfExists('projects');
    }
};

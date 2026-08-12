<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Variant extends Model
{
    protected $fillable = [
        'project_id',
        'carrier',
        'variant_date',
        'index_revision',
        'label',
    ];

    protected function casts(): array
    {
        return [
            'variant_date' => 'date',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
    }

    public function checklistStatus(): HasOne
    {
        return $this->hasOne(ChecklistStatus::class);
    }
}

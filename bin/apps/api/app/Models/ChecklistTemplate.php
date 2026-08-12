<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChecklistTemplate extends Model
{
    protected $fillable = [
        'code',
        'title',
        'version',
        'schema_json',
    ];

    protected function casts(): array
    {
        return [
            'schema_json' => 'array',
        ];
    }

    public function statuses(): HasMany
    {
        return $this->hasMany(ChecklistStatus::class);
    }
}

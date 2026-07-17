<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChecklistStatus extends Model
{
    protected $table = 'checklist_status';

    protected $fillable = [
        'variant_id',
        'checklist_template_id',
        'status',
        'missing_roles',
        'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'missing_roles' => 'array',
            'computed_at' => 'datetime',
        ];
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(Variant::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class, 'checklist_template_id');
    }
}

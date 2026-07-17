<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Asset extends Model
{
    protected $fillable = [
        'variant_id',
        'asset_role',
        'current_revision_id',
    ];

    public function variant(): BelongsTo
    {
        return $this->belongsTo(Variant::class);
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(AssetRevision::class);
    }

    public function currentRevision(): BelongsTo
    {
        return $this->belongsTo(AssetRevision::class, 'current_revision_id');
    }
}

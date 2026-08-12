<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    protected $fillable = [
        'product_index',
        'title',
        'market',
    ];

    public function variants(): HasMany
    {
        return $this->hasMany(Variant::class);
    }
}

<?php

use App\Http\Controllers\Api\AzureAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'app' => 'DAM ETA API',
        'ui' => 'http://127.0.0.1:8765',
        'health' => url('/api/health'),
    ]);
});

// Entra ID needs session (state) - web middleware group
Route::prefix('api/auth/azure')->group(function () {
    Route::get('/redirect', [AzureAuthController::class, 'redirect']);
    Route::get('/callback', [AzureAuthController::class, 'callback']);
});

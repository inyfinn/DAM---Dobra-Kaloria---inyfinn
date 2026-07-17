<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AuthSettingsController;
use App\Http\Controllers\Api\CompletenessController;
use App\Http\Controllers\Api\IngestController;
use App\Http\Controllers\Api\ProjectController;
use App\Models\User;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'ok' => true,
        'app' => 'DAM ETA',
        'auth_provider' => config('dam.auth.provider'),
    ]);
});

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/auth/settings', [AuthSettingsController::class, 'show'])
        ->middleware('role:'.User::ROLE_ADMIN);

    Route::get('/projects', [ProjectController::class, 'index']);
    Route::get('/projects/{project}', [ProjectController::class, 'show']);

    Route::post('/projects', [ProjectController::class, 'store'])
        ->middleware('role:'.User::ROLE_ADMIN.','.User::ROLE_POWER_USER);

    Route::get('/variants/{variant}/completeness', [CompletenessController::class, 'show']);

    Route::post('/variants/{variant}/completeness/recompute', [CompletenessController::class, 'recompute'])
        ->middleware('role:'.User::ROLE_ADMIN.','.User::ROLE_POWER_USER);

    Route::post('/ingest/pointers', [IngestController::class, 'pointers'])
        ->middleware('role:'.User::ROLE_ADMIN.','.User::ROLE_POWER_USER);

    Route::post('/variants/{variant}/integrations/notify', [IngestController::class, 'notifyIntegrations'])
        ->middleware('role:'.User::ROLE_ADMIN.','.User::ROLE_POWER_USER);
});


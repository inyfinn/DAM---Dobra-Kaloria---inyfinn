<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class AuthSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'provider' => config('dam.auth.provider'),
            'allow_local_fallback' => (bool) config('dam.auth.allow_local_fallback'),
            'azure' => [
                'tenant_configured' => (bool) config('dam.auth.azure.tenant_id'),
                'client_configured' => (bool) config('dam.auth.azure.client_id'),
                'redirect_uri' => config('dam.auth.azure.redirect_uri'),
                'domain_hint' => config('dam.auth.azure.domain_hint'),
            ],
            'ldap' => [
                'host_configured' => (bool) config('dam.auth.ldap.host'),
                'port' => config('dam.auth.ldap.port'),
            ],
            'roles' => ['admin', 'power_user', 'user'],
        ]);
    }
}

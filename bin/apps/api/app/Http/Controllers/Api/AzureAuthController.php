<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Microsoft Entra ID (Azure AD) OIDC stub + real redirect when credentials set.
 * Docs: https://learn.microsoft.com/en-us/entra/identity-platform/
 */
class AzureAuthController extends Controller
{
    public function redirect(Request $request): JsonResponse|RedirectResponse
    {
        $tenant = config('dam.auth.azure.tenant_id');
        $clientId = config('dam.auth.azure.client_id');
        $redirectUri = config('dam.auth.azure.redirect_uri');

        if (! $tenant || ! $clientId || ! $redirectUri) {
            return response()->json([
                'message' => 'Azure AD not configured. Set AZURE_AD_* in .env (admin).',
                'provider' => 'azure_ad',
                'configured' => false,
                'roles' => [User::ROLE_ADMIN, User::ROLE_POWER_USER, User::ROLE_USER],
            ], 503);
        }

        $state = Str::random(40);
        $request->session()->put('azure_oauth_state', $state);

        $query = http_build_query([
            'client_id' => $clientId,
            'response_type' => 'code',
            'redirect_uri' => $redirectUri,
            'response_mode' => 'query',
            'scope' => 'openid profile email offline_access',
            'state' => $state,
            'domain_hint' => config('dam.auth.azure.domain_hint'),
        ]);

        $url = "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/authorize?{$query}";

        if ($request->wantsJson()) {
            return response()->json(['authorize_url' => $url]);
        }

        return redirect()->away($url);
    }

    public function callback(Request $request): JsonResponse
    {
        $tenant = config('dam.auth.azure.tenant_id');
        $clientId = config('dam.auth.azure.client_id');
        $clientSecret = config('dam.auth.azure.client_secret');
        $redirectUri = config('dam.auth.azure.redirect_uri');

        if (! $tenant || ! $clientId || ! $clientSecret) {
            return response()->json(['message' => 'Azure AD not configured.'], 503);
        }

        if ($request->session()->get('azure_oauth_state') !== $request->query('state')) {
            return response()->json(['message' => 'Invalid OAuth state.'], 400);
        }

        $tokenResponse = Http::asForm()->post(
            "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/token",
            [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'code' => $request->query('code'),
                'redirect_uri' => $redirectUri,
                'grant_type' => 'authorization_code',
            ]
        );

        if (! $tokenResponse->successful()) {
            return response()->json([
                'message' => 'Token exchange failed.',
                'detail' => $tokenResponse->json(),
            ], 502);
        }

        $accessToken = $tokenResponse->json('access_token');
        $profile = Http::withToken($accessToken)
            ->get('https://graph.microsoft.com/v1.0/me')
            ->json();

        $oid = $profile['id'] ?? null;
        $email = $profile['mail'] ?? $profile['userPrincipalName'] ?? null;
        $name = $profile['displayName'] ?? ($email ?? 'User');

        if (! $oid || ! $email) {
            return response()->json(['message' => 'Graph profile incomplete.'], 502);
        }

        $role = $this->mapGroupsToRole($accessToken);

        $user = User::query()->updateOrCreate(
            ['azure_oid' => $oid],
            [
                'name' => $name,
                'email' => $email,
                'password' => bcrypt(Str::random(32)),
                'role' => $role,
                'auth_provider' => 'azure_ad',
            ]
        );

        $token = $user->createToken('dam-entra')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'auth_provider' => $user->auth_provider,
            ],
        ]);
    }

    private function mapGroupsToRole(string $accessToken): string
    {
        $map = config('dam.auth.group_role_map', []);

        if ($map === []) {
            return User::ROLE_USER;
        }

        $groups = Http::withToken($accessToken)
            ->get('https://graph.microsoft.com/v1.0/me/memberOf')
            ->json('value', []);

        foreach ($groups as $group) {
            $id = $group['id'] ?? null;
            if ($id && isset($map[$id])) {
                return $map[$id];
            }
        }

        return User::ROLE_USER;
    }
}

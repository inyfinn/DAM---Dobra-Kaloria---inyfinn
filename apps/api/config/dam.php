<?php

return [
    'auth' => [
        // azure_ad | ldap | oidc_generic | local
        'provider' => env('AUTH_PROVIDER', 'azure_ad'),
        'allow_local_fallback' => env('AUTH_ALLOW_LOCAL', true),
        'azure' => [
            'tenant_id' => env('AZURE_AD_TENANT_ID'),
            'client_id' => env('AZURE_AD_CLIENT_ID'),
            'client_secret' => env('AZURE_AD_CLIENT_SECRET'),
            'redirect_uri' => env('AZURE_AD_REDIRECT_URI', 'http://127.0.0.1:8000/api/auth/azure/callback'),
            'domain_hint' => env('AZURE_AD_DOMAIN_HINT'),
        ],
        'ldap' => [
            'host' => env('LDAP_HOST'),
            'port' => env('LDAP_PORT', 636),
            'base_dn' => env('LDAP_BASE_DN'),
        ],
        // Azure AD group OID or LDAP CN => admin|power_user|user
        'group_role_map' => [
            // 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' => 'admin',
        ],
    ],
    'integrations' => [
        'asana' => [
            'access_token' => env('ASANA_ACCESS_TOKEN'),
            'workspace_gid' => env('ASANA_WORKSPACE_GID'),
        ],
        'teams' => [
            'webhook_url' => env('TEAMS_WEBHOOK_URL'),
        ],
    ],
    'ingest' => [
        // Read-only roots. Seed on P always; M:/D: optional when mounted.
        'roots' => array_values(array_filter(array_map('trim', explode(';', env(
            'DAM_INGEST_ROOTS',
            'P:\\DAM\\data\\seeds\\polska-demo'
        ))))),
    ],
];


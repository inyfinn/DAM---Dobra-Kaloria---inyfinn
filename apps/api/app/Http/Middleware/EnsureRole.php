<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /**
     * @param  string  ...$roles  One or more of admin|power_user|user
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $allowed = $roles !== [] ? $roles : [User::ROLE_USER];

        if (! in_array($user->role, $allowed, true)) {
            return response()->json([
                'message' => 'Forbidden for role.',
                'role' => $user->role,
                'required' => $allowed,
            ], 403);
        }

        return $next($request);
    }
}

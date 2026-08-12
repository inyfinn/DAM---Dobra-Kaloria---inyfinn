<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 32)->default('user')->after('email');
            $table->string('azure_oid', 64)->nullable()->unique()->after('role');
            $table->string('auth_provider', 32)->default('local')->after('azure_oid');
            $table->index('role');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role']);
            $table->dropColumn(['role', 'azure_oid', 'auth_provider']);
        });
    }
};

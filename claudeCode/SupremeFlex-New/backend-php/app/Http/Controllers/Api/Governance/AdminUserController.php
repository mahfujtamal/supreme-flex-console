<?php

namespace App\Http\Controllers\Api\Governance;

use App\Http\Controllers\Api\BaseApiController;

class AdminUserController extends BaseApiController
{
    protected string $table        = 'admin_users';
    protected string $primaryKey   = 'admin_id';
    protected string $searchColumn = 'email';
    protected array  $fillable     = ['email', 'full_name', 'role_id', 'is_active'];
}

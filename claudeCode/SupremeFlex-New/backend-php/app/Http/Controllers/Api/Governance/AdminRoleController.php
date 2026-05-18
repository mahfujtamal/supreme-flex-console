<?php

namespace App\Http\Controllers\Api\Governance;

use App\Http\Controllers\Api\BaseApiController;

class AdminRoleController extends BaseApiController
{
    protected string $table        = 'admin_roles';
    protected string $primaryKey   = 'role_id';
    protected string $searchColumn = 'role_name';
    protected array  $fillable     = ['role_name', 'permissions'];
}

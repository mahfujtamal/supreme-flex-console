<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;

class FieldAgentController extends BaseApiController
{
    protected string $table        = 'field_agents';
    protected string $primaryKey   = 'agent_id';
    protected string $searchColumn = 'agent_name';
    protected array  $fillable     = ['agent_name', 'dh_id', 'hub_manager_id', 'msisdn', 'status'];
}

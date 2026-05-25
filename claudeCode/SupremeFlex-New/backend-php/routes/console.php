<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('db:partition-maintenance')->monthly()->runInBackground();
Schedule::command('app:auto-cancel-addon-orders')->hourly()->runInBackground();
Schedule::command('app:auto-unassign-real-ip')->daily()->runInBackground();

<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('db:partition-maintenance')->monthly()->runInBackground();

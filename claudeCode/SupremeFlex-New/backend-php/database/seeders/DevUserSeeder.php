<?php

namespace Database\Seeders;

use App\Helpers\Uuid;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DevUserSeeder extends Seeder
{
    public function run(): void
    {
        $contact = '+8801711086859';

        $exists = DB::table('user_account')
            ->where('contact_number', $contact)
            ->exists();

        if ($exists) {
            $this->command->info("DevUserSeeder: user {$contact} already exists, skipping.");
            return;
        }

        // X'hex' is a MySQL binary literal — always binary regardless of connection charset.
        $hex = bin2hex(Uuid::make());
        DB::statement(
            "INSERT INTO user_account (id, user_name, email, password_hash, contact_number, staff_type, created_at, updated_at) VALUES (X'{$hex}', ?, ?, ?, ?, ?, NOW(), NOW())",
            ['Md Mahfujur Rahman', 'mahfujur.r@grameenphone.com', 'N/A', $contact, 'SUPERADMIN']
        );

        $this->command->info("DevUserSeeder: created SUPERADMIN user {$contact}.");
    }
}

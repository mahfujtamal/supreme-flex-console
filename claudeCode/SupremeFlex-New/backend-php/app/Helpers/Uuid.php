<?php

namespace App\Helpers;

use Ramsey\Uuid\Uuid as RamseyUuid;

class Uuid
{
    /**
     * Generate a new UUIDv7 and return raw 16 bytes for BINARY(16) DB storage.
     *
     * Usage: DB::table('orders')->insert(['id' => Uuid::make(), ...])
     */
    public static function make(): string
    {
        return RamseyUuid::uuid7()->getBytes();
    }

    /**
     * Convert a UUID string "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" to 16 raw bytes.
     *
     * Usage: DB::table('orders')->where('id', Uuid::toBin($idFromUrl))->first()
     */
    public static function toBin(string $uuid): string
    {
        return RamseyUuid::fromString($uuid)->getBytes();
    }

    /**
     * Convert 16 raw bytes back to a UUID string "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".
     *
     * Usage: Uuid::fromBin($row->id)
     */
    public static function fromBin(string $bytes): string
    {
        return RamseyUuid::fromBytes($bytes)->toString();
    }
}

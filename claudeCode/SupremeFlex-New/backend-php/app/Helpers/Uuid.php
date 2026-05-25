<?php

namespace App\Helpers;

use Ramsey\Uuid\Uuid as RamseyUuid;

class Uuid
{
    private function __construct() {}

    /** Returns raw 16 bytes of a new UUIDv7 for BINARY(16) storage. */
    public static function make(): string
    {
        return RamseyUuid::uuid7()->getBytes();
    }

    /** Converts UUID string to raw 16 bytes for WHERE clause bindings. */
    public static function toBin(string $uuid): string
    {
        return RamseyUuid::fromString($uuid)->getBytes();
    }

    /** Converts raw 16 bytes back to a UUID string. */
    public static function fromBin(string $bytes): string
    {
        return RamseyUuid::fromBytes($bytes)->toString();
    }
}

<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Ramsey\Uuid\Uuid;

class CsvSeederHelper
{
    public static function findCsv(string $tableName): string
    {
        $dir = dirname(base_path()) . DIRECTORY_SEPARATOR . 'SeedData';
        $files = glob($dir . DIRECTORY_SEPARATOR . $tableName . '-export-*.csv');
        if (empty($files)) {
            throw new \RuntimeException("No CSV found for table '{$tableName}' in {$dir}");
        }
        return $files[0];
    }

    public static function loadCsv(string $tableName): array
    {
        $path = self::findCsv($tableName);
        $rows = [];
        $handle = fopen($path, 'r');
        $headers = fgetcsv($handle, 0, ';');
        if ($headers) {
            $headers[0] = ltrim($headers[0], "\xEF\xBB\xBF");
            $headers = array_map('trim', $headers);
        }
        while (($data = fgetcsv($handle, 0, ';')) !== false) {
            if (count($data) >= count($headers)) {
                $row = array_combine($headers, array_slice($data, 0, count($headers)));
                $rows[] = array_map('trim', $row);
            }
        }
        fclose($handle);
        return $rows;
    }

    public static function uuidToBin(string $uuid): string
    {
        return hex2bin(str_replace('-', '', trim($uuid)));
    }

    public static function uuid7Bin(): string
    {
        return self::uuidToBin(Uuid::uuid7()->toString());
    }

    // Strip microseconds and timezone: "2026-03-27 19:50:56.388894+00" → "2026-03-27 19:50:56"
    public static function ts(?string $val): ?string
    {
        $val = trim((string) $val);
        if ($val === '') return null;
        return substr(preg_replace('/\.\d+.*/', '', $val), 0, 19);
    }

    // "true"/"false"/"ACTIVE"/"INACTIVE" → 1/0
    public static function bool(string $val): int
    {
        return in_array(strtolower(trim($val)), ['true', '1', 'yes', 'active']) ? 1 : 0;
    }

    public static function nullIfEmpty(?string $val): ?string
    {
        $v = trim((string) $val);
        return $v === '' ? null : $v;
    }

    // Bulk insert with FK checks disabled, idempotent via insertOrIgnore
    public static function chunkInsert(string $table, array $rows, int $chunkSize = 500): int
    {
        if (empty($rows)) return 0;
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        $total = 0;
        foreach (array_chunk($rows, $chunkSize) as $chunk) {
            DB::table($table)->insertOrIgnore($chunk);
            $total += count($chunk);
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        return $total;
    }
}

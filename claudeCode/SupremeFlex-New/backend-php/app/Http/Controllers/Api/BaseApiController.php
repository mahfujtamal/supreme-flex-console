<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Shared CRUD helpers used by every resource controller.
 * Each controller sets $table, $primaryKey, $searchColumn, and $fillable.
 */
abstract class BaseApiController extends Controller
{
    protected string $table;
    protected string $primaryKey = 'id';
    protected string $searchColumn = 'name';
    protected array  $fillable = [];

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));
        $search  = trim($request->get('search', ''));

        $query = DB::table($this->table)->orderByDesc('created_at');

        if ($search && $this->searchColumn) {
            $query->where($this->searchColumn, 'LIKE', "%{$search}%");
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get();

        return response()->json(['items' => $items, 'total' => $total]);
    }

    public function store(Request $request)
    {
        $data = $request->only($this->fillable);
        $data[$this->primaryKey] = (string) Str::uuid();
        $data['created_at'] = now();
        $data['updated_at'] = now();

        DB::table($this->table)->insert($data);

        $record = DB::table($this->table)->where($this->primaryKey, $data[$this->primaryKey])->first();
        return response()->json($record, 201);
    }

    public function show(string $id)
    {
        $record = DB::table($this->table)->where($this->primaryKey, $id)->first();
        if (!$record) return response()->json(['message' => 'Not found'], 404);
        return response()->json($record);
    }

    public function update(Request $request, string $id)
    {
        $exists = DB::table($this->table)->where($this->primaryKey, $id)->exists();
        if (!$exists) return response()->json(['message' => 'Not found'], 404);

        $data = $request->only($this->fillable);
        $data['updated_at'] = now();
        DB::table($this->table)->where($this->primaryKey, $id)->update($data);

        return response()->json(DB::table($this->table)->where($this->primaryKey, $id)->first());
    }

    public function destroy(string $id)
    {
        $deleted = DB::table($this->table)->where($this->primaryKey, $id)->delete();
        if (!$deleted) return response()->json(['message' => 'Not found'], 404);
        return response()->json(null, 204);
    }
}

/**
 * DynamoDB Adapter — Supabase-Compatible Query Builder
 * ════════════════════════════════════════════════════════════════════════
 * Implements the Supabase JS SDK query-builder interface (.from().select()
 * .eq().order().range() etc.) on top of AWS DynamoDB.
 *
 * This allows ALL existing API routes to work without modification — they
 * call supabase.from('applications').select('*').eq('user_id', user.id)
 * and this adapter translates those chains into DynamoDB Scan/Query/Put/
 * Update/Delete operations.
 *
 * CRITICAL CONTRACT:
 *   Every method returns `this` for chaining except terminal methods
 *   (.single(), await/then) which return { data, error, count? }.
 *
 * PGRST116 EMULATION:
 *   .single() returns { data: null, error: { code: 'PGRST116', message: '...' } }
 *   when no row is found, matching Supabase/PostgREST behavior that
 *   settings/route.js and profile/route.js depend on.
 * ════════════════════════════════════════════════════════════════════════
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ScanCommand,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from './dynamodb-client.js';

// ─── Table Name Resolution ──────────────────────────────────────────────

const TABLE_PREFIX = process.env.DYNAMODB_TABLE_PREFIX || 'getmyjob-';

/**
 * Maps Supabase table names (underscore-separated) to DynamoDB table names
 * (hyphen-separated). E.g., 'calendar_events' → 'getmyjob-calendar-events'
 */
function resolveTableName(supabaseTable) {
  // Convert underscores to hyphens to match DynamoDB naming convention
  const normalizedName = supabaseTable.replace(/_/g, '-');
  return `${TABLE_PREFIX}${normalizedName}`;
}

/**
 * Schema metadata: defines PK/SK for each table so the query builder
 * knows which filters to apply as KeyConditions vs FilterExpressions.
 */
const TABLE_SCHEMA = {
  'applications':         { pk: 'user_id', sk: 'id' },
  'jobs':                 { pk: 'user_id', sk: 'id' },
  'emails':               { pk: 'user_id', sk: 'id' },
  'contacts':             { pk: 'user_id', sk: 'id' },
  'calendar_events':      { pk: 'user_id', sk: 'id' },
  'activity_log':         { pk: 'user_id', sk: 'id' },
  'email_templates':      { pk: 'user_id', sk: 'id' },
  'scan_history':         { pk: 'user_id', sk: 'id' },
  'resume_imports':       { pk: 'user_id', sk: 'id' },
  'user_settings':        { pk: 'user_id', sk: null },
  'profiles':             { pk: 'user_id', sk: null },
  'tracking_events':      { pk: 'application_id', sk: 'id' },
  'contact_interactions': { pk: 'contact_id', sk: 'id' },
  'template_analytics':   { pk: 'template_id', sk: 'id' },
};

/**
 * GSI metadata: maps field names to GSI index names for optimized lookups.
 */
const GSI_MAP = {
  'emails': {
    'gmail_id': 'gmail_id-index',
    'thread_id': 'thread_id-index',
    'application_id': 'application_id-index',
  },
  'jobs': {
    'job_url_hash': 'job_url_hash-index',
  },
  'tracking_events': {
    'email_id': 'email_id-index',
  },
};

// ─── Main Adapter Class ────────────────────────────────────────────────

export class DynamoDBAdapter {
  /**
   * Entry point — mimics supabase.from('table_name')
   */
  from(tableName) {
    return new DynamoDBQueryBuilder(tableName);
  }

  /**
   * RPC is not supported in DynamoDB.
   * Returns a chainable stub that triggers fallback logic in emails/counts/route.js.
   * Supports: .rpc('fn').single() — the pattern used in the codebase.
   */
  rpc(functionName) {
    const result = {
      data: null,
      error: {
        message: `RPC not supported in DynamoDB adapter: ${functionName}`,
        code: 'RPC_NOT_SUPPORTED'
      }
    };
    const thenable = {
      single: () => thenable,
      maybeSingle: () => thenable,
      then: (resolve) => resolve(result),
      catch: () => thenable,
    };
    return thenable;
  }
}

// ─── Query Builder ─────────────────────────────────────────────────────

class DynamoDBQueryBuilder {
  constructor(tableName) {
    this._supabaseTable = tableName;
    this._tableName = resolveTableName(tableName);
    this._schema = TABLE_SCHEMA[tableName] || { pk: 'id', sk: null };

    // Operation state
    this._operation = null;       // 'select' | 'insert' | 'update' | 'delete' | 'upsert'
    this._selectColumns = null;   // null = all, string[] = specific columns
    this._countOnly = false;      // select('*', { count: 'exact', head: true })
    this._filters = [];           // Array of { type, column, value }
    this._orFilters = [];         // Supabase .or() expressions
    this._orderBy = null;         // { column, ascending }
    this._rangeStart = null;
    this._rangeEnd = null;
    this._limitCount = null;
    this._isSingle = false;
    this._insertData = null;
    this._updateData = null;
    this._upsertData = null;
    this._upsertOptions = {};
    this._returnData = false;     // .select() after mutation
  }

  // ── SELECT ──────────────────────────────────────────────────────────

  select(columns = '*', options = {}) {
    if (this._operation === 'insert' || this._operation === 'update' || this._operation === 'upsert' || this._operation === 'delete') {
      // .select() after mutation = "return the data after the operation"
      this._returnData = true;
      if (columns !== '*') {
        this._selectColumns = columns.split(',').map(c => c.trim());
      }
      return this;
    }

    this._operation = 'select';
    if (columns !== '*') {
      this._selectColumns = columns.split(',').map(c => c.trim());
    }
    if (options.count === 'exact' && options.head === true) {
      this._countOnly = true;
    }
    return this;
  }

  // ── INSERT ──────────────────────────────────────────────────────────

  insert(data) {
    this._operation = 'insert';
    this._insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  // ── UPDATE ──────────────────────────────────────────────────────────

  update(data) {
    this._operation = 'update';
    this._updateData = data;
    return this;
  }

  // ── UPSERT ──────────────────────────────────────────────────────────

  upsert(data, options = {}) {
    this._operation = 'upsert';
    this._upsertData = Array.isArray(data) ? data : [data];
    this._upsertOptions = options;
    return this;
  }

  // ── DELETE ──────────────────────────────────────────────────────────

  delete() {
    this._operation = 'delete';
    return this;
  }

  // ── FILTERS ─────────────────────────────────────────────────────────

  eq(column, value) {
    this._filters.push({ type: 'eq', column, value });
    return this;
  }

  neq(column, value) {
    this._filters.push({ type: 'neq', column, value });
    return this;
  }

  in(column, values) {
    this._filters.push({ type: 'in', column, value: values });
    return this;
  }

  gte(column, value) {
    this._filters.push({ type: 'gte', column, value });
    return this;
  }

  lte(column, value) {
    this._filters.push({ type: 'lte', column, value });
    return this;
  }

  gt(column, value) {
    this._filters.push({ type: 'gt', column, value });
    return this;
  }

  lt(column, value) {
    this._filters.push({ type: 'lt', column, value });
    return this;
  }

  ilike(column, pattern) {
    // Convert SQL LIKE pattern to a search string: strip leading/trailing %
    const searchVal = pattern.replace(/^%|%$/g, '');
    this._filters.push({ type: 'ilike', column, value: searchVal });
    return this;
  }

  is(column, value) {
    this._filters.push({ type: 'is', column, value });
    return this;
  }

  /**
   * Supabase .or() syntax: 'subject.ilike.%q%,preview.ilike.%q%'
   * We parse this into separate filter groups combined with OR.
   */
  or(expression) {
    this._orFilters.push(expression);
    return this;
  }

  // ── MODIFIERS ───────────────────────────────────────────────────────

  order(column, options = {}) {
    this._orderBy = {
      column,
      ascending: options.ascending !== undefined ? options.ascending : true,
    };
    return this;
  }

  range(start, end) {
    this._rangeStart = start;
    this._rangeEnd = end;
    return this;
  }

  limit(count) {
    this._limitCount = count;
    return this;
  }

  single() {
    this._isSingle = true;
    return this;
  }

  maybeSingle() {
    this._isSingle = true;
    this._maybeSingle = true;
    return this;
  }

  // ── EXECUTION (Thenable) ────────────────────────────────────────────

  then(onFulfilled, onRejected) {
    return this._execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this._execute().catch(onRejected);
  }

  // ── INTERNAL: Execute the built query ───────────────────────────────

  async _execute() {
    try {
      switch (this._operation) {
        case 'select':
          return await this._executeSelect();
        case 'insert':
          return await this._executeInsert();
        case 'update':
          return await this._executeUpdate();
        case 'delete':
          return await this._executeDelete();
        case 'upsert':
          return await this._executeUpsert();
        default:
          // If no operation set, default to select
          return await this._executeSelect();
      }
    } catch (error) {
      console.error(`[DynamoDB Adapter] Error in ${this._operation} on ${this._supabaseTable}:`, error);
      return { data: null, error: { message: error.message, code: error.code || 'DYNAMO_ERROR' } };
    }
  }

  // ── SELECT Execution ────────────────────────────────────────────────

  async _executeSelect() {
    let items = await this._scanOrQuery();

    // Apply in-memory OR filters
    if (this._orFilters.length > 0) {
      items = this._applyOrFilters(items);
    }

    // Apply in-memory filters that couldn't be done in DynamoDB
    items = this._applyInMemoryFilters(items);

    // Count-only mode
    if (this._countOnly) {
      return { data: null, count: items.length, error: null };
    }

    // Order
    if (this._orderBy) {
      items = this._sortItems(items);
    }

    // Range (pagination)
    if (this._rangeStart !== null && this._rangeEnd !== null) {
      const count = items.length;
      items = items.slice(this._rangeStart, this._rangeEnd + 1);
      return this._formatResult(items, count);
    }

    // Limit
    if (this._limitCount !== null) {
      items = items.slice(0, this._limitCount);
    }

    // Column projection
    if (this._selectColumns) {
      items = items.map(item => {
        const projected = {};
        for (const col of this._selectColumns) {
          if (col in item) projected[col] = item[col];
        }
        return projected;
      });
    }

    return this._formatResult(items);
  }

  /**
   * Decides whether to use DynamoDB Query (if PK filter is available)
   * or a full Scan. Uses GSIs when available for non-PK lookups.
   */
  async _scanOrQuery() {
    const pkFilter = this._filters.find(f => f.type === 'eq' && f.column === this._schema.pk);
    const gsiMap = GSI_MAP[this._supabaseTable] || {};

    // Check if any filter matches a GSI
    const gsiFilter = this._filters.find(f => f.type === 'eq' && gsiMap[f.column]);

    if (pkFilter) {
      // Can use Query on main table
      return await this._queryByPK(pkFilter);
    } else if (gsiFilter) {
      // Can use Query on a GSI
      return await this._queryByGSI(gsiFilter, gsiMap[gsiFilter.column]);
    } else {
      // Must Scan (less efficient, but necessary for cross-user queries)
      return await this._fullScan();
    }
  }

  async _queryByPK(pkFilter) {
    const params = {
      TableName: this._tableName,
      KeyConditionExpression: '#pk = :pkVal',
      ExpressionAttributeNames: { '#pk': pkFilter.column },
      ExpressionAttributeValues: { ':pkVal': pkFilter.value },
    };

    // Check if SK filter exists too
    const skFilter = this._schema.sk
      ? this._filters.find(f => f.type === 'eq' && f.column === this._schema.sk)
      : null;

    if (skFilter) {
      params.KeyConditionExpression += ' AND #sk = :skVal';
      params.ExpressionAttributeNames['#sk'] = skFilter.column;
      params.ExpressionAttributeValues[':skVal'] = skFilter.value;
    }

    // Build FilterExpression for remaining non-key filters
    const filterExpr = this._buildFilterExpression([pkFilter, skFilter].filter(Boolean));
    if (filterExpr.expression) {
      params.FilterExpression = filterExpr.expression;
      Object.assign(params.ExpressionAttributeNames, filterExpr.names);
      Object.assign(params.ExpressionAttributeValues, filterExpr.values);
    }

    return await this._paginateQuery(params);
  }

  async _queryByGSI(gsiFilter, indexName) {
    const params = {
      TableName: this._tableName,
      IndexName: indexName,
      KeyConditionExpression: '#gsiKey = :gsiVal',
      ExpressionAttributeNames: { '#gsiKey': gsiFilter.column },
      ExpressionAttributeValues: { ':gsiVal': gsiFilter.value },
    };

    // Build FilterExpression for remaining filters
    const filterExpr = this._buildFilterExpression([gsiFilter]);
    if (filterExpr.expression) {
      params.FilterExpression = filterExpr.expression;
      Object.assign(params.ExpressionAttributeNames, filterExpr.names);
      Object.assign(params.ExpressionAttributeValues, filterExpr.values);
    }

    return await this._paginateQuery(params);
  }

  async _fullScan() {
    const params = {
      TableName: this._tableName,
    };

    // Build FilterExpression for all applicable filters
    const filterExpr = this._buildFilterExpression([]);
    if (filterExpr.expression) {
      params.FilterExpression = filterExpr.expression;
      params.ExpressionAttributeNames = filterExpr.names;
      params.ExpressionAttributeValues = filterExpr.values;
    }

    return await this._paginateScan(params);
  }

  /**
   * Build a DynamoDB FilterExpression from the remaining filters
   * (excludes filters already used as KeyConditions).
   */
  _buildFilterExpression(excludeFilters) {
    const remaining = this._filters.filter(f => {
      // Only include simple eq/neq/gte/lte/gt/lt filters in DynamoDB expression
      // ilike and in are handled in-memory
      if (['ilike', 'in', 'is'].includes(f.type)) return false;
      return !excludeFilters.includes(f);
    });

    if (remaining.length === 0) {
      return { expression: null, names: {}, values: {} };
    }

    const expressions = [];
    const names = {};
    const values = {};

    remaining.forEach((f, i) => {
      const nameKey = `#f${i}`;
      const valueKey = `:f${i}`;
      names[nameKey] = f.column;
      values[valueKey] = f.value;

      switch (f.type) {
        case 'eq':
          expressions.push(`${nameKey} = ${valueKey}`);
          break;
        case 'neq':
          expressions.push(`${nameKey} <> ${valueKey}`);
          break;
        case 'gte':
          expressions.push(`${nameKey} >= ${valueKey}`);
          break;
        case 'lte':
          expressions.push(`${nameKey} <= ${valueKey}`);
          break;
        case 'gt':
          expressions.push(`${nameKey} > ${valueKey}`);
          break;
        case 'lt':
          expressions.push(`${nameKey} < ${valueKey}`);
          break;
      }
    });

    return {
      expression: expressions.join(' AND '),
      names,
      values,
    };
  }

  /**
   * Handle DynamoDB pagination (1MB limit per request) for Query.
   */
  async _paginateQuery(params) {
    const allItems = [];
    let lastEvaluatedKey = undefined;

    do {
      if (lastEvaluatedKey) params.ExclusiveStartKey = lastEvaluatedKey;
      const result = await dynamoClient.send(new QueryCommand(params));
      if (result.Items) allItems.push(...result.Items);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems;
  }

  /**
   * Handle DynamoDB pagination (1MB limit per request) for Scan.
   */
  async _paginateScan(params) {
    const allItems = [];
    let lastEvaluatedKey = undefined;

    do {
      if (lastEvaluatedKey) params.ExclusiveStartKey = lastEvaluatedKey;
      const result = await dynamoClient.send(new ScanCommand(params));
      if (result.Items) allItems.push(...result.Items);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems;
  }

  /**
   * Apply filters that can't be expressed in DynamoDB's FilterExpression:
   * - ilike (case-insensitive substring match)
   * - in (set membership)
   * - is (null check)
   */
  _applyInMemoryFilters(items) {
    return items.filter(item => {
      return this._filters.every(f => {
        if (f.type === 'ilike') {
          const val = (item[f.column] || '').toString().toLowerCase();
          return val.includes(f.value.toLowerCase());
        }
        if (f.type === 'in') {
          return f.value.includes(item[f.column]);
        }
        if (f.type === 'is') {
          if (f.value === null) return item[f.column] == null;
          return item[f.column] === f.value;
        }
        return true; // Already handled by DynamoDB FilterExpression
      });
    });
  }

  /**
   * Parse and apply Supabase .or() expressions.
   * Format: 'subject.ilike.%query%,preview.ilike.%query%'
   */
  _applyOrFilters(items) {
    for (const expr of this._orFilters) {
      const conditions = expr.split(',').map(cond => {
        const parts = cond.trim().split('.');
        if (parts.length < 3) return null;
        const column = parts[0];
        const operator = parts[1];
        const value = parts.slice(2).join('.'); // Re-join in case value contains dots
        return { column, operator, value };
      }).filter(Boolean);

      items = items.filter(item => {
        return conditions.some(cond => {
          const itemVal = (item[cond.column] || '').toString();
          switch (cond.operator) {
            case 'ilike': {
              const search = cond.value.replace(/^%|%$/g, '').toLowerCase();
              return itemVal.toLowerCase().includes(search);
            }
            case 'eq':
              return itemVal === cond.value;
            case 'neq':
              return itemVal !== cond.value;
            default:
              return true;
          }
        });
      });
    }
    return items;
  }

  /**
   * Sort items in-memory (DynamoDB only sorts by SK within a partition).
   */
  _sortItems(items) {
    const { column, ascending } = this._orderBy;
    return [...items].sort((a, b) => {
      const valA = a[column];
      const valB = b[column];
      if (valA == null && valB == null) return 0;
      if (valA == null) return ascending ? 1 : -1;
      if (valB == null) return ascending ? -1 : 1;

      // Try numeric comparison first
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return ascending ? numA - numB : numB - numA;
      }

      // String comparison (handles ISO dates naturally)
      const strA = String(valA);
      const strB = String(valB);
      return ascending ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }

  /**
   * Format the final result in Supabase-compatible shape.
   */
  _formatResult(items, totalCount = null) {
    if (this._isSingle) {
      if (items.length === 0) {
        if (this._maybeSingle) {
          return { data: null, error: null };
        }
        // Emulate PostgREST PGRST116 "Row not found"
        return {
          data: null,
          error: {
            message: 'JSON object requested, multiple (or no) rows returned',
            code: 'PGRST116',
          },
        };
      }
      return { data: items[0], error: null };
    }

    const result = { data: items, error: null };
    if (totalCount !== null) {
      result.count = totalCount;
    }
    return result;
  }

  // ── INSERT Execution ────────────────────────────────────────────────

  async _executeInsert() {
    const now = new Date().toISOString();
    const insertedItems = [];

    for (const rawItem of this._insertData) {
      const item = { ...rawItem };

      // Auto-generate ID if not provided
      if (!item.id && this._schema.sk === 'id') {
        item.id = uuidv4();
      }

      // Auto-timestamp
      if (!item.created_at) item.created_at = now;
      if (!item.updated_at) item.updated_at = now;

      await dynamoClient.send(new PutCommand({
        TableName: this._tableName,
        Item: item,
      }));

      insertedItems.push(item);
    }

    if (!this._returnData) {
      return { data: null, error: null };
    }

    if (this._isSingle) {
      return { data: insertedItems[0] || null, error: null };
    }
    return { data: insertedItems, error: null };
  }

  // ── UPDATE Execution ────────────────────────────────────────────────

  async _executeUpdate() {
    // First, find all items matching the filters
    const items = await this._scanOrQuery();
    const filtered = this._applyInMemoryFilters(items);

    if (filtered.length === 0) {
      return this._returnData
        ? { data: this._isSingle ? null : [], error: null }
        : { data: null, error: null };
    }

    const updatedItems = [];

    for (const existing of filtered) {
      const pk = existing[this._schema.pk];
      const sk = this._schema.sk ? existing[this._schema.sk] : undefined;

      const key = { [this._schema.pk]: pk };
      if (this._schema.sk) key[this._schema.sk] = sk;

      // Build SET expression
      const updateData = { ...this._updateData, updated_at: new Date().toISOString() };
      const setExpressions = [];
      const exprNames = {};
      const exprValues = {};

      Object.entries(updateData).forEach(([field, value], i) => {
        // Skip key fields
        if (field === this._schema.pk || field === this._schema.sk) return;
        const nameKey = `#u${i}`;
        const valKey = `:u${i}`;
        setExpressions.push(`${nameKey} = ${valKey}`);
        exprNames[nameKey] = field;
        exprValues[valKey] = value;
      });

      if (setExpressions.length > 0) {
        await dynamoClient.send(new UpdateCommand({
          TableName: this._tableName,
          Key: key,
          UpdateExpression: `SET ${setExpressions.join(', ')}`,
          ExpressionAttributeNames: exprNames,
          ExpressionAttributeValues: exprValues,
        }));
      }

      updatedItems.push({ ...existing, ...updateData });
    }

    if (!this._returnData) {
      return { data: null, error: null };
    }

    if (this._isSingle) {
      return { data: updatedItems[0] || null, error: null };
    }
    return { data: updatedItems, error: null };
  }

  // ── DELETE Execution ────────────────────────────────────────────────

  async _executeDelete() {
    const items = await this._scanOrQuery();
    const filtered = this._applyInMemoryFilters(items);

    for (const item of filtered) {
      const key = { [this._schema.pk]: item[this._schema.pk] };
      if (this._schema.sk) key[this._schema.sk] = item[this._schema.sk];

      await dynamoClient.send(new DeleteCommand({
        TableName: this._tableName,
        Key: key,
      }));
    }

    return { data: null, error: null };
  }

  // ── UPSERT Execution ────────────────────────────────────────────────

  async _executeUpsert() {
    const now = new Date().toISOString();
    const upsertedItems = [];
    const { onConflict, ignoreDuplicates } = this._upsertOptions;

    for (const rawItem of this._upsertData) {
      const item = { ...rawItem };

      // Auto-generate ID if not provided
      if (!item.id && this._schema.sk === 'id') {
        item.id = uuidv4();
      }
      if (!item.updated_at) item.updated_at = now;

      if (onConflict) {
        // Check if an item with the onConflict field value already exists
        const existingItems = await this._findByField(onConflict, item[onConflict]);

        if (existingItems.length > 0) {
          if (ignoreDuplicates) {
            // Skip — ignoreDuplicates: true means "don't overwrite"
            upsertedItems.push(existingItems[0]);
            continue;
          }
          // Merge: preserve existing key fields, update the rest
          const existing = existingItems[0];
          const merged = { ...existing, ...item };
          // Ensure key fields from existing item are preserved
          merged[this._schema.pk] = existing[this._schema.pk];
          if (this._schema.sk) merged[this._schema.sk] = existing[this._schema.sk];

          await dynamoClient.send(new PutCommand({
            TableName: this._tableName,
            Item: merged,
          }));
          upsertedItems.push(merged);
          continue;
        }
      }

      // No conflict or no existing item — insert
      if (!item.created_at) item.created_at = now;

      await dynamoClient.send(new PutCommand({
        TableName: this._tableName,
        Item: item,
      }));
      upsertedItems.push(item);
    }

    if (!this._returnData) {
      return { data: null, error: null };
    }

    if (this._isSingle) {
      return { data: upsertedItems[0] || null, error: null };
    }
    return { data: upsertedItems, error: null };
  }

  /**
   * Find items by a specific field (used by upsert for conflict detection).
   * Tries GSI first, falls back to full scan.
   */
  async _findByField(field, value) {
    if (value === undefined || value === null) return [];

    const gsiMap = GSI_MAP[this._supabaseTable] || {};

    if (gsiMap[field]) {
      // Use GSI for efficient lookup
      const result = await dynamoClient.send(new QueryCommand({
        TableName: this._tableName,
        IndexName: gsiMap[field],
        KeyConditionExpression: '#k = :v',
        ExpressionAttributeNames: { '#k': field },
        ExpressionAttributeValues: { ':v': value },
      }));
      return result.Items || [];
    }

    if (field === this._schema.pk) {
      // Query by partition key
      const result = await dynamoClient.send(new QueryCommand({
        TableName: this._tableName,
        KeyConditionExpression: '#k = :v',
        ExpressionAttributeNames: { '#k': field },
        ExpressionAttributeValues: { ':v': value },
      }));
      return result.Items || [];
    }

    // Fallback: scan with filter (less efficient)
    const result = await dynamoClient.send(new ScanCommand({
      TableName: this._tableName,
      FilterExpression: '#k = :v',
      ExpressionAttributeNames: { '#k': field },
      ExpressionAttributeValues: { ':v': value },
    }));
    return result.Items || [];
  }
}

// ─── Firestore-Compatible Wrapper ──────────────────────────────────────
// For track/route.js, track/click/route.js, and arbiter/index.js which
// use adminDb.collection('x').doc('y').get() / .set() / .update() / .add()
// ────────────────────────────────────────────────────────────────────────

export class DynamoDBFirestoreCompat {
  collection(collectionName) {
    return new DynamoCollection(collectionName);
  }

  batch() {
    return new DynamoBatch();
  }
}

class DynamoCollection {
  constructor(collectionName) {
    this._table = collectionName;
    this._tableName = resolveTableName(collectionName);
    this._schema = TABLE_SCHEMA[collectionName] || { pk: 'id', sk: null };
    this._whereFilters = [];
    this._orderByField = null;
    this._orderByDir = 'asc';
    this._limitCount = null;
    this._isCount = false;
  }

  doc(docId) {
    return new DynamoDoc(this._table, this._tableName, this._schema, docId);
  }

  /**
   * Firestore-style .add(data) — auto-generates an ID.
   */
  async add(data) {
    const id = uuidv4();
    const item = { ...data, id };
    if (!item.created_at) item.created_at = new Date().toISOString();
    if (!item.updated_at) item.updated_at = new Date().toISOString();

    await dynamoClient.send(new PutCommand({
      TableName: this._tableName,
      Item: item,
    }));

    return { id };
  }

  where(field, operator, value) {
    this._whereFilters.push({ field, operator, value });
    return this;
  }

  orderBy(field, direction = 'asc') {
    this._orderByField = field;
    this._orderByDir = direction;
    return this;
  }

  limit(count) {
    this._limitCount = count;
    return this;
  }

  count() {
    this._isCount = true;
    return this;
  }

  async get() {
    // Build scan params with filters
    const params = { TableName: this._tableName };
    const expressions = [];
    const names = {};
    const values = {};

    this._whereFilters.forEach((filter, i) => {
      const nameKey = `#w${i}`;
      const valKey = `:w${i}`;
      names[nameKey] = filter.field;
      values[valKey] = filter.value;

      switch (filter.operator) {
        case '==':
          expressions.push(`${nameKey} = ${valKey}`);
          break;
        case '>=':
          expressions.push(`${nameKey} >= ${valKey}`);
          break;
        case '<=':
          expressions.push(`${nameKey} <= ${valKey}`);
          break;
        case '>':
          expressions.push(`${nameKey} > ${valKey}`);
          break;
        case '<':
          expressions.push(`${nameKey} < ${valKey}`);
          break;
        case '!=':
          expressions.push(`${nameKey} <> ${valKey}`);
          break;
      }
    });

    if (expressions.length > 0) {
      params.FilterExpression = expressions.join(' AND ');
      params.ExpressionAttributeNames = names;
      params.ExpressionAttributeValues = values;
    }

    // Try to use Query if the first filter is on the PK
    let items;
    const pkFilter = this._whereFilters.find(f => f.field === this._schema.pk && f.operator === '==');

    if (pkFilter) {
      const queryParams = {
        TableName: this._tableName,
        KeyConditionExpression: '#pk = :pkVal',
        ExpressionAttributeNames: { '#pk': pkFilter.field },
        ExpressionAttributeValues: { ':pkVal': pkFilter.value },
      };

      // Move remaining filters to FilterExpression
      const remaining = this._whereFilters.filter(f => f !== pkFilter);
      if (remaining.length > 0) {
        const filterExprs = [];
        remaining.forEach((filter, i) => {
          const nk = `#qf${i}`;
          const vk = `:qf${i}`;
          queryParams.ExpressionAttributeNames[nk] = filter.field;
          queryParams.ExpressionAttributeValues[vk] = filter.value;
          const op = filter.operator === '==' ? '=' : filter.operator;
          filterExprs.push(`${nk} ${op} ${vk}`);
        });
        queryParams.FilterExpression = filterExprs.join(' AND ');
      }

      const allItems = [];
      let lastKey;
      do {
        if (lastKey) queryParams.ExclusiveStartKey = lastKey;
        const result = await dynamoClient.send(new QueryCommand(queryParams));
        if (result.Items) allItems.push(...result.Items);
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);
      items = allItems;
    } else {
      // Full scan
      const allItems = [];
      let lastKey;
      do {
        if (lastKey) params.ExclusiveStartKey = lastKey;
        const result = await dynamoClient.send(new ScanCommand(params));
        if (result.Items) allItems.push(...result.Items);
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);
      items = allItems;
    }

    // Sort
    if (this._orderByField) {
      const col = this._orderByField;
      const asc = this._orderByDir !== 'desc';
      items.sort((a, b) => {
        const va = a[col] || '';
        const vb = b[col] || '';
        return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
    }

    // Limit
    if (this._limitCount !== null) {
      items = items.slice(0, this._limitCount);
    }

    // Count mode
    if (this._isCount) {
      return { data: () => ({ count: items.length }) };
    }

    // Format as Firestore-like snapshot
    const docs = items.map(item => ({
      id: item.id || item[this._schema.pk],
      data: () => item,
      exists: true,
    }));

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach: (callback) => docs.forEach(callback),
    };
  }
}

class DynamoDoc {
  constructor(table, tableName, schema, docId) {
    this._table = table;
    this._tableName = tableName;
    this._schema = schema;
    this._docId = docId;
  }

  async get() {
    // Find the document by its ID using the id-index GSI
    const gsiMap = GSI_MAP[this._table] || {};
    let items = [];

    if (gsiMap['id']) {
      // Use id-index GSI
      const result = await dynamoClient.send(new QueryCommand({
        TableName: this._tableName,
        IndexName: 'id-index',
        KeyConditionExpression: '#id = :idVal',
        ExpressionAttributeNames: { '#id': 'id' },
        ExpressionAttributeValues: { ':idVal': this._docId },
      }));
      items = result.Items || [];
    } else if (this._schema.sk === null) {
      // PK-only table (user_settings, profiles) — docId IS the PK
      const result = await dynamoClient.send(new QueryCommand({
        TableName: this._tableName,
        KeyConditionExpression: '#pk = :pkVal',
        ExpressionAttributeNames: { '#pk': this._schema.pk },
        ExpressionAttributeValues: { ':pkVal': this._docId },
      }));
      items = result.Items || [];
    } else {
      // Fallback: scan for the doc
      const result = await dynamoClient.send(new ScanCommand({
        TableName: this._tableName,
        FilterExpression: '#id = :idVal',
        ExpressionAttributeNames: { '#id': 'id' },
        ExpressionAttributeValues: { ':idVal': this._docId },
      }));
      items = result.Items || [];
    }

    if (items.length === 0) {
      return { exists: false, data: () => null, id: this._docId };
    }

    const item = items[0];
    return { exists: true, data: () => item, id: this._docId };
  }

  async set(data, options = {}) {
    const item = { ...data };
    if (!item.id) item.id = this._docId;
    if (!item.updated_at) item.updated_at = new Date().toISOString();

    if (options.merge) {
      // Merge mode: get existing, then overwrite
      const existing = await this.get();
      if (existing.exists) {
        const merged = { ...existing.data(), ...item };
        await dynamoClient.send(new PutCommand({
          TableName: this._tableName,
          Item: merged,
        }));
        return;
      }
    }

    if (!item.created_at) item.created_at = new Date().toISOString();

    await dynamoClient.send(new PutCommand({
      TableName: this._tableName,
      Item: item,
    }));
  }

  async update(data) {
    const existing = await this.get();
    if (!existing.exists) {
      throw new Error(`Document ${this._docId} not found in ${this._table}`);
    }

    const currentData = existing.data();
    const key = { [this._schema.pk]: currentData[this._schema.pk] };
    if (this._schema.sk) key[this._schema.sk] = currentData[this._schema.sk];

    const updateData = { ...data, updated_at: new Date().toISOString() };
    const setExpressions = [];
    const exprNames = {};
    const exprValues = {};

    Object.entries(updateData).forEach(([field, value], i) => {
      if (field === this._schema.pk || field === this._schema.sk) return;
      const nk = `#u${i}`;
      const vk = `:u${i}`;
      setExpressions.push(`${nk} = ${vk}`);
      exprNames[nk] = field;
      exprValues[vk] = value;
    });

    if (setExpressions.length > 0) {
      await dynamoClient.send(new UpdateCommand({
        TableName: this._tableName,
        Key: key,
        UpdateExpression: `SET ${setExpressions.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
      }));
    }
  }
}

class DynamoBatch {
  constructor() {
    this._operations = [];
  }

  set(docRef, data, options = {}) {
    this._operations.push({ type: 'set', docRef, data, options });
    return this;
  }

  async commit() {
    for (const op of this._operations) {
      if (op.type === 'set') {
        await op.docRef.set(op.data, op.options);
      }
    }
  }
}

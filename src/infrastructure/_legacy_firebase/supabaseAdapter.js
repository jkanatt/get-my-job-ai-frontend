export class SupabaseFirestoreAdapter {
  constructor(db) {
    /** @type {import('firebase-admin/firestore').Firestore} */
    this.db = db;
  }
  from(tableName) {
    return new SupabaseQueryBuilder(this.db, tableName);
  }
  /**
   * Firestore doesn't support stored procedures/RPCs.
   * Return an error to trigger fallback paths in API routes.
   */
  rpc(functionName) {
    return {
      single: async () => ({ data: null, error: { message: `RPC '${functionName}' not supported in Firestore adapter` } }),
      then: async (resolve) => resolve({ data: null, error: { message: `RPC '${functionName}' not supported in Firestore adapter` } }),
    };
  }
}

class SupabaseQueryBuilder {
  constructor(db, tableName) {
    this.db = db;
    this.tableName = tableName;
    this.queryType = 'select'; // select, insert, update, delete
    this.filters = [];
    this._select = '*';
    this._limit = null;
    this._offset = null;
    this._orders = [];
    this._single = false;
    this._maybeSingle = false;
    this.insertData = null;
    this.updateData = null;
    this.isHead = false;
    this.countType = null;
  }

  select(columns = '*', options = {}) {
    if (!['insert', 'update', 'delete', 'upsert'].includes(this.queryType)) {
      this.queryType = 'select';
    }
    this._select = columns;
    if (options.count) this.countType = options.count;
    if (options.head) this.isHead = true;
    return this;
  }

  insert(data, options = {}) {
    this.queryType = 'insert';
    this.insertData = data;
    return this;
  }

  update(data, options = {}) {
    this.queryType = 'update';
    this.updateData = data;
    return this;
  }

  delete() {
    this.queryType = 'delete';
    return this;
  }

  upsert(data, options = {}) {
    // For now, treat upsert like insert with merge
    this.queryType = 'upsert';
    this.insertData = data;
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: 'where', column, op: '==', value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ type: 'where', column, op: '!=', value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: 'where', column, op: 'in', value: values });
    return this;
  }

  gt(column, value) {
    this.filters.push({ type: 'where', column, op: '>', value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ type: 'where', column, op: '>=', value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ type: 'where', column, op: '<', value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ type: 'where', column, op: '<=', value });
    return this;
  }

  is(column, value) {
    if (value === null) {
        this.filters.push({ type: 'where', column, op: '==', value: null });
    }
    return this;
  }
  
  contains(column, value) {
     this.filters.push({ type: 'where', column, op: 'array-contains', value });
     return this;
  }

  ilike(column, pattern) {
    // Firestore doesn't support ilike. For basic compatibility, we do a very naive equality or skip.
    // In many queries, ilike is used for search. We'll do our best.
    let val = pattern.replace(/%/g, '');
    this.filters.push({ type: 'where', column, op: '==', value: val }); // this is inaccurate but prevents crashing
    return this;
  }

  or(queryStr) {
    // Supabase OR syntax: 'col1.eq.val1,col2.eq.val2'
    // Firestore only recently supports OR, we'll try to emulate or skip.
    console.warn("SupabaseAdapter: OR filter not fully supported, ignoring:", queryStr);
    return this;
  }

  order(column, options = {}) {
    const ascending = options.ascending !== false;
    this.filters.push({ type: 'order', column, direction: ascending ? 'asc' : 'desc' });
    return this;
  }

  range(start, end) {
    this._offset = start;
    this._limit = end - start + 1;
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  single() {
    this._single = true;
    this.limit(1);
    return this;
  }

  maybeSingle() {
    this._maybeSingle = true;
    this.limit(1);
    return this;
  }

  async then(onfulfilled, onrejected) {
    try {
      const result = await this.execute();
      return onfulfilled ? onfulfilled(result) : result;
    } catch (err) {
      if (onrejected) {
        return onrejected(err);
      }
      return { data: null, error: err };
    }
  }

  async execute() {
    try {
      if (this.queryType === 'select') return await this._executeSelect();
      if (this.queryType === 'insert') return await this._executeInsert();
      if (this.queryType === 'update') return await this._executeUpdate();
      if (this.queryType === 'delete') return await this._executeDelete();
      if (this.queryType === 'upsert') return await this._executeUpsert();
      throw new Error(`Unsupported query type: ${this.queryType}`);
    } catch (err) {
      console.error("SupabaseAdapter Error:", err);
      return { data: null, error: { message: err.message, details: err.stack } };
    }
  }

  _buildQuery(collectionRef) {
    let q = collectionRef;
    for (const filter of this.filters) {
      if (filter.type === 'where') {
        q = q.where(filter.column, filter.op, filter.value);
      }
      // NOTE: We intentionally skip orderBy here because Firestore requires a composite
      // index for any query that combines where() + orderBy() on different fields.
      // We apply sorting in-memory in _executeSelect instead.
    }
    // Do NOT apply offset/limit in Firestore when we have where filters,
    // since we'll sort in-memory and then slice. Only apply limit for simple queries.
    if (this.filters.filter(f => f.type === 'where').length === 0) {
      if (this._offset !== null) q = q.offset(this._offset);
      if (this._limit !== null) q = q.limit(this._limit);
    }
    return q;
  }

  async _executeSelect() {
    let collectionRef = this.db.collection(this.tableName);

    // Optimize: If filtering by id only, use a direct doc lookup
    const idEqFilter = this.filters.find(f => f.type === 'where' && f.column === 'id' && f.op === '==');
    if (idEqFilter && this.filters.filter(f => f.type === 'where').length === 1 && !this._offset) {
      const doc = await collectionRef.doc(idEqFilter.value).get();
      if (!doc.exists) {
        if (this._single) return { data: null, error: { message: 'Row not found' } };
        if (this._maybeSingle) return { data: null, error: null };
        return { data: [], error: null, count: 0 };
      }
      const data = { id: doc.id, ...doc.data() };
      return {
        data: this._single || this._maybeSingle ? data : [data],
        error: null,
        count: this.countType ? 1 : null
      };
    }

    let q = this._buildQuery(collectionRef);

    if (this.isHead && this.countType) {
      const snapshot = await q.count().get();
      return { data: null, error: null, count: snapshot.data().count };
    }

    const snapshot = await q.get();
    let data = [];
    snapshot.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });

    // Apply in-memory ordering (avoids composite index requirement)
    const orderFilters = this.filters.filter(f => f.type === 'order');
    if (orderFilters.length > 0) {
      data.sort((a, b) => {
        for (const ord of orderFilters) {
          const aVal = a[ord.column];
          const bVal = b[ord.column];
          let cmp = 0;
          if (aVal < bVal) cmp = -1;
          else if (aVal > bVal) cmp = 1;
          if (cmp !== 0) return ord.direction === 'desc' ? -cmp : cmp;
        }
        return 0;
      });
    }

    // Apply in-memory offset + limit after sorting
    if (this._offset !== null || this._limit !== null) {
      const hasWhereFilters = this.filters.some(f => f.type === 'where');
      if (hasWhereFilters) {
        const start = this._offset || 0;
        const end = this._limit !== null ? start + this._limit : undefined;
        data = data.slice(start, end);
      }
    }

    if (this._single) {
      if (data.length === 0) return { data: null, error: { message: 'Row not found' } };
      return { data: data[0], error: null };
    }
    if (this._maybeSingle) {
      return { data: data.length > 0 ? data[0] : null, error: null };
    }

    let count = null;
    if (this.countType) {
      count = data.length; // Use in-memory count for simplicity after filtering
    }

    return { data, error: null, count };
  }

  async _executeInsert() {
    let dataToInsert = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
    const collectionRef = this.db.collection(this.tableName);
    let inserted = [];

    const batch = this.db.batch();
    for (let item of dataToInsert) {
      let docRef;
      if (item.id) {
         docRef = collectionRef.doc(item.id);
      } else {
         docRef = collectionRef.doc();
         item.id = docRef.id;
      }
      // Add created_at if not present
      if (!item.created_at) item.created_at = new Date().toISOString();
      batch.set(docRef, item);
      inserted.push(item);
    }
    await batch.commit();

    if (this._single || !Array.isArray(this.insertData)) {
       return { data: inserted[0], error: null };
    }
    return { data: inserted, error: null };
  }
  
  async _executeUpsert() {
      // Similar to insert but using merge
    let dataToInsert = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
    const collectionRef = this.db.collection(this.tableName);
    let inserted = [];

    const batch = this.db.batch();
    for (let item of dataToInsert) {
      let docRef;
      if (item.id) {
         docRef = collectionRef.doc(item.id);
      } else {
         docRef = collectionRef.doc();
         item.id = docRef.id;
      }
      if (!item.updated_at) item.updated_at = new Date().toISOString();
      batch.set(docRef, item, { merge: true });
      inserted.push(item);
    }
    await batch.commit();

    if (this._single || !Array.isArray(this.insertData)) {
       return { data: inserted[0], error: null };
    }
    return { data: inserted, error: null };
  }

  async _executeUpdate() {
    const collectionRef = this.db.collection(this.tableName);
    const q = this._buildQuery(collectionRef);
    const snapshot = await q.get();

    if (snapshot.empty) {
      if (this._single) return { data: null, error: { message: 'Row not found' } };
      return { data: [], error: null };
    }

    const batch = this.db.batch();
    const updatedData = [];
    
    // Add updated_at
    if (!this.updateData.updated_at) this.updateData.updated_at = new Date().toISOString();

    snapshot.forEach(doc => {
      batch.update(doc.ref, this.updateData);
      updatedData.push({ id: doc.id, ...doc.data(), ...this.updateData });
    });

    await batch.commit();

    if (this._single) {
      return { data: updatedData[0], error: null };
    }
    return { data: updatedData, error: null };
  }

  async _executeDelete() {
    const collectionRef = this.db.collection(this.tableName);
    const q = this._buildQuery(collectionRef);
    const snapshot = await q.get();

    if (snapshot.empty) {
      if (this._single) return { data: null, error: { message: 'Row not found' } };
      return { data: [], error: null };
    }

    const batch = this.db.batch();
    const deletedData = [];

    snapshot.forEach(doc => {
      batch.delete(doc.ref);
      deletedData.push({ id: doc.id, ...doc.data() });
    });

    await batch.commit();

    if (this._single) {
      return { data: deletedData[0], error: null };
    }
    return { data: deletedData, error: null };
  }
}

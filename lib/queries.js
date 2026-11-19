'use strict';

// Every query of the service, all read-only.
//
// The collection is the service's one setting (`datasetCollection`), never a
// request parameter: a request can filter and address records, it cannot
// choose where they are read from. Every value a request supplies travels as
// a bind variable.
//
// A dataset record follows the dictionary's `std_dataset` schema: the code
// (`std_dataset_code`), the dates, the count, `_info`, the classification
// container `std_dataset_domn` (extent, scope, theme, any further category)
// and the properties container `std_dataset_prop` (the collections the data
// lives in, the indicators, the key descriptors, the resolutions, …). The
// service returns records whole or as light overview rows; it never reads the
// dictionary — the gids a record carries are resolved by the interface, which
// holds the terms.

const { db, aql } = require('@arangodb');
const { context } = require('@arangodb/locals');

function collectionName() {
    return context.configuration.datasetCollection;
}

// The configured collection, or an error naming it when it is absent.
function collection() {
    const c = db._collection(collectionName());
    if (!c) throw new Error(`the configured dataset collection "${collectionName()}" does not exist in this database`);
    return c;
}

// The maintainer-only `_private` section never leaves the service.
function stripPrivate(doc) {
    if (!doc) return doc;
    const out = Object.assign({}, doc);
    delete out._private;
    return out;
}

// One overview row: what a list of datasets shows, and nothing a list does
// not need (no description, no indicator list — those are the record's).
// `std_dataset_domn` travels whole so the theme and any further category
// come with the row; `indicators` is the size of `std_terms`.
const ROW = aql`{
    _key: d._key,
    std_dataset_code: d.std_dataset_code,
    std_date_submission: d.std_date_submission,
    std_date_start: d.std_date_start,
    std_date_end: d.std_date_end,
    count: d.count,
    _info: KEEP(d._info, "_title", "_definition"),
    std_dataset_domn: d.std_dataset_domn,
    std_dataset_prop: KEEP(d.std_dataset_prop, "_collection_list", "std_dataset_resolution_grid", "std_dataset_resolution_source"),
    indicators: LENGTH(d.std_dataset_prop.std_terms)
}`;

// The filters of the overview, each one a bind variable. `theme`, `extent`
// and `scope` match the three classification properties; `collection` matches
// a member of `_collection_list`.
function filterClauses(filters) {
    const clauses = [];
    if (filters.theme)      clauses.push(aql`FILTER d.std_dataset_domn.std_dataset_theme == ${filters.theme}`);
    if (filters.extent)     clauses.push(aql`FILTER d.std_dataset_domn.std_dataset_extent == ${filters.extent}`);
    if (filters.scope)      clauses.push(aql`FILTER d.std_dataset_domn.std_dataset_scope == ${filters.scope}`);
    if (filters.collection) clauses.push(aql`FILTER ${filters.collection} IN d.std_dataset_prop._collection_list`);
    return aql.join(clauses, '\n');
}

// Overview rows, optionally filtered, sorted by code (the interface groups
// and sorts by localised title itself). Answers { total, rows }.
function overview(filters = {}) {
    const rows = db._query(aql`
        FOR d IN ${collection()}
            ${filterClauses(filters)}
            SORT d.std_dataset_code
            RETURN ${ROW}
    `).toArray();
    return { total: rows.length, rows };
}

// The figures of the entry page's summary boxes, computed on the fly over the
// whole collection (33 records: one pass): how many records, how many distinct
// indicators across every `std_terms`, how many distinct collections across
// every `_collection_list`, and the records per scope and per theme as
// gid → count maps (a record without the property is counted in `datasets`
// only). Nothing is stored for the page.
function summary() {
    return db._query(aql`
        LET recs = (FOR d IN ${collection()} RETURN d)
        RETURN {
            datasets:    LENGTH(recs),
            indicators:  LENGTH(UNIQUE(FLATTEN(recs[*].std_dataset_prop.std_terms))),
            collections: LENGTH(UNIQUE(FLATTEN(recs[*].std_dataset_prop._collection_list))),
            scopes: MERGE(FOR d IN recs
                FILTER d.std_dataset_domn.std_dataset_scope != null
                COLLECT s = d.std_dataset_domn.std_dataset_scope WITH COUNT INTO n
                RETURN { [s]: n }),
            themes: MERGE(FOR d IN recs
                FILTER d.std_dataset_domn.std_dataset_theme != null
                COLLECT t = d.std_dataset_domn.std_dataset_theme WITH COUNT INTO n
                RETURN { [t]: n })
        }
    `).toArray()[0];
}

// One record by code — the identifier a text names a dataset by, never the
// key (keys are collection-assigned and change on a reload into a fresh
// collection; the code is required and immutable). Null when no record
// carries the code.
function byCode(code) {
    const doc = db._query(aql`
        FOR d IN ${collection()}
            FILTER d.std_dataset_code == ${code}
            LIMIT 1
            RETURN d
    `).toArray()[0];
    return stripPrivate(doc) || null;
}

// The datasets whose `std_terms` (the indicators the data carries) or
// `std_terms_key` (the descriptors that identify one record) hold a gid.
// Each row says where the term was found in `holds`.
function holdingTerm(gid) {
    const rows = db._query(aql`
        FOR d IN ${collection()}
            LET holds = APPEND(
                ${gid} IN d.std_dataset_prop.std_terms     ? ["std_terms"]     : [],
                ${gid} IN d.std_dataset_prop.std_terms_key ? ["std_terms_key"] : []
            )
            FILTER LENGTH(holds) > 0
            SORT d.std_dataset_code
            RETURN MERGE(${ROW}, { holds })
    `).toArray();
    return { total: rows.length, rows };
}

// The collections the datasets are stored in: for each name in any record's
// `_collection_list`, the codes of the datasets stored there and the live
// document count of the collection (null when the collection does not exist
// in this database — the record then names a collection that is elsewhere or
// gone). The live count is the collection's own; a record's `count` describes
// its first collection only.
function collections() {
    const groups = db._query(aql`
        FOR d IN ${collection()}
            FOR c IN d.std_dataset_prop._collection_list
                COLLECT name = c INTO codes = d.std_dataset_code
                SORT name
                RETURN { collection: name, datasets: SORTED(codes) }
    `).toArray();
    for (const g of groups) {
        const c = db._collection(g.collection);
        g.exists = Boolean(c);
        g.count = c ? c.count() : null;
    }
    return groups;
}

module.exports = { collectionName, collection, stripPrivate, summary, overview, byCode, holdingTerm, collections };

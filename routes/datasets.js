'use strict';
const createRouter = require('@arangodb/foxx/router');
const joi = require('joi');
const { summary, overview, byCode, holdingTerm, collections } = require('../lib/queries');
const metadata = require('./metadata/datasets');
const router = createRouter();

// Swagger grouping: every route in this file appears under "Datasets".
router.tag('Datasets');

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

const Gid = joi.string().description('A dictionary term gid');

// One overview row (see routes/metadata/datasets.js, ROW_SHAPE).
const Row = joi.object({
    _key:                joi.string().required().description('The record key (collection-assigned; never address a dataset by it)'),
    std_dataset_code:    joi.string().required().description('The dataset code, the identifier of every route'),
    std_date_submission: joi.string().description('When the record entered the database'),
    std_date_start:      joi.string().description('The earliest date the data covers'),
    std_date_end:        joi.string().description('The latest date the data covers'),
    count:               joi.number().integer().description('Records stored, of the first collection of _collection_list'),
    _info:               joi.object({
        _title:      joi.object().description('Multilingual title'),
        _definition: joi.object().description('Multilingual definition, when the record has one')
    }).unknown(true).description('The record\'s _info reduced to title and definition'),
    std_dataset_domn:    joi.object().unknown(true).required().description('The classification container, whole: extent, scope, theme, any further category'),
    std_dataset_prop:    joi.object({
        _collection_list:              joi.array().items(joi.string()).description('The collections the data lives in'),
        std_dataset_resolution_grid:   joi.number().description('Edge of one stored cell, decimal degrees'),
        std_dataset_resolution_source: joi.number().description('Pixel size of the source raster, metres')
    }).unknown(true).description('The properties container reduced to the collections and the resolutions'),
    indicators:          joi.number().integer().required().description('The number of indicators in std_terms'),
    holds:               joi.array().items(joi.string().valid('std_terms', 'std_terms_key')).description('GET /term/:gid only: where the gid was found')
}).unknown(true);

const Rows = joi.object({
    total: joi.number().integer().required().description('The number of rows'),
    rows:  joi.array().items(Row).required()
});

const CollectionSummary = joi.object({
    collection: joi.string().required().description('A collection name found in a record\'s _collection_list'),
    datasets:   joi.array().items(joi.string()).required().description('The codes of the datasets stored there, sorted'),
    exists:     joi.boolean().required().description('Whether a collection of that name exists in this database'),
    count:      joi.number().integer().allow(null).required().description('The collection\'s live document count; null when it does not exist')
});

const Counts = joi.object().pattern(/^/, joi.number().integer()).description('gid → number of records');

const Summary = joi.object({
    datasets:    joi.number().integer().required().description('The records in the collection'),
    indicators:  joi.number().integer().required().description('Distinct gids across every record\'s std_terms'),
    collections: joi.number().integer().required().description('Distinct names across every record\'s _collection_list'),
    scopes:      Counts.required().description('Records per std_dataset_scope value'),
    themes:      Counts.required().description('Records per std_dataset_theme value')
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /summary
router.get('/summary', function (req, res) {
    res.json(summary());
}, 'dataset-summary')
.response(200, Summary, ['application/json'], 'The figures of the entry page: records, distinct indicators, distinct collections, records per scope and per theme')
.summary(metadata.summary.summary)
.description(metadata.summary.description);

// GET /overview?theme=&extent=&scope=&collection=
router.get('/overview', function (req, res) {
    res.json(overview(req.queryParams));
}, 'dataset-overview')
.queryParam('theme',      Gid.description('Keep the records whose std_dataset_theme is this gid (e.g. std_dataset_theme_climate)'))
.queryParam('extent',     Gid.description('Keep the records whose std_dataset_extent is this gid (std_dataset_extent_region, std_dataset_extent_gcu)'))
.queryParam('scope',      Gid.description('Keep the records whose std_dataset_scope is this gid (std_dataset_scope_grid, std_dataset_scope_shape)'))
.queryParam('collection', joi.string().description('Keep the records whose _collection_list names this collection (e.g. ShapeData)'))
.response(200, Rows, ['application/json'], 'The matching records as overview rows, sorted by code')
.summary(metadata.overview.summary)
.description(metadata.overview.description);

// GET /record/:code
router.get('/record/:code', function (req, res) {
    const doc = byCode(req.pathParams.code);
    if (!doc) { res.throw(404, 'No dataset with this code'); }
    res.json(doc);
}, 'dataset-record')
.pathParam('code', joi.string().required(), 'The dataset code, std_dataset_code (e.g. CHELSA_V2.1)')
.response(['application/json'], 'The record as stored, with _private stripped')
.error(404, 'No record carries this code')
.summary(metadata.record.summary)
.description(metadata.record.description);

// GET /collections
router.get('/collections', function (req, res) {
    res.json(collections());
}, 'dataset-collections')
.response(200, joi.array().items(CollectionSummary), ['application/json'], 'One entry per collection named by a record, sorted by name')
.summary(metadata.collections.summary)
.description(metadata.collections.description);

// GET /term/:gid
router.get('/term/:gid', function (req, res) {
    res.json(holdingTerm(req.pathParams.gid));
}, 'dataset-term')
.pathParam('gid', Gid.required(), 'A descriptor gid (e.g. env_climate_bio01, geometry_point)')
.response(200, Rows, ['application/json'], 'The records holding the gid in std_terms or std_terms_key, as overview rows with `holds`')
.summary(metadata.term.summary)
.description(metadata.term.description);

module.exports = router;

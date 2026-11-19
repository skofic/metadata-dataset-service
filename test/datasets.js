/*global describe, it */
'use strict';

// Tests for the Datasets family against the GeoService `Dataset` collection as
// loaded on the laptop (33 records, 2026-11-19). The figures pinned here move
// with the collection: when a pipeline adds a dataset, a test fails loudly and
// the figure is re-pinned together with the Swagger prose that quotes it
// (routes/metadata/datasets.js). Run with
// POST /_db/GeoService/_api/foxx/tests?mount=/dataset&reporter=default.

const { expect } = require('chai');
const request = require('@arangodb/request');
const { db } = require('@arangodb');
const baseUrl = module.context.baseUrl;

function get(path) {
    const res = request.get(baseUrl + path);
    return { status: res.status, body: res.body ? JSON.parse(res.body) : null };
}

const ROW_KEYS = ['_key', 'std_dataset_code', 'count', '_info', 'std_dataset_domn', 'std_dataset_prop', 'indicators'];

describe('GET /summary', function () {

    it('answers the figures of the entry page, computed over the collection', function () {
        const r = get('/summary');
        expect(r.status).to.equal(200);
        expect(r.body).to.have.all.keys('datasets', 'indicators', 'collections', 'scopes', 'themes');
        expect(r.body.datasets).to.equal(33);
        expect(r.body.indicators).to.equal(135);
        expect(r.body.collections).to.equal(12);
        expect(r.body.scopes).to.deep.equal({ std_dataset_scope_grid: 17, std_dataset_scope_shape: 16 });
        expect(r.body.themes).to.deep.equal({
            'std_dataset_theme_climate': 3,
            'std_dataset_theme_drought': 7,
            'std_dataset_theme_topography': 1,
            'std_dataset_theme_remote-sensing': 13,
            'std_dataset_theme_occurrences': 1,
            'std_dataset_theme_distribution': 4,
            'std_dataset_theme_scatterplot': 4
        });
    });

    it('agrees with the overview and the collections routes', function () {
        const s = get('/summary').body;
        expect(s.datasets).to.equal(get('/overview').body.total);
        expect(s.collections).to.equal(get('/collections').body.length);
        expect(Object.values(s.scopes).reduce((a, b) => a + b, 0)).to.equal(s.datasets);
    });
});

describe('GET /overview', function () {

    it('answers every record as an overview row, sorted by code', function () {
        const r = get('/overview');
        expect(r.status).to.equal(200);
        expect(r.body.total).to.equal(33);
        expect(r.body.rows).to.have.lengthOf(33);
        const codes = r.body.rows.map(x => x.std_dataset_code);
        expect(codes).to.deep.equal([...codes].sort());
        expect(new Set(codes).size).to.equal(33);
    });

    it('keeps a row light: title and definition only, collections and resolutions only, no indicator list', function () {
        const row = get('/overview').body.rows.find(x => x.std_dataset_code === 'CHELSA_V2.1');
        expect(row).to.include.all.keys(ROW_KEYS);
        expect(row._info).to.have.property('_title');
        expect(row._info).to.not.have.property('_description');
        expect(row.std_dataset_prop).to.not.have.property('std_terms');
        expect(row.std_dataset_prop._collection_list).to.deep.equal(['Chelsa']);
        expect(row.std_dataset_prop.std_dataset_resolution_grid).to.equal(0.0083333333);
        expect(row.std_dataset_prop.std_dataset_resolution_source).to.equal(1000);
        expect(row.std_dataset_domn.std_dataset_theme).to.equal('std_dataset_theme_climate');
        expect(row.indicators).to.equal(74);
        expect(row.count).to.equal(27071711);
        expect(row).to.not.have.property('_private');
    });

    it('filters by theme, extent, scope and collection', function () {
        expect(get('/overview?theme=std_dataset_theme_climate').body.total).to.equal(3);
        expect(get('/overview?theme=std_dataset_theme_remote-sensing').body.total).to.equal(13);
        expect(get('/overview?extent=std_dataset_extent_gcu').body.total).to.equal(15);
        expect(get('/overview?scope=std_dataset_scope_grid').body.total).to.equal(17);
        expect(get('/overview?collection=ShapeData').body.total).to.equal(13);
        expect(get('/overview?collection=DroughtObservatory').body.total).to.equal(7);
    });

    it('combines filters with AND', function () {
        const r = get('/overview?theme=std_dataset_theme_distribution&scope=std_dataset_scope_grid');
        expect(r.body.total).to.equal(3);
        expect(r.body.rows.map(x => x.std_dataset_code)).to.deep.equal(['ATLAS_MHS_2016', 'ATLAS_RPP_2016', 'EU-TREES4F_MAPS_2022']);
    });

    it('answers an unknown filter value with an empty list, not an error', function () {
        const r = get('/overview?theme=std_dataset_theme_nothing');
        expect(r.status).to.equal(200);
        expect(r.body).to.deep.equal({ total: 0, rows: [] });
    });
});

describe('GET /record/:code', function () {

    it('answers the whole record, as stored', function () {
        const r = get('/record/CHELSA_V2.1');
        expect(r.status).to.equal(200);
        const d = r.body;
        expect(d.std_dataset_code).to.equal('CHELSA_V2.1');
        expect(d._info._description.ISO_639_3_eng).to.be.a('string').that.is.not.empty;
        expect(d._info._references._citation).to.have.lengthOf(4);
        expect(d.std_dataset_prop.std_terms).to.have.lengthOf(74);
        expect(d.std_dataset_prop.std_terms_key).to.deep.equal(['geometry_point']);
        expect(d.std_dataset_domn).to.deep.equal({
            std_dataset_extent: 'std_dataset_extent_region',
            std_dataset_scope:  'std_dataset_scope_grid',
            std_dataset_theme:  'std_dataset_theme_climate'
        });
        expect(d).to.not.have.property('_private');
    });

    it('matches the code exactly and answers 404 otherwise', function () {
        expect(get('/record/chelsa_v2.1').status).to.equal(404);
        expect(get('/record/NO_SUCH_DATASET').status).to.equal(404);
    });
});

describe('GET /collections', function () {

    it('lists every collection a record names, with its datasets and its live count', function () {
        const r = get('/collections');
        expect(r.status).to.equal(200);
        const names = r.body.map(x => x.collection);
        expect(names).to.deep.equal([...names].sort());
        expect(names).to.include.members(['Chelsa', 'DroughtObservatory', 'ShapeData', 'UnitData', 'ScatterMaps', 'WorldClim']);
        expect(r.body).to.have.lengthOf(12);
        const chelsa = r.body.find(x => x.collection === 'Chelsa');
        expect(chelsa.datasets).to.deep.equal(['CHELSA_V2.1']);
        expect(chelsa.exists).to.equal(true);
        expect(chelsa.count).to.equal(db._collection('Chelsa').count());
        const shapeData = r.body.find(x => x.collection === 'ShapeData');
        expect(shapeData.datasets).to.have.lengthOf(13);
        expect(shapeData.datasets).to.deep.equal([...shapeData.datasets].sort());
    });
});

describe('GET /term/:gid', function () {

    it('answers the datasets holding an indicator, each saying where', function () {
        const r = get('/term/env_climate_bio01');
        expect(r.status).to.equal(200);
        expect(r.body.total).to.equal(5);
        expect(r.body.rows.map(x => x.std_dataset_code)).to.deep.equal(['CHELSA_V2.1', 'EU-TREES4F_PREDICTORS_2022', 'SCATTER_OCCURRENCES', 'SCATTER_UNITS', 'WORLDCLIM_V2.1']);
        for (const row of r.body.rows) {
            expect(row.holds).to.deep.equal(['std_terms']);
            expect(row).to.include.all.keys(ROW_KEYS);
        }
    });

    it('finds a key descriptor too, and says which role it plays in each dataset', function () {
        const r = get('/term/geometry_point');
        expect(r.body.total).to.equal(6);
        const holds = Object.fromEntries(r.body.rows.map(x => [x.std_dataset_code, x.holds]));
        expect(holds['CHELSA_V2.1']).to.deep.equal(['std_terms_key']);
        expect(holds['EU-FOREST_2017']).to.deep.equal(['std_terms', 'std_terms_key']);
        expect(holds['SCATTER_UNITS']).to.deep.equal(['std_terms']);
    });

    it('answers an unknown gid with an empty list, not an error', function () {
        const r = get('/term/no_such_term');
        expect(r.status).to.equal(200);
        expect(r.body).to.deep.equal({ total: 0, rows: [] });
    });
});

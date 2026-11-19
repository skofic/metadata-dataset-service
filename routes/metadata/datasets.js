'use strict';

// Shared Swagger prose for the Datasets family. Every route prepends the
// primer to its own description: the house rule is that a route says
// everything it needs to say, even where that repeats a neighbour, so nobody
// has to read the route next door to understand this one.

const MOUNT = module.context.mount;   // live mount path (e.g. '/dataset') — keeps the examples in sync with the actual mount

const PRIMER =
    '### What a dataset record is\n\n' +
    'A **dataset** is a body of data records produced by one source — a climatology\'s grid cells, the ' +
    'averages of a satellite product over the conservation units, a field campaign — and its **record** is ' +
    'the catalogue entry that documents it. The records live in one collection of this database (the ' +
    'service\'s `datasetCollection` setting; `Dataset` in GeoService) and follow the data dictionary\'s ' +
    '`std_dataset` schema:\n\n' +
    '- `std_dataset_code` — the code a reader recognises, `CHELSA_V2.1`; required, immutable, unique in the ' +
    'collection, and **the identifier every route of this service addresses a dataset by**. A `_key` is ' +
    'collection-assigned and changes on a reload into a fresh collection; a code survives.\n' +
    '- `std_date_submission`, `std_date_start`, `std_date_end`, `count` — when the record entered the ' +
    'database, the dates the data covers, how many records are stored (of the **first** collection of ' +
    '`_collection_list` only).\n' +
    '- `_info` — the dataset\'s documentation: `_title`, `_description`, `_references` (`_citation`, ' +
    '`_provider`, `_url`), `_issues`, sometimes `_methods`. The texts are multilingual dictionaries keyed by ' +
    'ISO 639-3 gid (`ISO_639_3_eng`); the interface picks the reader\'s language.\n' +
    '- `std_dataset_domn` — the classification: `std_dataset_extent` (region or conservation unit), ' +
    '`std_dataset_scope` (grid or shape), `std_dataset_theme` (the heading the dataset pages list the record ' +
    'under — climate grids, drought grids, …), plus any further category. Values are dictionary gids.\n' +
    '- `std_dataset_prop` — the facts: `_collection_list` (the collections the data lives in), `std_terms` ' +
    '(the indicators the data carries, as gids), `std_terms_key` (the descriptors that identify one record), ' +
    '`std_dataset_resolution_grid` (degrees, a gridded dataset) and `std_dataset_resolution_source` (metres, ' +
    'the raster the data was built from), `species_list`, `gcu_id_number_list`, `std_dataset_markers`, ' +
    '`std_terms_summary`.\n\n' +
    'The service **does not read the dictionary**: a Foxx service cannot leave its database, and it does not ' +
    'need to — every gid a record carries is a term the interface already resolves and caches through ' +
    'the dictionary\'s `/ui` service. It answers anonymously, writes nothing, and strips the maintainer-only ' +
    '`_private` section from every record. Install it in every database that holds dataset records and set ' +
    'the collection name; the routes are the same everywhere.\n\n';

const ROW_SHAPE =
    '**An overview row** is the record without its long parts: `_key`, `std_dataset_code`, the three dates, ' +
    '`count`, `_info` reduced to `_title` and `_definition`, `std_dataset_domn` whole (so the theme travels ' +
    'with the row), `std_dataset_prop` reduced to `_collection_list` and the two resolutions, and ' +
    '`indicators`, the number of entries in `std_terms`. Rows are sorted by code; the interface groups them ' +
    'by theme and sorts by localised title itself.\n\n';

module.exports = {
    PRIMER,

    overview: {
        summary: 'The datasets as overview rows, optionally filtered',
        description:
            '**Purpose.** Use this route to list the datasets: the entry page of the dataset pages (every ' +
            'record under its theme heading), a theme page (the rows of one theme), the datasets of one ' +
            'collection, or any other list. It returns light rows, never the descriptions or the indicator ' +
            'lists — those come with the record (`GET /record/:code`, below).\n\n' +
            PRIMER + ROW_SHAPE +
            '**This route.** One query over the collection. Four optional filters, combined with AND: `theme`, ' +
            '`extent` and `scope` take a gid of the respective enumeration (`std_dataset_theme_climate`, ' +
            '`std_dataset_extent_gcu`, `std_dataset_scope_grid`); `collection` takes a collection name and ' +
            'keeps the records whose `_collection_list` names it. An unknown value is not an error: it matches ' +
            'nothing and the answer is `{ total: 0, rows: [] }`.\n\n' +
            '**Examples**\n\n' +
            '```\n' +
            'GET ' + MOUNT + '/overview\n' +
            'GET ' + MOUNT + '/overview?theme=std_dataset_theme_climate\n' +
            'GET ' + MOUNT + '/overview?collection=ShapeData&scope=std_dataset_scope_shape\n' +
            '```\n' +
            'The first answers every record; the second the climate grids (`{ total: 3, rows: [ { std_dataset_code: ' +
            '"CHELSA_V2.1", std_dataset_domn: { std_dataset_theme: "std_dataset_theme_climate", … }, indicators: 74, … }, … ] }`); ' +
            'the third the shape-average datasets stored in `ShapeData`.'
    },

    record: {
        summary: 'One dataset record, by code',
        description:
            '**Purpose.** Use this route to show a dataset page: the whole record — description, references, ' +
            'issues, the indicator list, the key descriptors, the collections, the resolutions. A text names a ' +
            'dataset by its code (`[CHELSA](dataset:CHELSA_V2.1)`), and this is the route that code resolves to.\n\n' +
            PRIMER +
            '**This route.** The record whose `std_dataset_code` equals the path parameter, as stored, with ' +
            '`_private` stripped. Codes are unique within the collection, so at most one record answers; `404` ' +
            'when none does. The code is matched exactly, case included. Resolve the gids of `std_terms`, ' +
            '`std_terms_key` and `std_dataset_domn` against the dictionary\'s `/ui/term/bulk` to show titles, ' +
            'definitions and units.\n\n' +
            '**Example**\n\n' +
            '```\n' +
            'GET ' + MOUNT + '/record/CHELSA_V2.1\n' +
            '```\n' +
            'Answers the record: `_info._title`, `_info._description` (Markdown), `_info._references._citation` ' +
            '(four strings), `std_dataset_domn` with extent, scope and theme, `std_dataset_prop.std_terms` with ' +
            '74 indicator gids, `std_dataset_prop._collection_list` `["Chelsa"]`, `count` 27 071 711.'
    },

    collections: {
        summary: 'The collections the datasets are stored in',
        description:
            '**Purpose.** Use this route for the *Collections* summary of the dataset pages: which collections ' +
            'of this database hold dataset records, which datasets each one holds, and how many documents it ' +
            'has. A collection name in the summary opens the overview filtered on it (`GET /overview?collection=…`).\n\n' +
            PRIMER +
            '**This route.** The distinct names found in every record\'s `_collection_list`, sorted, each with ' +
            'the codes of the datasets that name it (sorted) and two facts read from the database itself: ' +
            '`exists`, whether a collection of that name is present here, and `count`, its live document count ' +
            '(`null` when absent). The live count is the collection\'s own total; a record\'s `count` describes ' +
            'the first collection of its `_collection_list` only, and several records may share one collection ' +
            '(`ShapeData` holds the shape averages of every remote-sensing dataset).\n\n' +
            '**Example**\n\n' +
            '```\n' +
            'GET ' + MOUNT + '/collections\n' +
            '```\n' +
            'Answers `[ { collection: "Chelsa", datasets: ["CHELSA_V2.1"], exists: true, count: 27071711 }, ' +
            '{ collection: "DroughtObservatory", datasets: ["EDO_CDI", …], … }, … ]`.'
    },

    term: {
        summary: 'The datasets that hold a term',
        description:
            '**Purpose.** Use this route on a term page to list the datasets the term appears in — the ' +
            'section beside *In the manual*: a descriptor is useless without the data it describes, and this is ' +
            'the link from the descriptor to the data. Ask every dataset service the interface knows (one per ' +
            'database) and merge the answers.\n\n' +
            PRIMER + ROW_SHAPE +
            '**This route.** The records whose `std_terms` (the indicators the data carries) or `std_terms_key` ' +
            '(the descriptors that identify one record) contain the gid, as overview rows, each with one more ' +
            'field: `holds`, the list of the two properties the gid was found in (`["std_terms"]`, ' +
            '`["std_terms_key"]` or both). An empty answer is not an error: `{ total: 0, rows: [] }`. The gid ' +
            'is matched exactly; nothing is resolved against the dictionary.\n\n' +
            '**Example**\n\n' +
            '```\n' +
            'GET ' + MOUNT + '/term/env_climate_bio01\n' +
            '```\n' +
            'Answers the five datasets that carry the annual mean temperature: `CHELSA_V2.1`, ' +
            '`EU-TREES4F_PREDICTORS_2022`, `SCATTER_OCCURRENCES`, `SCATTER_UNITS`, `WORLDCLIM_V2.1`, each with ' +
            '`holds: ["std_terms"]`. `GET ' + MOUNT + '/term/geometry_point` answers six, `CHELSA_V2.1` among them ' +
            'with `holds: ["std_terms_key"]`: the cell centroid identifies a record there but is not an indicator.'
    }
};

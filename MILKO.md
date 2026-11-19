# MILKO.md — metadata-dataset-service

Architecture and design decisions of the dataset Foxx service, for whoever maintains it. The README says how to install and what the routes answer; this file says why it is built this way.

## What it is

The read API of the dataset pages: one Foxx service, mounted at `/dataset` in every database that holds dataset records, serving those records whole or as light overview rows. It was designed in the `metadata-store` round of 2026-11-18 (`indicator-pair-scatterplots/notes/2026-11-18-metadata-store-datasets-pages-answers.md`, §2 and §3) and built on 2026-11-19 as step 2 of the datasets round: step 1 gave the dictionary the theme vocabulary (`std_dataset_theme`), step 3 builds the pages in the interface.

It replaces the earlier `/dataset` placeholder in the `metadata` database (`skofic/eufgis-dataset-web-service`), which was uninstalled: its teardown dropped the dataset collection, its setup declared an index on a field no record has, and its one route returned `_private`.

## Layout

```
manifest.json            name, version, the one configuration option, scripts, tests
main.js                  mounts routes/datasets.js at the service root
lib/queries.js           every query (AQL), the collection accessor, stripPrivate
routes/datasets.js       the five routes, their joi models, the Swagger tag "Datasets"
routes/metadata/         the Swagger prose: a shared primer, one block per route
scripts/setup.js         reports on the configured collection; creates nothing
scripts/teardown.js      removes nothing
test/datasets.js         Mocha + chai, pinned figures of GeoService.Dataset
```

The layout is the `/ui` service's (`metadata-store-service`): `router.tag()` for the Swagger group, prose out of the code in `routes/metadata/`, AQL in `lib/`, handlers that delegate, examples built from `module.context.mount` so they follow a remount.

## Design decisions

**One service, one setting, installed per database.** A Foxx service lives in one database and cannot query another. The two dataset registries sit in two databases (`GeoService.Dataset`, `metadata.dataset`), so the same code is installed twice and `datasetCollection` names the collection in each. The interface reads the GeoService instance for *External Datasets* and will read the metadata instance for *Internal Datasets*; the routes are identical, so the pages are written once.

**No dictionary access.** The records carry gids (indicators, key descriptors, the classification) and multilingual texts. The service returns them as stored; the interface already holds the terms (cached bulk lookups through `/ui/term/bulk`) and already localises texts. Reaching the dictionary from GeoService would mean HTTP to `/ui` from inside Foxx, as the panes service does for one validation route — a dependency the pages do not need. Consequence: no language parameter, no title resolution, no unit lookup here.

**Code, never key.** `std_dataset_code` is required, immutable and unique in a registry; a `_key` is collection-assigned (short numbers on the scatterplot records, portal UUIDs on others) and changes when a collection is reloaded. Texts link a dataset as `[title](dataset:<code>)`, the page address is `#/dataset/<code>`, and `GET /record/:code` is what both resolve to. Measured 2026-11-19: all 33 codes match `[A-Za-z0-9_.-]+`, so they need no escaping in a URL.

**Setup and teardown touch nothing.** The records are written by three pipelines that own them; the service only reads. No index either: the registry is 33 records (29 in metadata), a full scan is microseconds, and an index on the code would be the first write this service makes to a collection it does not own. If a registry ever grows to thousands of records, add a persistent index on `std_dataset_code` in setup — by name, created when absent — and nothing else changes.

**The collection comes from the configuration, never from a request.** Request values (filters, the code, the gid) are bind variables; the collection object is passed into the `aql` template, which binds it as `@@collection`. Nothing a client sends reaches the query text.

**Overview rows are a fixed projection.** A list of 33 datasets must not carry 33 descriptions and 33 indicator lists. The row keeps what the census page's *At a glance* table shows: code, title, theme (through `std_dataset_domn` whole, so any further category comes along), scope and extent, the two resolutions, the dates, the count, the number of indicators, the collections. The record route gives the rest.

**The summary is computed, never stored.** `GET /summary` makes one pass over the collection (33 records) each time it is asked: the figures of the entry page's boxes are a function of the records as they are, and storing them would add a thing to keep in step. The route is also the interface's probe: a drawer entry whose service does not answer `/summary` is not shown (the showcase server has no GeoService).

**`holds` on the term route.** A gid can be an indicator of a dataset (`std_terms`), a key descriptor (`std_terms_key`), or both; a term page wants to say which. The row gains `holds`, the list of the properties the gid was found in, instead of two routes or a mode parameter.

**Live counts on the collections route.** `GET /collections` reads each collection's own count from the database (O(1) in RocksDB), beside the dataset codes stored there. A record's `count` is a different number: the records of that dataset in the *first* collection of its `_collection_list`. Both are shown by the pages; this route gives the one the record does not have.

**`_private` stripped everywhere.** The dictionary's strip-on-export rule, applied in `stripPrivate` on the record route; the row projection never selects it. No GeoService record carries the section today.

## Pinned figures

`test/datasets.js` pins counts of the laptop's `GeoService.Dataset` (33 records on 2026-11-19: 3 climate, 7 drought, 1 topography, 13 remote sensing, 1 occurrences, 4 distribution, 4 scatterplot; 15 `gcu` / 18 `region`; 17 grid / 16 shape; 12 collections; `ShapeData` and `UnitData` 13 datasets each). The Swagger prose quotes some of them. When a pipeline adds a dataset the suite fails on the moved figure: re-pin test and prose together, as the `/ui` service does for its search figures. The laptop's copy of `GeoService.Dataset` is the reference (`../shared/deployments.md`).

## Running the suite

```
POST /_db/GeoService/_api/foxx/tests?mount=/dataset&reporter=default
```

with the database credentials. On the laptop the mount's `APP` directory is the git clone and development mode is on (the owner's habit for every service of the stack), so an edit is live at once and the suite runs against the working tree; a server takes the bundle and is upgraded with PATCH.

## What comes next

- **Statistics from the data collections** (the owner's requirement): `count`, `std_date_start`, `std_date_end` are read from the record, never computed at request time — the collections are too large (`DroughtObservatory` 1.7 G documents, the grids unindexed on `std_dataset_ids`). Today the pipelines write them after a load (`metadata-external-databases/sources/remote-sensing/summarise.js`: one full pass, `count` = the first collection of `_collection_list`, `std_date_end` observed, `std_date_start` declared and only checked; `std_terms` declared, never derived). The owner's earlier service updated the records in a batch; the Foxx way is a manifest **script** (`POST /_api/foxx/scripts/<name>`) run on demand or queued in the background with Foxx queues — the `_compute_service_dataset-stats` process the dictionary names. To be designed with the owner.
- **The census page as pages**: the mapping of `DatasetsCensus.html` (`metadata-external-databases/data/datasets_census.js`) onto entry page, theme pages, collections summary and dataset pages, and what each needs from this service beyond the five routes.
- **The `metadata` instance**, once the portal records are normalised to the `std_dataset` shape.
- **The showcase server does not get this service** (owner, 2026-11-19): the machine is small and holds only the panes' collections, not GeoService. The interface's two drawer entries therefore have to cope with an unreachable dataset service — hide or say so — rather than fail.

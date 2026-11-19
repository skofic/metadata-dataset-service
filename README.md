# metadata-dataset-service

An ArangoDB Foxx service that serves the **dataset records** of the database it is installed in: the catalogue entries, in the data dictionary's `std_dataset` shape, that document each dataset the database holds — what its data represents, which indicators it publishes, where its records are stored, how it should be cited.

It is one half of the dataset pages of the Metadata Store Interface (the other half is the interface itself, which reads this service and joins the records with the dictionary's terms). Mounted at **`/dataset`**, read-only, anonymous, in **every database that holds datasets**: the collection name is its one setting.

| Database | Collection | Setting `datasetCollection` | Status |
|---|---|---|---|
| `GeoService` | `Dataset` (33 records: the external databases and the scatterplot compilations) | `Dataset` | installed on the laptop (development mode); not on the showcase server, which holds only the panes' collections |
| `metadata` | `dataset` (29 records from the EUFGIS portal) | `dataset` | later, once those records are in the `std_dataset` shape |

Cross-repository facts (which server runs what, behind what) live in `../shared/deployments.md`; read it before assuming anything about a server.

## The setting

`datasetCollection` (string, required, default `Dataset`) names the collection of this database that holds the dataset records. The service reads it and never writes it; setup and teardown never touch it (nor any other collection, index, view or analyzer). Set it at install time, or afterwards:

```bash
curl -sS -u user:password -X PATCH -H "Content-Type: application/json" \
  -d '{"datasetCollection": "dataset"}' \
  "http://localhost:8529/_db/metadata/_api/foxx/configuration?mount=/dataset"
```

## Routes

All `GET`, all anonymous, all under the mount. A dataset is always addressed by its **code** (`std_dataset_code`), never by its key. Every record leaves the service with the maintainer-only `_private` section stripped. The full description of each route, with the record model and worked examples, is in the service's Swagger page (**Services → dataset → API** in the ArangoDB web interface).

| Route | Answers |
|---|---|
| `GET /summary` | the figures of the entry page, computed on the fly: `datasets`, `indicators` (distinct `std_terms` gids), `collections` (distinct `_collection_list` names), `scopes` and `themes` (gid → records). Also the probe the interface uses to know whether the service answers. |
| `GET /overview` | every record as a light **overview row** (`{ total, rows }`): key, code, dates, count, `_info` reduced to title and definition, `std_dataset_domn` whole, `_collection_list` and the two resolutions, `indicators` = the size of `std_terms`. Optional filters `theme`, `extent`, `scope` (gids) and `collection` (a name in `_collection_list`), combined with AND. |
| `GET /record/:code` | the whole record, as stored. `404` when no record carries the code. |
| `GET /collections` | one entry per collection named in any record's `_collection_list`: the codes of the datasets stored there, whether the collection exists here, its live document count. |
| `GET /term/:gid` | the records whose `std_terms` or `std_terms_key` hold the gid, as overview rows with `holds` saying where. |

The service **does not read the dictionary**. A Foxx service cannot leave its database, and the pages do not need it to: a record's texts are multilingual dictionaries the interface localises, and the gids it carries (`std_terms`, `std_terms_key`, the classification) are terms the interface resolves and caches through the dictionary's `/ui` service (`POST /ui/term/bulk`).

## Install, upgrade, uninstall

**On the laptop** the git repository *is* the installed service: it is cloned into the mount's `APP` directory (`…/Apps/_db/GeoService/dataset/APP`) and the service runs in **development mode**, so an edit is live on the next request and a commit goes straight to GitHub from there. Development mode is switched on with `POST /_db/GeoService/_api/foxx/development?mount=/dataset`.

**On a server** the service is installed from the bundle. It has no npm dependencies: the bundle is the source tree.

```bash
git clone https://github.com/skofic/metadata-dataset-service.git && cd metadata-dataset-service
npm run bundle          # → metadata-dataset-service.zip

# FIRST install in a database (nothing mounted at /dataset yet), with the setting:
curl -sS -u user:password -X POST \
  "http://localhost:8529/_db/GeoService/_api/foxx?mount=/dataset" \
  -F "source=@metadata-dataset-service.zip" \
  -F 'configuration={"datasetCollection":"Dataset"}'

# UPGRADE an installed service (keeps the configuration, re-runs setup):
curl -sS -u user:password -X PATCH \
  "http://localhost:8529/_db/GeoService/_api/foxx/service?mount=/dataset&teardown=false&setup=true" \
  -F "source=@metadata-dataset-service.zip"
```

`scripts/setup.js` creates nothing: it reports whether the configured collection exists, how many records it holds and how many are not in the `std_dataset` shape, so a wrong setting shows in the install log. `scripts/teardown.js` removes nothing: the service owns no collection. Replacing or uninstalling it is therefore harmless to the data — keep the **Upgrade** habit anyway (PATCH, never Replace), as for every other service of this stack, where Replace runs a teardown that drops data.

Always address the Foxx API through the database the service lives in (`/_db/GeoService/_api/foxx/…`); the bare `/_api/foxx/…` form targets `_system`.

## Testing

`test/datasets.js` (Mocha + chai, run inside the database) pins the figures of the laptop's `GeoService.Dataset` as of 2026-11-19 — 33 records, 3 climate grids, 13 remote-sensing datasets, 12 collections, the five datasets carrying `env_climate_bio01`. When a pipeline adds or changes a dataset, a test fails and the figure is re-pinned together with the Swagger prose that quotes it.

```bash
curl -sS -u user:password -X POST \
  "http://localhost:8529/_db/GeoService/_api/foxx/tests?mount=/dataset&reporter=default"
```

## Data dependencies

Every record of the configured collection must be in the `std_dataset` shape of the data dictionary (`metadata-store`, `docs/std_dataset.md`): the code at the top level, the classification in `std_dataset_domn`, the facts in `std_dataset_prop`. Records are written by the pipelines of `metadata-external-databases` and `indicator-pair-scatterplots` (GeoService) and by the EUFGIS portal (metadata); this service never writes.

## License

Apache 2.0 — see `LICENSE`.

'use strict';

// Installer. Runs on install and upgrade, and on demand
// (`POST /_db/<db>/_api/foxx/scripts/setup?mount=/dataset`).
//
// It creates nothing and changes nothing: the dataset collection is loaded and
// owned by the pipelines that write the records (metadata-external-databases,
// indicator-pair-scatterplots, the portal), and the service only reads it. Setup
// says whether the configured collection is there and what it holds, so a wrong
// setting shows in the install log instead of in a 500 on the first request.

const { db } = require('@arangodb');
const { context } = require('@arangodb/locals');

const name = context.configuration.datasetCollection;
const log = (msg) => console.log('[setup] ' + msg);

const coll = db._collection(name);
if (!coll) {
    console.warn(`[setup] the configured dataset collection "${name}" does not exist in database "${db._name()}": every route answers 500 until it does (or until the datasetCollection setting names the right one)`);
} else {
    const total = coll.count();
    if (total === 0) {
        console.warn(`[setup] dataset collection "${name}" is empty: the routes answer, with nothing`);
    } else {
        const without = db._query(`FOR d IN @@c FILTER !HAS(d, "std_dataset_code") OR !HAS(d, "std_dataset_domn") OR !HAS(d, "std_dataset_prop") COLLECT WITH COUNT INTO n RETURN n`, { '@c': name }).toArray()[0];
        log(`dataset collection "${name}": ${total} record(s)` + (without ? `, ${without} of them not in the std_dataset shape (no code or no std_dataset_domn / std_dataset_prop container)` : ', every one in the std_dataset shape'));
    }
}

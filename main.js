'use strict';
const createRouter = require('@arangodb/foxx/router');
const router = createRouter();
module.context.use(router);   // mount at the service's configured mount point (/dataset in every database that holds data)

router.use('/', require('./routes/datasets'));   // the dataset records: overview, one record, collections, the datasets holding a term

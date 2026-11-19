'use strict';

// Uninstaller. The service owns no collection, index, view or analyzer, so
// there is nothing to drop: the dataset records belong to the pipelines that
// wrote them. Replacing or uninstalling this service never touches data —
// keep the Upgrade habit anyway (PATCH …&teardown=false&setup=true), as for
// every other service of the stack.

console.log('[teardown] nothing to remove: this service owns no collection');

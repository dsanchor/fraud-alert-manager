/* Application bootstrap and router wiring */
import { initRouter, addRoute } from './router.js';
import { renderList } from './views/list.js';
import { renderDetail } from './views/detail.js';
import { renderCreate, renderEdit } from './views/form.js';

// Register routes (order matters — more specific patterns first)
addRoute(/^\/alerts\/new$/, () => renderCreate());
addRoute(/^\/alerts\/(?<id>[^/]+)\/edit$/, ({ id }) => renderEdit({ id }));
addRoute(/^\/alerts\/(?<id>[^/]+)$/, ({ id }) => renderDetail({ id }));
addRoute(/^\/alerts$/, () => renderList());
addRoute('/', () => renderList());

initRouter();

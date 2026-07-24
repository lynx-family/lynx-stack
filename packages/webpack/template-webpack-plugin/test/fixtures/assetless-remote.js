export const loadDetails = () =>
  import(/* webpackChunkName: 'catalog/Details' */ 'catalog/Details');

export const loadLocal = () =>
  import(/* webpackChunkName: 'local-details' */ './assetless-local.js');

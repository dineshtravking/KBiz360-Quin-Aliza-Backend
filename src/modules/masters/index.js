import { masterResources } from './master.routes.js';

export { masterResources };

// Services other modules use (e.g. sales checks the client, branches create a godown).
export const masterServices = {
  clients: masterResources.clients.service,
  suppliers: masterResources.suppliers.service,
  transporters: masterResources.transporters.service,
  customAgencies: masterResources['custom-agencies'].service,
  godowns: masterResources.godowns.service,
  costCentres: masterResources['cost-centres'].service,
  bankAccounts: masterResources['bank-accounts'].service,
  leaveTypes: masterResources['leave-types'].service,
  itemCategories: masterResources['item-categories'].service,
};

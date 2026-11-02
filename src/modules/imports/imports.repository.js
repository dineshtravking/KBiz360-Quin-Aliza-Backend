import { ImportPlan } from './plan.model.js';
import { Shipment } from './shipment.model.js';

export const importsRepository = {
  // ── Plans ─────────────────────────────────────────────────────────────────
  findPlans: (filter, { skip, limit, sort }) =>
    ImportPlan.find(filter).sort(sort).skip(skip).limit(limit),
  countPlans: (filter) => ImportPlan.countDocuments(filter),
  findPlanById: (id, session) => ImportPlan.findById(id).session(session ?? null),
  createPlan: (data) => ImportPlan.create(data),

  // ── Shipments ─────────────────────────────────────────────────────────────
  findShipments: (filter, { skip, limit, sort }) =>
    Shipment.find(filter).sort(sort).skip(skip).limit(limit),
  findAllShipments: (filter) => Shipment.find(filter),
  countShipments: (filter) => Shipment.countDocuments(filter),
  findShipmentById: (id, session) => Shipment.findById(id).session(session ?? null),
  createShipment: (data) => Shipment.create(data),
};

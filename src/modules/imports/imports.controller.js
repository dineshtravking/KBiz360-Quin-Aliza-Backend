import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { planService } from './plan.service.js';
import { shipmentService } from './shipment.service.js';

const ctx = (req) => ({ user: req.user, scope: req.scope });
const page = (res, { items, meta }) => res.json(new ApiResponse(items, 'OK', meta));

export const planController = {
  async list(req, res) {
    page(res, await planService.list(req.valid.query, req.scope));
  },
  async get(req, res) {
    res.json(new ApiResponse(await planService.getById(req.valid.params.id, req.scope)));
  },
  async create(req, res) {
    res
      .status(201)
      .json(
        new ApiResponse(await planService.create(req.valid.body, ctx(req)), 'Import plan created'),
      );
  },
  async update(req, res) {
    const plan = await planService.update(req.valid.params.id, req.valid.body, ctx(req));
    res.json(new ApiResponse(plan, 'Import plan updated'));
  },
  async complete(req, res) {
    const plan = await planService.setStatus(req.valid.params.id, 'completed', ctx(req));
    res.json(new ApiResponse(plan, 'Import plan completed'));
  },
  async cancel(req, res) {
    const plan = await planService.setStatus(req.valid.params.id, 'cancelled', ctx(req));
    res.json(new ApiResponse(plan, 'Import plan cancelled'));
  },
};

export const shipmentController = {
  async list(req, res) {
    page(res, await shipmentService.list(req.valid.query, req.scope));
  },
  stages(req, res) {
    res.json(new ApiResponse(shipmentService.stages()));
  },
  async pipeline(req, res) {
    res.json(new ApiResponse(await shipmentService.pipelineSummary(req.scope)));
  },
  async get(req, res) {
    res.json(new ApiResponse(await shipmentService.getById(req.valid.params.id, req.scope)));
  },
  async create(req, res) {
    const shipment = await shipmentService.create(req.valid.body, ctx(req));
    res.status(201).json(new ApiResponse(shipment, `Shipment ${shipment.shipmentNo} created`));
  },
  async update(req, res) {
    const shipment = await shipmentService.update(req.valid.params.id, req.valid.body, ctx(req));
    res.json(new ApiResponse(shipment, 'Shipment updated'));
  },
  async setStage(req, res) {
    const { id, stage } = req.valid.params;
    const shipment = await shipmentService.setStage(id, stage, req.valid.body, ctx(req));
    res.json(new ApiResponse(shipment, 'Stage updated'));
  },
  async revokeStage(req, res) {
    const { id, stage } = req.valid.params;
    res.json(
      new ApiResponse(await shipmentService.revokeStage(id, stage, ctx(req)), 'Stage undone'),
    );
  },
  async deliver(req, res) {
    const shipment = await shipmentService.deliver(req.valid.params.id, req.valid.body, ctx(req));
    res.json(new ApiResponse(shipment, 'Delivered — stock received'));
  },
  async addPayment(req, res) {
    const shipment = await shipmentService.addPayment(
      req.valid.params.id,
      req.valid.body,
      ctx(req),
    );
    res.status(201).json(new ApiResponse(shipment, 'Payment recorded'));
  },
  async void(req, res) {
    const shipment = await shipmentService.void(
      req.valid.params.id,
      req.valid.body.reason,
      ctx(req),
    );
    res.json(new ApiResponse(shipment, 'Shipment voided'));
  },
};

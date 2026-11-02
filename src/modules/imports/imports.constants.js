// Shipment stages per route — same keys and order as the frontend
// (PIPELINE_STEPS / MTL_STEPS / AIR_STEPS). A stage is done once it has a date.
export const ROUTE_STAGES = {
  HD: [
    { key: 'order_confirmed', label: 'Ordered' },
    { key: 'payment', label: 'Payment' },
    { key: 'shipment_released', label: 'BL Details' },
    { key: 'dar_port', label: 'Arrival DSTN Port' },
    { key: 'transit_kasumbalesa', label: 'Truck Loaded' },
    { key: 'kasumbalesa', label: "Arrival K'lesa" },
    { key: 'hd_transhipment', label: 'Transshipment' },
    { key: 'transit_lubumbashi', label: "Left K'lesa" },
    { key: 'delivered', label: 'Delivered' },
  ],
  MTL: [
    { key: 'mtl_ordered', label: 'Ordered' },
    { key: 'mtl_paid', label: 'Paid' },
    { key: 'mtl_loaded', label: 'Loaded' },
    { key: 'mtl_klesa', label: 'Klesa Border' },
    { key: 'mtl_transship', label: 'Transhipped' },
    { key: 'mtl_customs', label: 'DRC Customs' },
    { key: 'mtl_lshi', label: 'Lshi Transit' },
    { key: 'delivered', label: 'Delivered' },
  ],
  AIR: [
    { key: 'air_ordered', label: 'Ordered' },
    { key: 'air_paid', label: 'Paid' },
    { key: 'air_shipped', label: 'Air Shipped (AWB)' },
    { key: 'air_departed', label: 'Departed' },
    { key: 'air_arrived', label: 'Arrived Lshi Airport' },
    { key: 'air_customs', label: 'Air Customs' },
    { key: 'air_lshi', label: 'Lshi Transit' },
    { key: 'delivered', label: 'Delivered' },
  ],
};

export const DELIVERED = 'delivered';

// Used in shipment numbers: IMPO SEA0001 / IMPO LND0001 / IMPO AIR0001
export const ROUTE_PREFIX = { HD: 'SEA', MTL: 'LND', AIR: 'AIR' };

// Landed-cost charges in USD (frontend CHARGE_DEFS).
export const CHARGE_KEYS = [
  'seaFreight',
  'insurance',
  'supplierCharges',
  'localPortCharges',
  'transportDarKasumbalesa',
  'customsKasumbalesa',
  'transportKasumLubumbashi',
];

export const SHIPMENT_STATUS = ['draft', 'in_transit', 'delivered', 'voided'];

export const PAYMENT_KINDS = ['supplier', 'freight', 'customs', 'clearing', 'other'];

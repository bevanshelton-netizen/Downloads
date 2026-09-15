import type { MeasurementSourceState } from "./types";

export type MeasurementSource = {
  id:string;
  label:string;
  purpose:string;
  env:string[];
  state:MeasurementSourceState;
  mode:"read"|"write"|"read-write";
  notes:string[];
};

export const measurementSources:MeasurementSource[]=[
  {
    id:"ga4",
    label:"Google Analytics 4",
    purpose:"Sessions, acquisition, events, conversions and revenue reporting.",
    env:["GA4_PROPERTY_ID","GOOGLE_ANALYTICS_CLIENT_ID","GOOGLE_ANALYTICS_CLIENT_SECRET"],
    state:"not-configured",
    mode:"read",
    notes:[
      "Use analytics.readonly for reporting wherever possible.",
      "The Google Analytics user must have access to the selected GA4 property."
    ]
  },
  {
    id:"google-ads-conversions",
    label:"Google Ads Conversions",
    purpose:"Map campaign spend and conversion actions to Growth OS outcomes.",
    env:["GOOGLE_ADS_CLIENT_ID","GOOGLE_ADS_CLIENT_SECRET"],
    state:"not-configured",
    mode:"read-write",
    notes:["Offline/imported conversion writes stay disabled until explicit connector approval."]
  },
  {
    id:"meta-capi",
    label:"Meta Pixel + Conversions API",
    purpose:"Reconcile browser and server events for Meta attribution.",
    env:["META_PIXEL_ID","META_CAPI_ACCESS_TOKEN"],
    state:"not-configured",
    mode:"write",
    notes:["Use one event_id across browser/server copies for deduplication."]
  },
  {
    id:"tiktok-events",
    label:"TikTok Pixel + Events API",
    purpose:"Send consented web, CRM and offline outcomes for TikTok measurement.",
    env:["TIKTOK_PIXEL_CODE","TIKTOK_EVENTS_ACCESS_TOKEN"],
    state:"not-configured",
    mode:"write",
    notes:["Preserve event IDs for deduplication and keep consent/limited-data-use rules upstream."]
  },
  {
    id:"crm",
    label:"CRM / Lead Pipeline",
    purpose:"Track captured, contacted, qualified, won and lost leads.",
    env:["CRM_WEBHOOK_SECRET"],
    state:"not-configured",
    mode:"read-write",
    notes:["Use stable lead IDs; do not use email address as the primary Growth OS identifier."]
  },
  {
    id:"payments",
    label:"Payments / Revenue",
    purpose:"Attach real paid, refunded and failed-payment outcomes to acquisition journeys.",
    env:["PAYMENT_WEBHOOK_SECRET"],
    state:"not-configured",
    mode:"read",
    notes:["Record net paid and refund events; never expose card data to Growth OS."]
  }
];

export type GrowthEventName =
  | "page_view"
  | "lead"
  | "qualified_lead"
  | "application"
  | "enrolment"
  | "order"
  | "payment"
  | "refund";

export type GrowthEvent = {
  eventId: string;
  eventName: GrowthEventName;
  occurredAt: string;
  brand: string;
  source?: string;
  medium?: string;
  campaign?: string;
  country?: string;
  language?: string;
  landingPage?: string;
  leadId?: string;
  customerId?: string;
  orderId?: string;
  value?: number;
  currency?: string;
  metadata?: Record<string,string|number|boolean|null>;
};

export type MeasurementSourceState =
  | "not-configured"
  | "credentials-ready"
  | "connected"
  | "verification-required";

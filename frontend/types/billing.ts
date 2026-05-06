export interface Subscription {
  id: string;
  plan: "starter" | "pro" | "business" | "enterprise";
  status: "active" | "cancelled" | "past_due" | "trialing";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface PaymentHistory {
  id: string;
  amount: number;
  currency: string;
  status: "success" | "failed" | "pending";
  description: string;
  createdAt: string;
}

export interface PricingPlan {
  name: string;
  slug: "starter" | "pro" | "business" | "enterprise";
  price: number;
  currency: string;
  interval: "monthly" | "yearly";
  features: string[];
  highlighted?: boolean;
}

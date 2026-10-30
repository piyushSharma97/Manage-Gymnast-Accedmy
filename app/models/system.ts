import { User } from './user';

// Models
export interface SystemLog {
  id: string;
  event: string;
  userId: string;
  createdAt: Date;
  entityId?: string | null;
  entityType?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  user?: User;
  meta?: JSON;
}

export interface SystemSetting {
  id: string;
  name: string;
  logo?: string | null;
  active: boolean;
  address?: string | null;
  websiteURL?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  language: string;
  timezone: string;
  currency: string;
  currencyFormat: string;

  socialFacebook?: string | null;
  socialTwitter?: string | null;
  socialInstagram?: string | null;
  socialLinkedIn?: string | null;
  socialPinterest?: string | null;
  socialYoutube?: string | null;

  notifyStockEmail: boolean;
  notifyStockWeb: boolean;
  notifyStockThreshold: number;

  notifyNewOrderEmail: boolean;
  notifyNewOrderWeb: boolean;

  notifyOrderStatusUpdateEmail: boolean;
  notifyOrderStatusUpdateWeb: boolean;

  notifyPaymentFailureEmail: boolean;
  notifyPaymentFailureWeb: boolean;

  notifySystemErrorFailureEmail: boolean;
  notifySystemErrorWeb: boolean;
}

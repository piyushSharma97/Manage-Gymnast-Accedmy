export interface Payment {
  id: number;
  orderid: string;
  invoice_id?: number | null;
  student_id: number;
  tenant_id: number;
  location_id: number;
  course_id?: number | null;
  course_amount?: number | null;
  sibling_discount?: number | null;
  discount: number;
  reg_fees?: number | null;
  additional?: number | null;
  amount: number;
  payment_mode?: string | null;
  method?: string | null;
  txnid: string;
  reference?: string | null;
  received_at: Date;
  created_at: Date;
  updated_at: Date;
  created_by?: number | null;
  updated_by?: number | null;
}

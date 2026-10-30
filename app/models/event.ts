export interface Event {
    id: number;
    name?: string;
    description?: string;
    type?: string;
    eventDate: Date;
    endDate: Date;
    dFees?: number;
    cFees?: number;
    earlyDisc?: number;
    earlyDate?: Date;
    gstapplicable?: boolean;
    regstart?: Date;
    time?: string; // Or Date if you're storing time as DateTime
    regend?: Date;
    isexternal?: boolean;
    isTrashed?: boolean;
    isdemo?: boolean;
    tenPointScoring?: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
  
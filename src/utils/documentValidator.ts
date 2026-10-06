export interface TenderData {
  tender_id: string;
  title: string;
  procuring_entity: string;
  bidder: string;
  submission_deadline: string;
}

export interface Requirement {
  id: string;
  order: number;
  title_en: string;
  title_bn: string;
  mandatory: boolean;
  has_expiry: boolean;
}

export interface DocumentMatch {
  requirementId: string;
  fileId: string | null;
  expiryDate: string | null;
}

export interface StatusInfo {
  status: 'OK' | 'Missing' | 'Expired' | 'Expiry date needed' | 'Not provided';
  isBlocking: boolean;
}

export function computeDocumentStatus(
  req: Requirement,
  match: DocumentMatch | undefined,
  deadlineStr: string
): StatusInfo {
  if (!match || !match.fileId) {
    if (req.mandatory) {
      return { status: 'Missing', isBlocking: true };
    }
    return { status: 'Not provided', isBlocking: false };
  }

  if (req.has_expiry) {
    if (!match.expiryDate) {
      return { status: 'Expiry date needed', isBlocking: true };
    }

    const expiry = new Date(match.expiryDate);
    const deadline = new Date(deadlineStr);

    expiry.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);

    if (expiry < deadline) {
      return { status: 'Expired', isBlocking: true };
    }
  }

  return { status: 'OK', isBlocking: false };
}